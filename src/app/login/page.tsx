import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string | string[];
    verificar?: string | string[];
    verificado?: string | string[];
    eliminada?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  // Every redirect that lands here carries its outcome in the query string, so
  // each one needs a branch: a silent login page reads as "nothing happened".
  const value = (name: "ok" | "verificar" | "verificado" | "eliminada") => {
    const raw = params[name];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const failed = value("verificado") === "0";
  const notice: { text: string; tone: "info" | "warn" } | null =
    value("ok") === "repor"
      ? {
          text: "Palavra-passe alterada. Inicia sessão com a nova.",
          tone: "info",
        }
      : value("verificar") === "1"
        ? {
            text: "Conta criada. Enviámos um link de confirmação para o teu email — confirma-o para entrares.",
            tone: "info",
          }
        : value("verificar") === "0"
          ? {
              text: "Conta criada, mas não conseguimos enviar o email de confirmação. Inicia sessão para receberes um novo link.",
              tone: "warn",
            }
          : value("verificado") === "1"
            ? { text: "Email confirmado. Inicia sessão.", tone: "info" }
            : failed
              ? {
                  text: "Este link de confirmação expirou ou já foi usado. Inicia sessão para receberes um novo.",
                  tone: "warn",
                }
              : value("eliminada") === "1"
                ? {
                    text: "A tua conta foi eliminada, incluindo todos os dados.",
                    tone: "info",
                  }
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
        <p
          role={notice.tone === "warn" ? "alert" : "status"}
          className={`mb-4 text-center text-sm font-medium ${
            notice.tone === "warn"
              ? "text-amber-700 dark:text-amber-400"
              : "text-indigo-700 dark:text-indigo-300"
          }`}
        >
          {notice.text}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
