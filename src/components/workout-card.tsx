import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { WorkoutWithSets } from "@/lib/workout-queries";
import { deleteWorkout } from "@/app/(app)/workouts/actions";
import { DeleteButton } from "./delete-button";

export function WorkoutCard({
  workout,
  deletable = false,
}: {
  workout: WorkoutWithSets;
  deletable?: boolean;
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
            <Link
              href={`/exercises/${g.exerciseId}`}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2 text-sm font-medium text-indigo-600 no-underline transition-colors hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-950/30 dark:focus-visible:outline-indigo-400 dark:active:bg-indigo-950/50"
            >
              <span className="min-w-0 break-words">
                {g.exerciseName}<span className="sr-only"> — ver evolução</span>
              </span>
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 shrink-0"
              >
                <path d="m9 5 7 7-7 7" />
              </svg>
            </Link>
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
