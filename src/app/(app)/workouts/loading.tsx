/** Mirrors /workouts: header with actions, month grid, session cards. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar os teus treinos…</span>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-7 w-36" />
          <div className="skeleton h-4 w-52" />
        </div>
        <div className="skeleton h-10 w-24 rounded-xl" />
      </div>

      <div className="card flex flex-col gap-3">
        <div className="skeleton h-4 w-28" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="skeleton aspect-square w-full" />
          ))}
        </div>
      </div>

      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex flex-col gap-2">
          <div className="skeleton h-4 w-2/5" />
          <div className="skeleton h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
