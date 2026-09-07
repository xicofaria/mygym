import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string | string[];
    verificado?: string | string[];
    eliminada?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const flag = (name: "ok" | "verificado" | "eliminada") => {
    const value = params[name];
    return (Array.isArray(value) ? value[0] : value) === "1";
  };
  const notice = flag("ok")
    ? "Palavra-passe alterada. Inicia sessão com a nova."
    : flag("verificado")
      ? "Email confirmado. Inicia sessão."
      : flag("eliminada")
        ? "A tua conta foi eliminada, incluindo todos os dados."
        : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          {/* dumbbell */}
          <svg
            viewBox="0 0 32 32"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
          >
            <path d="M8 12v8M6 14v4M24 12v8M26 14v4M8 16h16" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Gym Tracker</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inicia sessão para registares o teu progresso.
        </p>
      </div>
      {notice && (
        <p className="mb-4 text-center text-sm font-medium text-indigo-700 dark:text-indigo-300">
          {notice}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
