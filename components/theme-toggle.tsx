"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** Switches between the light and dark sheet; the choice is kept in this browser by next-themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser; render a neutral button on the server to avoid a mismatch.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Pakai mode terang" : "Pakai mode gelap";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
