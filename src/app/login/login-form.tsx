"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, setState] = useState<LoginState>({ error: null });
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await login(state, new FormData(event.currentTarget));
      if (result) setState(result);
    } catch (error) {
      // `redirect()` numa server action lança um erro de controlo que o Next
      // usa para navegar. Engoli-lo aqui pintava «sem ligação ao servidor» por
      // cima de uma operação bem-sucedida, um instante antes da navegação.
      unstable_rethrow(error);
      setState({ error: "Sem ligação ao servidor. Tenta novamente." });
    }
    // Não corre num redirect: o botão fica desativado durante a navegação.
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          className="input"
          placeholder="tu@exemplo.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Palavra-passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          required
          className="input"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "A iniciar sessão…" : "Iniciar sessão"}
      </button>
      <div className="flex items-center justify-between text-sm">
        <a href="/recuperar" className="underline">
          Esqueceste a palavra-passe?
        </a>
        <a href="/registo" className="underline">
          Criar conta
        </a>
      </div>
    </form>
  );
}
