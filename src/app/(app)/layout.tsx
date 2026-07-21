import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/queries";
import { BottomNav } from "@/components/bottom-nav";
import { UserSwitcher } from "@/components/user-switcher";
import { logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const users = await getAllUsers();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-black/5 bg-background/80 px-4 py-3 backdrop-blur dark:border-white/10">
        <span className="text-lg font-bold tracking-tight">Gym Tracker</span>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <UserSwitcher users={users} selfId={user.id} />
          </Suspense>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Terminar sessão"
              className="btn-ghost h-9 w-9 rounded-lg px-0"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1M10 12h11m0 0-3-3m3 3-3 3" />
              </svg>
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
