"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="input"
          placeholder="tu@exemplo.com"
          // React resets the form after an action, which would also wipe the
          // email on a wrong password. Put it back so only the password is
          // retyped.
          defaultValue={state.email ?? ""}
          key={state.email ?? ""}
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
    </form>
  );
}
