/** Mirrors the dashboard: header, three stats, calendar, recent sessions. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar o teu progresso…</span>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-7 w-44" />
          <div className="skeleton h-4 w-60" />
        </div>
        <div className="skeleton h-10 w-28 rounded-xl" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card flex flex-col gap-2">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-6 w-1/2" />
          </div>
        ))}
      </div>

      <div className="card flex flex-col gap-3">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-24 w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="skeleton h-4 w-36" />
        {[0, 1].map((i) => (
          <div key={i} className="card flex flex-col gap-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
