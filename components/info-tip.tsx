"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A small (i) that reveals a longer explanation on hover, keyboard focus, or tap.
 * Used so help text stays one step away instead of filling the screen.
 */
export function InfoTip({
  children,
  label = "Penjelasan",
  align = "center",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const pointerRef = useRef("");
  const tipRef = useRef<HTMLSpanElement>(null);

  // iOS Safari never focuses a tapped button, so a tap toggles it and a tap elsewhere closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nudge the tip sideways so it stays 16px inside the screen edges on phones.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || !tip) return;
    const { left, right } = tip.getBoundingClientRect();
    const overflowRight = right - (window.innerWidth - 16);
    const shift = overflowRight > 0 ? -overflowRight : left < 16 ? 16 - left : 0;
    tip.style.marginLeft = `${shift}px`;
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex align-middle", className)}
      // Hover is mouse only; on touch, the enter event would open it right before the tap's click closes it again.
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onPointerDown={(e) => (pointerRef.current = e.pointerType)}
        // A mouse click keeps the hover-opened tip; touch and the keyboard toggle it.
        onClick={() => {
          const byMouse = pointerRef.current === "mouse";
          pointerRef.current = "";
          setOpen((v) => (byMouse ? true : !v));
        }}
        onFocus={() => !pointerRef.current && setOpen(true)}
        onBlur={(e) => !rootRef.current?.contains(e.relatedTarget as Node) && setOpen(false)}
        className="relative inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none after:absolute after:-inset-2.5 hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-4" />
      </button>
      {open && (
        // The padding (not a margin) bridges the gap, so the pointer can move onto the text without closing it.
        <span
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className={cn(
            "absolute top-full z-50 w-72 max-w-[calc(100vw-2rem)] pt-1.5",
            align === "start" && "left-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0",
          )}
        >
          <span className="block rounded-xl border bg-popover p-3 text-left text-xs leading-relaxed font-normal text-popover-foreground shadow-lg">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
