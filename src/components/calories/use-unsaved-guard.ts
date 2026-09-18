"use client";
import { useEffect, type RefObject } from "react";

/**
 * Warns before losing edits, both on a browser unload and on an in-app link.
 * The capture-phase click listener is what catches App Router navigation, which
 * never triggers `beforeunload`.
 */
export function useUnsavedGuard(
  dirtyRef: RefObject<boolean>,
  confirmText: string,
) {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.href === location.href
      )
        return;
      if (!window.confirm(confirmText)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirtyRef, confirmText]);
}
