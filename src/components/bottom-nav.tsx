"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

function Icon({ path }: { path: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

const items = [
  {
    href: "/dashboard",
    label: "Início",
    icon: <Icon path={<path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />} />,
  },
  {
    href: "/workouts",
    label: "Treinos",
    icon: (
      <Icon
        path={
          <>
            <path d="M6.5 7.5v9M4 9v6M17.5 7.5v9M20 9v6" />
            <path d="M6.5 12h11" />
          </>
        }
      />
    ),
  },
  {
    href: "/exercises",
    label: "Exercícios",
    icon: (
      <Icon
        path={
          <>
            <path d="M4 19V5M4 19h16" />
            <path d="M8 19v-6M12 19V9M16 19v-4" />
          </>
        }
      />
    ),
  },
  {
    href: "/body",
    label: "Corpo",
    icon: (
      <Icon
        path={
          <>
            <circle cx="12" cy="6" r="2.4" />
            <path d="M12 8.5v7M12 15.5 8.5 21M12 15.5 15.5 21M7.5 11h9" />
          </>
        }
      />
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const user = params.get("user");
  const suffix = user ? `?user=${user}` : "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-background/90 backdrop-blur dark:border-white/10">
      <div className="mx-auto flex max-w-xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href + suffix}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
