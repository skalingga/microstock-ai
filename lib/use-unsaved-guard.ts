"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE = "Ada perubahan yang belum disimpan. Tinggalkan halaman ini dan buang perubahannya?";

/**
 * While `dirty`, leaving the page asks first: closing or reloading the tab (beforeunload) and clicking an in-app link
 * (Next's <Link> skips beforeunload). Keyboard navigation that calls router.push should check confirmLeave() itself.
 */
export function useUnsavedGuard(dirty: boolean, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!dirty) return;
    document.body.dataset.unsaved = message;

    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    // Capture phase: runs before React's handlers, so a cancelled click never reaches <Link>.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      delete document.body.dataset.unsaved;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}

/** For navigation that is not a link click (keyboard shortcuts): true when it may go ahead. */
export function confirmLeave(): boolean {
  const message = document.body.dataset.unsaved;
  return !message || window.confirm(message);
}
