import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { fetchActiveJob } from "@/lib/generate/active-job";
import { createClient } from "@/lib/supabase/server";
import { keluar } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects, this is the second line of defence.
  if (!user) redirect("/login");

  // Seeds the "7/10" badge on Generate; the nav keeps it fresh from the browser.
  const activeJob = await fetchActiveJob(supabase).catch(() => null);

  return (
    <div className="flex flex-1 flex-col lg:pl-64">
      <AppNav email={user.email ?? ""} logout={keluar} initialJob={activeJob} />
      {/* Bottom padding keeps the last content clear of the phone tab bar (--tabbar-h, globals.css). */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(var(--tabbar-h)+1.5rem)] sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
