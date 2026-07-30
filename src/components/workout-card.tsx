import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { WorkoutWithSets } from "@/lib/queries";
import { deleteWorkout } from "@/app/(app)/workouts/actions";
import { DeleteButton } from "./delete-button";

/** Small trophy badge marking an exercise this session set a record for. */
function RecordBadge() {
  return (
    <span
      data-record
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
      title="Bateste o teu melhor anterior neste exercício"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 13v7" />
      </svg>
      Recorde
    </span>
  );
}

export function WorkoutCard({
  workout,
  deletable = false,
  recordExerciseIds,
}: {
  workout: WorkoutWithSets;
  deletable?: boolean;
  /** Exercises this session set a personal record for. */
  recordExerciseIds?: ReadonlySet<number>;
}) {
  return (
    <div className="card">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-semibold">{fmtDate(workout.date)}</span>
        {deletable && (
          <div className="flex items-center gap-1">
            <Link
              href={`/workouts/${workout.id}/edit`}
              className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              Editar
            </Link>
            <DeleteButton
              action={deleteWorkout}
              id={workout.id}
              confirmText="Eliminar este treino?"
            />
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2.5">
        {workout.groups.map((g) => (
          <li key={g.exerciseId}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{g.exerciseName}</span>
              {recordExerciseIds?.has(g.exerciseId) && <RecordBadge />}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              {g.sets.map((s, i) => (
                <span key={i}>
                  {s.reps}
                  <span className="text-zinc-400 dark:text-zinc-500">×</span>
                  {s.weight}kg
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {workout.notes && (
        <p className="mt-3 border-t border-black/5 pt-2 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {workout.notes}
        </p>
      )}
    </div>
  );
}
