"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { requestReset, type RecoverState } from "./actions";

const initialState: RecoverState = {
  error: null,
  notice: null,
  unavailable: false,
};

export function RecoverForm({ unavailable }: { unavailable: boolean }) {
  const [state, setState] = useState<RecoverState>(initialState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await requestReset(state, new FormData(event.currentTarget));
      if (result) setState(result);
    } catch (error) {
      // `redirect()` numa server action lança um erro de controlo que o Next
      // usa para navegar. Engoli-lo aqui pintava «sem ligação ao servidor» por
      // cima de uma operação bem-sucedida, um instante antes da navegação.
      unstable_rethrow(error);
      setState({
        error: "Sem ligação ao servidor. Tenta novamente.",
        notice: null,
        unavailable,
      });
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
          disabled={unavailable || pending}
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={unavailable || pending}>
        {unavailable
          ? "Indisponível sem envio de email"
          : pending
            ? "A enviar…"
            : "Enviar link de reposição"}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        <a href="/login" className="underline">
          Voltar ao início de sessão
        </a>
      </p>
    </form>
  );
}
