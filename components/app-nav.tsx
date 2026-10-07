"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/riset", label: "Riset" },
  { href: "/generate", label: "Generate" },
  { href: "/uji-model", label: "Uji model" },
  { href: "/aset", label: "Aset" },
  { href: "/ekspor", label: "Ekspor" },
  { href: "/pengaturan", label: "Pengaturan" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="flex gap-1 overflow-x-auto">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
