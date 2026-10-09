import { describe, expect, it } from "vitest";
import { saveExport, type ExportResult } from "@/lib/export/build";

type Outcome = { error: { message: string } | null };

/** Just enough of the Supabase client for saveExport: two uploads, the history row, and the "exported" mark. */
function fakeClient(opts: { markFails?: boolean; insertFails?: boolean } = {}) {
  const calls: string[] = [];
  const ok: Outcome = { error: null };
  const failed: Outcome = { error: { message: "boom" } };
  const client = {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          calls.push(`upload ${path.split("/").pop()}`);
          return ok;
        },
        remove: async () => {
          calls.push("remove");
          return ok;
        },
      }),
    },
    from: (table: string) => ({
      insert: async () => {
        calls.push(`insert ${table}`);
        return opts.insertFails ? failed : ok;
      },
      update: () => ({
        in: async () => {
          calls.push(`update ${table}`);
          return opts.markFails ? failed : ok;
        },
      }),
    }),
  };
  return { client: client as unknown as Parameters<typeof saveExport>[0], calls };
}

const result: ExportResult = {
  zip: new Blob(["zip"]),
  csv: "Filename,Title\n",
  included: [
    { id: "a", filename: "a.svg" },
    { id: "b", filename: "b.svg" },
  ],
  skipped: [],
  problems: [],
};

describe("saveExport", () => {
  it("stores the files and the history row, then marks the assets", async () => {
    const { client, calls } = fakeClient();
    const saved = await saveExport(client, "user-1", result);
    expect(saved?.marked).toBe(true);
    expect(saved?.exportId).toMatch(/[0-9a-f-]{36}/);
    expect(calls.filter((c) => c.startsWith("update"))).toEqual(["update assets"]);
  });

  it("reports an export whose assets could not be marked, instead of claiming success", async () => {
    const { client } = fakeClient({ markFails: true });
    const saved = await saveExport(client, "user-1", result);
    expect(saved).not.toBeNull();
    expect(saved?.marked).toBe(false);
  });

  it("returns null and removes the uploaded files when the history row fails", async () => {
    const { client, calls } = fakeClient({ insertFails: true });
    expect(await saveExport(client, "user-1", result)).toBeNull();
    expect(calls).toContain("remove");
    expect(calls.some((c) => c.startsWith("update"))).toBe(false);
  });
});
