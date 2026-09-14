"use client";

import { useEffect, useRef, useState } from "react";

type ConnectionStatus = "online" | "offline";

export function PwaRuntime() {
  const [connection, setConnection] = useState<ConnectionStatus>("online");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [updateNotice, setUpdateNotice] = useState("");
  const waiting = useRef<ServiceWorker | null>(null);
  const reloadRequested = useRef(false);

  useEffect(() => {
    const updateConnection = () => {
      setConnection(navigator.onLine ? "online" : "offline");
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("online", updateConnection);
        window.removeEventListener("offline", updateConnection);
      };
    }

    let hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      waiting.current = null;
      // Another tab may activate the worker. It must not reload this tab.
      if (reloadRequested.current) {
        reloadRequested.current = false;
        window.location.reload();
      }
      else setUpdateAvailable(true);
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    let disposed = false;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (disposed) return;

        const offerWhenInstalled = (worker: ServiceWorker | null) => {
          worker?.addEventListener("statechange", () => {
            if (
              !disposed && worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              waiting.current = worker;
              setUpdateAvailable(true);
            }
          });
        };

        if (registration.waiting) {
          waiting.current = registration.waiting;
          setUpdateAvailable(true);
        }
        offerWhenInstalled(registration.installing);
        registration.addEventListener("updatefound", () => {
          if (!disposed) offerWhenInstalled(registration.installing);
        });
      })
      .catch(() => {
        // Offline support is progressive enhancement; registration failures
        // must not stop the authenticated application from working normally.
      });

    return () => {
      disposed = true;
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return (
    <>
    {updateAvailable && (
      <section aria-label="Atualização da aplicação" className={`fixed z-50 rounded-xl border border-indigo-200 bg-white p-3 shadow-lg dark:border-indigo-800 dark:bg-zinc-900 ${deferred ? "right-3 top-16 max-w-[calc(100vw-1.5rem)]" : "inset-x-3 bottom-24 mx-auto max-w-md"}`}>
        <p role="status" className="text-sm font-semibold">Atualização disponível</p>
        {!deferred && <p className="my-2 text-xs">Atualiza quando terminares o registo. Esta ação recarrega a página.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => {
            if (document.querySelector('[aria-busy="true"]')) {
              setUpdateNotice("Aguarda que a operação em curso termine antes de atualizar.");
              return;
            }
            setUpdateNotice("");
            if (!window.confirm("Atualizar e recarregar a página? Guarda primeiro as alterações; os dados sem rascunho podem perder-se.")) return;
            if (waiting.current?.state === "installed") {
              reloadRequested.current = true;
              waiting.current.postMessage({ type: "SKIP_WAITING" });
            } else window.location.reload();
          }}>Atualizar agora</button>
          {!deferred && <button type="button" className="btn-ghost" onClick={() => setDeferred(true)}>Mais tarde</button>}
        </div>
        {updateNotice && <p role="alert" className="mt-2 text-xs">{updateNotice}</p>}
      </section>
    )}
    {connection === "offline" && <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-3 top-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm dark:bg-amber-950 dark:text-amber-100"
      role="status"
    >
      Sem ligação ao servidor.
    </div>}
    </>
  );
}
