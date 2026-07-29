import Link from "next/link";
import { connection } from "next/server";

/**
 * Rendered per request on purpose. A prerendered 404 has no nonce on its
 * script tags, so the CSP in proxy.ts would block every one of them and the
 * page would arrive unhydrated.
 */
export default async function NotFound() {
  await connection();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">404</p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        O link que seguiste não existe ou já foi removido.
      </p>
      <Link href="/dashboard" className="btn-primary">
        Voltar ao início
      </Link>
    </main>
  );
}
