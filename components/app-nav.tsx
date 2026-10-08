"use client";

import {
  FlaskConical,
  LayoutGrid,
  LogOut,
  Menu,
  PackageCheck,
  Settings,
  Spline,
  Telescope,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { Anchor } from "@/components/pen-motif";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Ordered like the work itself: find a theme, make assets, check them, ship them.
const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Produksi",
    items: [
      { href: "/riset", label: "Riset", icon: Telescope },
      { href: "/generate", label: "Generate", icon: Spline },
      { href: "/aset", label: "Aset", icon: LayoutGrid },
      { href: "/ekspor", label: "Ekspor", icon: PackageCheck },
    ],
  },
  {
    label: "Alat",
    items: [
      { href: "/uji-model", label: "Uji model", icon: FlaskConical },
      { href: "/pengaturan", label: "Pengaturan", icon: Settings },
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
          <p className="px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground"
                        : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {/* The active page carries the selected anchor, like the point being edited. */}
                    {active && <Anchor filled />}
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
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 py-1 pr-1 pl-3">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </span>
      <ThemeToggle />
      <form action={logout}>
        <button
          type="submit"
          title="Keluar"
          aria-label="Keluar"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-card hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Phone menu: focus moves in and stays in, Escape closes, focus returns to the menu button, page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusables = () => [...(panel?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? [])];
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const menuButton = menuButtonRef.current;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      menuButton?.focus();
    };
  }, [open]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link href="/generate" className="flex h-16 items-center px-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Brand />
        </Link>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList pathname={pathname} />
        </div>
        <div className="p-3">
          <Account email={email} logout={logout} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <Link href="/generate" className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Brand />
        </Link>
        <button
          ref={menuButtonRef}
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
          {/* Tap target only; keyboard users close with Escape or the X button inside the panel. */}
          <div aria-hidden className="absolute inset-0 animate-in bg-foreground/30 backdrop-blur-sm fade-in" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-in flex-col bg-sidebar shadow-xl duration-200 slide-in-from-left"
          >
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
