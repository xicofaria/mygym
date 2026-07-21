import { fmtDate } from "@/lib/format";
import type { WorkoutWithSets } from "@/lib/queries";
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
          <DeleteButton
            action={deleteWorkout}
            id={workout.id}
            confirmText="Eliminar este treino?"
          />
        )}
      </div>

      <ul className="flex flex-col gap-2.5">
        {workout.groups.map((g) => (
          <li key={g.exerciseId}>
            <div className="text-sm font-medium">{g.exerciseName}</div>
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
