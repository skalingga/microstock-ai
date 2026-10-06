// RLS check: user B must not be able to read, change, or reach user A's data.
// Run with: npm run test:rls
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// The service role key is only used here to create and delete two throwaway users.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Variabel NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local.",
  );
  process.exit(1);
}

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, authOptions);

let failed = 0;
function check(name, ok, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${name}${!ok && detail ? ` (${detail})` : ""}`);
}

async function createUser(label) {
  const email = `rls-${label}-${randomUUID().slice(0, 8)}@rls-test.local`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Gagal membuat user ${label}: ${error.message}`);

  const client = createClient(url, anonKey, authOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Gagal login user ${label}: ${signInError.message}`);
  return { id: data.user.id, client };
}

const users = [];
const uploadedPaths = [];

try {
  const a = await createUser("a");
  users.push(a);
  const b = await createUser("b");
  users.push(b);

  // --- User A creates a full chain of data and a file ---
  const run = await a.client
    .from("research_runs")
    .insert({ region: "US", period_start: "2026-11-01", period_end: "2026-12-31" })
    .select()
    .single();
  check("A bisa membuat research_run", !run.error, run.error?.message);

  const theme = await a.client
    .from("themes")
    .insert({ title: "Thanksgiving icons", run_id: run.data?.id, seed_keywords: ["thanksgiving"] })
    .select()
    .single();
  check("A bisa membuat theme", !theme.error, theme.error?.message);

  const job = await a.client
    .from("generation_jobs")
    .insert({ theme_id: theme.data?.id, style: "icon_set", count: 3 })
    .select()
    .single();
  check("A bisa membuat generation_job", !job.error, job.error?.message);

  const asset = await a.client
    .from("assets")
    .insert({ job_id: job.data?.id, provider: "kenari", model: "uji", title: "Rahasia A" })
    .select()
    .single();
  check("A bisa membuat asset", !asset.error, asset.error?.message);

  const exp = await a.client.from("exports").insert({ asset_count: 1 }).select().single();
  check("A bisa membuat export", !exp.error, exp.error?.message);

  const usage = await a.client
    .from("provider_usage")
    .insert({ provider: "kenari", model: "uji", kind: "svg" })
    .select()
    .single();
  check("A bisa membuat provider_usage", !usage.error, usage.error?.message);

  const filePath = `${a.id}/svg/rls-test.svg`;
  const upload = await a.client.storage
    .from("assets")
    .upload(filePath, new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: "image/svg+xml" }));
  if (!upload.error) uploadedPaths.push(filePath);
  check("A bisa mengunggah file ke folder sendiri", !upload.error, upload.error?.message);

  const aOwnFile = await a.client.storage.from("assets").download(filePath);
  check("A bisa mengunduh file sendiri", !aOwnFile.error, aOwnFile.error?.message);

  // --- User B tries to reach A's data ---
  const tables = ["research_runs", "themes", "generation_jobs", "assets", "exports", "provider_usage"];
  for (const table of tables) {
    const res = await b.client.from(table).select("id");
    check(`B tidak bisa membaca ${table} milik A`, !res.error && res.data.length === 0, res.error?.message);
  }

  const bSettings = await b.client.from("user_settings").select("user_id");
  check(
    "B hanya melihat user_settings miliknya sendiri",
    !bSettings.error && bSettings.data.length === 1 && bSettings.data[0].user_id === b.id,
    bSettings.error?.message,
  );

  const hijack = await b.client.from("assets").update({ title: "diretas" }).eq("id", asset.data?.id).select();
  check("B tidak bisa mengubah asset milik A", !hijack.error && hijack.data.length === 0, hijack.error?.message);

  const wipe = await b.client.from("assets").delete().eq("id", asset.data?.id).select();
  check("B tidak bisa menghapus asset milik A", !wipe.error && wipe.data.length === 0, wipe.error?.message);

  const spoof = await b.client.from("themes").insert({ user_id: a.id, title: "palsu" });
  check("B tidak bisa menulis baris atas nama A", Boolean(spoof.error));

  const crossLink = await b.client
    .from("assets")
    .insert({ job_id: job.data?.id, provider: "kenari", model: "uji" });
  check("B tidak bisa menempelkan asset ke job milik A", Boolean(crossLink.error));

  const stealSettings = await b.client
    .from("user_settings")
    .update({ recraft_monthly_budget_usd: 0 })
    .eq("user_id", a.id)
    .select();
  check(
    "B tidak bisa mengubah user_settings milik A",
    !stealSettings.error && stealSettings.data.length === 0,
    stealSettings.error?.message,
  );

  // --- Storage ---
  const bDownload = await b.client.storage.from("assets").download(filePath);
  check("B tidak bisa mengunduh file milik A", Boolean(bDownload.error));

  const bList = await b.client.storage.from("assets").list(`${a.id}/svg`);
  check("B tidak melihat isi folder A", !bList.error && bList.data.length === 0, bList.error?.message);

  const bUpload = await b.client.storage
    .from("assets")
    .upload(`${a.id}/svg/disusupi.svg`, new Blob(["<svg/>"], { type: "image/svg+xml" }));
  if (!bUpload.error) uploadedPaths.push(`${a.id}/svg/disusupi.svg`);
  check("B tidak bisa mengunggah ke folder A", Boolean(bUpload.error));

  // --- Not logged in ---
  const anon = createClient(url, anonKey, authOptions);
  const anonAssets = await anon.from("assets").select("id");
  check(
    "Tanpa login tidak bisa membaca assets",
    Boolean(anonAssets.error) || anonAssets.data.length === 0,
  );
  const anonFile = await anon.storage.from("assets").download(filePath);
  check("Tanpa login tidak bisa mengunduh file", Boolean(anonFile.error));

  // --- A still sees the data (the policies did not lock everyone out) ---
  const aAssets = await a.client.from("assets").select("title");
  check(
    "A masih bisa membaca asset miliknya",
    !aAssets.error && aAssets.data.length === 1 && aAssets.data[0].title === "Rahasia A",
    aAssets.error?.message,
  );
} catch (err) {
  failed += 1;
  console.error("Pengujian berhenti karena error:", err instanceof Error ? err.message : err);
} finally {
  if (uploadedPaths.length > 0) await admin.storage.from("assets").remove(uploadedPaths);
  for (const user of users) await admin.auth.admin.deleteUser(user.id); // cascades to all rows
  console.log("Data uji sudah dibersihkan.");
}

if (failed > 0) {
  console.error(`\n${failed} pemeriksaan gagal.`);
  process.exit(1);
}
console.log("\nSemua pemeriksaan RLS lolos.");
