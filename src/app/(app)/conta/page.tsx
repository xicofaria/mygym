import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AccountForms } from "./account-forms";

export const metadata = { title: "Conta — Gym Tracker" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-lg font-bold tracking-tight">A tua conta</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {user.email}
      </p>
      <AccountForms
        name={user.name}
        email={user.email}
        emailVerified={user.emailVerifiedAt != null}
        weeklyReport={user.weeklyReportEnabled}
      />
      <div className="mt-8 border-t border-black/10 pt-4 text-sm dark:border-white/10">
        <Link href="/relatorios" className="underline">
          Relatório semanal
        </Link>
        <span className="text-zinc-500 dark:text-zinc-400">
          {" "}— o resumo da tua semana de treinos e calorias.
        </span>
      </div>
    </main>
  );
}
