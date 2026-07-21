"use client";

import { useTransition } from "react";

/**
 * Small trash button that calls a bound server action after a confirm().
 * The server action is passed as a prop (server actions are serializable).
 */
export function DeleteButton({
  action,
  id,
  confirmText = "Eliminar este registo?",
}: {
  action: (id: number) => Promise<unknown>;
  id: number;
  confirmText?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      aria-label="Eliminar"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) start(() => void action(id));
      }}
      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
