import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { requireUser } from "@/lib/auth";
import {
  getExerciseCatalog,
  getLastPerformanceByExercise,
  getWorkoutForEdit,
} from "@/lib/queries";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const workoutId = Number(id);
  if (!Number.isInteger(workoutId) || workoutId <= 0) notFound();

  const [workout, catalog, lastPerformance] = await Promise.all([
    getWorkoutForEdit(workoutId, user.id),
    getExerciseCatalog(),
    getLastPerformanceByExercise(user.id),
  ]);
  if (!workout) notFound();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Editar treino"
        subtitle="Corrige as séries sem perder o restante histórico."
        action={
          <Link href="/workouts" className="btn-ghost">
            Cancelar
          </Link>
        }
      />

      <WorkoutForm
        userId={user.id}
        workoutId={workout.id}
        exercises={catalog.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
        }))}
        initialDate={workout.date}
        initialNotes={workout.notes}
        initialRows={workout.entries}
        lastPerformance={lastPerformance}
      />
    </div>
  );
}
