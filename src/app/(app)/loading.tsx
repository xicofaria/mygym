/**
 * Shared fallback for every protected route.
 *
 * Its real job is not the visuals: without a `loading.tsx` Next skips
 * prefetching a dynamic route entirely and holds the *previous* screen, fully
 * painted, until the server replies — which reads as a dead button. The
 * boundary makes the transition start immediately and lets the shared layout
 * be prefetched. Individual routes override this with a closer shape.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-7 w-40" />
        <div className="skeleton h-4 w-56" />
      </div>
      <div className="card flex flex-col gap-3">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
      </div>
      <div className="card flex flex-col gap-3">
        <div className="skeleton h-4 w-2/5" />
        <div className="skeleton h-4 w-3/5" />
      </div>
    </div>
  );
}
