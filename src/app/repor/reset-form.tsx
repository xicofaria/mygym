"use client";

import { useState } from "react";
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
    } catch {
      setState({ error: "Sem ligação ao servidor. Tenta novamente." });
    } finally {
      setPending(false);
    }
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
