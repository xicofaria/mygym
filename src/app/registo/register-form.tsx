"use client";

import { useState } from "react";
import { register, type RegisterState } from "./actions";

const initialState: RegisterState = { error: null };

export function RegisterForm() {
  const [state, setState] = useState<RegisterState>(initialState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await register(state, new FormData(event.currentTarget));
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
        <label className="label" htmlFor="name">
          Nome
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={80}
          required
          className="input"
          placeholder="O teu nome"
        />
      </div>
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
          autoComplete="new-password"
          minLength={8}
          maxLength={256}
          required
          className="input"
          placeholder="Mínimo 8 caracteres"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Mínimo 8 caracteres.
        </p>
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "A criar conta…" : "Criar conta"}
      </button>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        Ao criar a conta aceitas os{" "}
        <a href="/termos" className="underline">
          Termos
        </a>{" "}
        e a{" "}
        <a href="/privacidade" className="underline">
          Política de Privacidade
        </a>
        .
      </p>
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Já tens conta?{" "}
        <a href="/login" className="underline">
          Iniciar sessão
        </a>
      </p>
    </form>
  );
}
