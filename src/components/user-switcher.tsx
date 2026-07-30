"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SwitchUser = { id: number; name: string };

const VIEWABLE_PATHS = new Set([
  "/dashboard",
  "/workouts",
  "/body",
  "/exercises",
]);

/** Only these pages use ?user to change the data being rendered. */
export function supportsViewedUser(pathname: string): boolean {
  return (
    VIEWABLE_PATHS.has(pathname) || /^\/exercises\/\d+$/.test(pathname)
  );
}

/** Toggle whose data is shown via the ?user= query param. */
export function UserSwitcher({
  users,
  selfId,
}: {
  users: SwitchUser[];
  selfId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = Number(params.get("user"));
  const supported = supportsViewedUser(pathname);
  const current = users.some((user) => user.id === requested)
    ? requested
    : selfId;

  useEffect(() => {
    if (supported || !params.has("user")) return;
    const next = new URLSearchParams(params.toString());
    next.delete("user");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [params, pathname, router, supported]);

  if (!supported || users.length < 2) return null;

  function select(id: number) {
    const sp = new URLSearchParams(params.toString());
    if (id === selfId) sp.delete("user");
    else sp.set("user", String(id));
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex rounded-lg bg-black/5 p-0.5 text-xs font-semibold dark:bg-white/10">
      {users.map((u) => {
        const active = current === u.id;
        return (
          <button
            type="button"
            aria-pressed={active}
            key={u.id}
            onClick={() => select(u.id)}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              active
                ? "bg-white text-indigo-600 shadow-sm dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500"
            }`}
          >
            {u.id === selfId ? "Eu" : u.name}
          </button>
        );
      })}
    </div>
  );
}
