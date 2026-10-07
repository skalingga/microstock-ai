"use client";

import {
  FlaskConical,
  LayoutGrid,
  LogOut,
  Menu,
  PackageCheck,
  Settings,
  Sparkles,
  Telescope,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; hint: string };

// Ordered like the work itself: find a theme, make assets, check them, ship them.
const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Produksi",
    items: [
      { href: "/riset", label: "Riset", icon: Telescope, hint: "Cari tema berpeluang" },
      { href: "/generate", label: "Generate", icon: Sparkles, hint: "Buat variasi SVG" },
      { href: "/aset", label: "Aset", icon: LayoutGrid, hint: "Galeri dan QC" },
      { href: "/ekspor", label: "Ekspor", icon: PackageCheck, hint: "ZIP + CSV Adobe" },
    ],
  },
  {
    label: "Alat",
    items: [
      { href: "/uji-model", label: "Uji model", icon: FlaskConical, hint: "Bandingkan model AI" },
      { href: "/pengaturan", label: "Pengaturan", icon: Settings, hint: "Provider, palet, batas" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigasi utama" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon, hint }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : "bg-muted text-muted-foreground group-hover:bg-card group-hover:text-primary",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="leading-tight">
                      <span className="block">{label}</span>
                      <span className={cn("block text-xs font-normal", active ? "text-primary/80" : "text-muted-foreground")}>
                        {hint}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Account({ email, logout }: { email: string; logout: () => Promise<void> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-2.5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground uppercase"
      >
        {email.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </span>
      <form action={logout}>
        <button
          type="submit"
          title="Keluar"
          aria-label="Keluar"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-card hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

/** Sidebar on large screens, a top bar with a slide-in menu on phones and tablets. */
export function AppNav({ email, logout }: { email: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the phone menu with Escape, and keep the page behind it from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link href="/generate" className="flex h-16 items-center px-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Brand />
        </Link>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList pathname={pathname} />
        </div>
        <div className="p-3">
          <Account email={email} logout={logout} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
        <Link href="/generate" className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Brand />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          aria-expanded={open}
          className="flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 animate-in bg-foreground/30 backdrop-blur-sm fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-in flex-col bg-sidebar shadow-xl duration-200 slide-in-from-left">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="flex size-11 items-center justify-center rounded-xl hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="p-3">
              <Account email={email} logout={logout} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
