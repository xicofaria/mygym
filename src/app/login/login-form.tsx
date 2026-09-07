"use client";

import { useState } from "react";
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
    } catch {
      setState({ error: "Sem ligação ao servidor. Tenta novamente." });
    } finally {
      setPending(false);
    }
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
