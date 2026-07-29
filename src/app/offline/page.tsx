import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Sem ligação | Gym Tracker",
};

export default async function OfflinePage() {
  // The nonce-based CSP requires HTML to be rendered per request. The service
  // worker stores this public response, whose script nonces match its CSP.
  await connection();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-5 py-12">
      <section className="card w-full text-center">
        <p className="mb-2 text-4xl" aria-hidden="true">
          📶
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Está sem ligação</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Não foi possível contactar o servidor. Os formulários guardam um
          rascunho apenas neste dispositivo para não perderes o que preencheste.
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Quando a ligação regressar, volta à app e envia o rascunho.
        </p>
        <Link className="btn-primary mt-6" href="/">
          Tentar novamente
        </Link>
      </section>
    </main>
  );
}
