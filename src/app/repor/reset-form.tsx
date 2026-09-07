"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { performReset, type ResetState } from "./actions";

const initialState: ResetState = { error: null };

export function ResetForm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<ResetState>(initialState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await performReset(state, new FormData(event.currentTarget));
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
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <div>
        <label className="label" htmlFor="password">
          Nova palavra-passe
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
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "A guardar…" : "Guardar nova palavra-passe"}
      </button>
    </form>
  );
}
