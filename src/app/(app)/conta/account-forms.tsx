"use client";

import { useState } from "react";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  updateName,
  type AccountState,
} from "./actions";

const initial: AccountState = { error: null };

function Feedback({ state }: { state: AccountState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
        {state.ok}
      </p>
    );
  return null;
}

/** Server actions via onSubmit: useActionState engolia submissões repetidas. */
function useAction<R extends AccountState>(
  action: (prev: R, formData: FormData) => Promise<R>,
) {
  const [state, setState] = useState<R>(initial as R);
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await action(state, new FormData(event.currentTarget));
      if (result) setState(result);
    } catch {
      setState({ error: "Sem ligação ao servidor. Tenta novamente." } as R);
    } finally {
      setPending(false);
    }
  }
  return { state, submit, pending };
}

export function AccountForms({
  name,
  email,
  emailVerified,
}: {
  name: string;
  email: string;
  emailVerified: boolean;
}) {
  const nameForm = useAction(updateName);
  const pwForm = useAction(changePassword);
  const emailForm = useAction(changeEmail);
  const deleteForm = useAction(deleteAccount);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="mt-4 flex flex-col gap-6">
      <form onSubmit={nameForm.submit} className="card flex flex-col gap-3">
        <label className="label" htmlFor="account-name">
          Nome
        </label>
        <input
          id="account-name"
          name="name"
          maxLength={80}
          required
          className="input"
          defaultValue={name}
        />
        <Feedback state={nameForm.state} />
        <button type="submit" className="btn-primary" disabled={nameForm.pending}>
          {nameForm.pending ? "A guardar…" : "Guardar nome"}
        </button>
      </form>

      <form onSubmit={pwForm.submit} className="card flex flex-col gap-3">
        <h2 className="font-semibold">Palavra-passe</h2>
        <label className="label" htmlFor="current-password">
          Palavra-passe atual
        </label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
        <label className="label" htmlFor="new-password">
          Nova palavra-passe (mínimo 8)
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={256}
          required
          className="input"
        />
        <Feedback state={pwForm.state} />
        <button type="submit" className="btn-primary" disabled={pwForm.pending}>
          {pwForm.pending ? "A guardar…" : "Alterar palavra-passe"}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Termina a sessão em todos os outros dispositivos.
        </p>
      </form>

      <form onSubmit={emailForm.submit} className="card flex flex-col gap-3">
        <h2 className="font-semibold">Email</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {email}
          {emailVerified ? " · verificado" : " · não verificado"}
        </p>
        <label className="label" htmlFor="new-email">
          Novo email
        </label>
        <input
          id="new-email"
          name="newEmail"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          className="input"
        />
        <label className="label" htmlFor="email-password">
          Palavra-passe atual
        </label>
        <input
          id="email-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
        <Feedback state={emailForm.state} />
        <button type="submit" className="btn-primary" disabled={emailForm.pending}>
          {emailForm.pending ? "A guardar…" : "Alterar email"}
        </button>
      </form>

      <div className="card flex flex-col gap-3 border-red-200 dark:border-red-900/60">
        <h2 className="font-semibold text-red-700 dark:text-red-400">
          Eliminar conta
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Apaga a conta e <strong>todos</strong> os dados: treinos, séries,
          planeamentos, medidas, produtos e consumos de calorias, favoritos e
          histórico de IA. É irreversível. Os rascunhos guardados neste
          dispositivo podem permanecer; podes limpá-los nas definições do
          navegador.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            className="btn-ghost self-start text-red-600 dark:text-red-400"
            onClick={() => setConfirmDelete(true)}
          >
            Quero eliminar a minha conta
          </button>
        ) : (
          <form onSubmit={deleteForm.submit} className="flex flex-col gap-3">
            <label className="label" htmlFor="confirm-delete">
              Escreve ELIMINAR para confirmar
            </label>
            <input
              id="confirm-delete"
              name="confirm"
              required
              className="input"
              placeholder="ELIMINAR"
              autoComplete="off"
            />
            <label className="label" htmlFor="delete-password">
              Palavra-passe atual
            </label>
            <input
              id="delete-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
            />
            <Feedback state={deleteForm.state} />
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleteForm.pending}
              >
                {deleteForm.pending ? "A eliminar…" : "Eliminar definitivamente"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
