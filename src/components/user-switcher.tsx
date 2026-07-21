"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SwitchUser = { id: number; name: string };

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
  const current = Number(params.get("user")) || selfId;

  if (users.length < 2) return null;

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
