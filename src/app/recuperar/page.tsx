import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { RecoverForm } from "./recover-form";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const sent = (await searchParams).enviado === "1";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Recuperar acesso</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Indica o teu email para receberes um link de reposição.
      </p>
      {sent && (
        <p className="mb-4 text-sm font-medium text-indigo-700 dark:text-indigo-300">
          Se existir uma conta com esse email, enviámos as instruções.
        </p>
      )}
      <RecoverForm unavailable={!isEmailConfigured()} />
    </main>
  );
}
