"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet on phones, a centered panel on larger screens. Built on the native <dialog>, so focus stays inside,
 * Escape closes it and the page behind is inert. Tapping the dimmed backdrop closes it too.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned under the scrolling content, e.g. a Simpan button. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The page behind should not scroll under a finger dragging inside the sheet.
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog box itself (not its content) is a click on the backdrop.
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-0 mt-auto max-h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-xl border bg-card p-0 text-foreground shadow-xl open:flex backdrop:bg-foreground/35",
        "sm:m-auto sm:max-w-lg sm:rounded-lg",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b py-2 pr-2 pl-4">
        <h2 id={titleId} className="text-lg font-extrabold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4", !footer && "pb-[max(1rem,env(safe-area-inset-bottom))]")}>
        {children}
      </div>
      {footer && <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </dialog>
  );
}
