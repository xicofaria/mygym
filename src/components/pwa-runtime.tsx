"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "online" | "offline";

export function PwaRuntime() {
  const [connection, setConnection] = useState<ConnectionStatus>("online");

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

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onControllerChange = () => {
      // clients.claim() also fires this event on the very first install. Only
      // reload when replacing an existing worker, otherwise the first visit
      // would refresh unexpectedly.
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
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

        const activateWhenInstalled = (worker: ServiceWorker | null) => {
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        };

        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        activateWhenInstalled(registration.installing);
        registration.addEventListener("updatefound", () => {
          activateWhenInstalled(registration.installing);
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

  if (connection === "online") return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-3 top-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm dark:bg-amber-950 dark:text-amber-100"
      role="status"
    >
      Sem ligação — os rascunhos ficam guardados neste dispositivo.
    </div>
  );
}
