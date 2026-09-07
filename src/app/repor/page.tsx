import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ResetForm } from "./reset-form";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[];
    email?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const rawToken = params.token;
  const rawEmail = params.email;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Nova palavra-passe</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Escolhe uma palavra-passe com pelo menos 8 caracteres.
      </p>
      {token && email ? (
        <ResetForm token={token} email={email} />
      ) : (
        <div className="card text-sm">
          <p>Este link de reposição não é válido.</p>
          <p className="mt-2">
            <a href="/recuperar" className="underline">
              Pedir um novo link
            </a>
          </p>
        </div>
      )}
    </main>
  );
}
