"use client";

import {
  Ellipsis,
  FlaskConical,
  House,
  LayoutGrid,
  LogOut,
  PackageCheck,
  Settings,
  Spline,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Anchor } from "@/components/pen-motif";
import { Sheet } from "@/components/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ActiveJob } from "@/lib/generate/active-job";
import { useActiveJob } from "@/lib/generate/use-active-job";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const MEJA: NavItem = { href: "/meja", label: "Meja", icon: House };

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

// Phone tab bar: the pages used most on a phone (monitoring and Adobe review); the rest sit under Lainnya.
const TABS: NavItem[] = [MEJA, groups[0].items[1], groups[0].items[2], groups[0].items[3]];
const MORE: NavItem[] = [groups[0].items[0], ...groups[1].items];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "7/10" while a batch runs, for the Generate entry; null otherwise. */
function batchProgress(job: ActiveJob | null) {
  return job?.state === "berjalan" ? { text: `${job.made}/${job.count}`, label: `batch berjalan, ${job.made} dari ${job.count}` } : null;
}

function SideLink({
  item,
  pathname,
  badge,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  badge?: ReturnType<typeof batchProgress>;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={badge ? `${item.label}, ${badge.label}` : undefined}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge && (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground tabular-nums">
          <Anchor filled className="size-1.5" />
          {badge.text}
        </span>
      )}
      {/* The active page carries the selected anchor, like the point being edited. */}
      {active && !badge && <Anchor filled />}
    </Link>
  );
}

function Account({ email, logout }: { email: string; logout: () => Promise<void> }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border py-1 pr-1 pl-3">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </span>
      <ThemeToggle />
      <form action={logout}>
        <button
          type="submit"
          title="Keluar"
          aria-label="Keluar"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

const tabClass =
  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** Sidebar on large screens; a tab bar at the bottom on phones and tablets, within thumb reach. */
export function AppNav({ email, logout, initialJob }: { email: string; logout: () => Promise<void>; initialJob: ActiveJob | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const badge = batchProgress(useActiveJob(initialJob));
  const moreActive = MORE.some((item) => isActive(pathname, item.href));
  // Adobe review is a focus mode on phones: the page has its own Tutup button.
  const focusMode = isActive(pathname, "/aset/tinjau");

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link href="/meja" className="flex h-16 items-center px-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Brand />
        </Link>
        <nav aria-label="Navigasi utama" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <SideLink item={MEJA} pathname={pathname} />
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SideLink item={item} pathname={pathname} badge={item.href === "/generate" ? badge : null} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-3">
          <Account email={email} logout={logout} />
        </div>
      </aside>

      <nav
        aria-label="Navigasi utama"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden",
          focusMode && "hidden",
        )}
      >
        {TABS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const tabBadge = item.href === "/generate" ? badge : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={tabBadge ? `${item.label}, ${tabBadge.label}` : undefined}
              className={cn(tabClass, active ? "font-extrabold text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {/* The active tab carries an ink stroke along its top edge. */}
              {active && <span aria-hidden className="absolute top-0 h-0.5 w-6 bg-foreground" />}
              <Icon className="size-5" />
              {item.label}
              {tabBadge && (
                <span
                  aria-hidden
                  className="absolute top-0.5 left-[calc(50%+0.375rem)] inline-flex h-4 items-center gap-0.5 border border-foreground bg-card px-1 text-[11px] leading-none font-extrabold text-foreground tabular-nums"
                >
                  <Anchor filled className="size-1.5 border" />
                  {tabBadge.text}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(tabClass, moreActive ? "font-extrabold text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {moreActive && <span aria-hidden className="absolute top-0 h-0.5 w-6 bg-foreground" />}
          <Ellipsis className="size-5" />
          Lainnya
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Lainnya" className="lg:hidden">
        <ul className="space-y-1">
          {MORE.map((item) => (
            <li key={item.href}>
              <SideLink item={item} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t pt-4">
          <Account email={email} logout={logout} />
        </div>
      </Sheet>
    </>
  );
}
