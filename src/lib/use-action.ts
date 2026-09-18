"use client";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";

type ActionResult = { error?: string | null } | void | undefined;

/**
 * Single place where a client component calls a Server Action.
 * `unstable_rethrow` matters: `redirect()` throws, and a bare catch would show
 * a network error instead of navigating.
 */
export function useAction(fallback: string) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    start(async () => {
      setError("");
      try {
        const result = await action();
        if (result?.error) {
          setError(result.error);
          return;
        }
        onSuccess?.();
      } catch (cause) {
        unstable_rethrow(cause);
        setError(fallback);
      }
    });
  }
  return { pending, error, setError, run };
}
