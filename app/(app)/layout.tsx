import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { keluar } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects, this is the second line of defence.
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">MicroStock Vector AI</span>
          <AppNav />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={keluar}>
              <Button type="submit" variant="outline" size="sm">
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
