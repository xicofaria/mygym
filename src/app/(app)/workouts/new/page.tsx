import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getExerciseCatalog,
  getLastPerformanceByExercise,
  getLatestWorkoutForRepeat,
  getWorkoutTemplate,
  getWorkoutTemplates,
} from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { AddExercise } from "@/components/add-exercise";
import { readDateKey } from "@/lib/workout-calendar";

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    template?: string | string[];
    repeat?: string | string[];
    date?: string | string[];
  }>;
}) {
  const user = await requireUser();
  const { template: templateParam, repeat, date: dateParam } =
    await searchParams;
  const templateId = Number(templateParam);
  const shouldRepeat = repeat === "last";
  const initialDate = readDateKey(dateParam);

  const [catalog, templates, activeTemplate, repeatedWorkout, lastPerformance] =
    await Promise.all([
    getExerciseCatalog(),
    getWorkoutTemplates(user.id),
    !shouldRepeat && Number.isInteger(templateId) && templateId > 0
      ? getWorkoutTemplate(templateId, user.id)
      : Promise.resolve(null),
    shouldRepeat
      ? getLatestWorkoutForRepeat(user.id)
      : Promise.resolve(null),
    getLastPerformanceByExercise(user.id),
  ]);

  const exercises = catalog.map((e) => ({ id: e.id, name: e.name }));
  const initialRows =
    repeatedWorkout?.entries ??
    activeTemplate?.exercises.map((exercise) => ({
      exerciseId: exercise.id,
    }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={repeatedWorkout ? "Repetir último treino" : "Registar treino"}
        action={
          <Link href="/workouts" className="btn-ghost">
            Cancelar
          </Link>
        }
      />

      {templates.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Começar a partir de um modelo
            </p>
            <Link
              href="/workouts/templates"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400"
            >
              Gerir modelos
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/workouts/new"
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                !activeTemplate && !repeatedWorkout
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              }`}
            >
              Do zero
            </Link>
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/workouts/new?template=${t.id}`}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTemplate?.id === t.id
                    ? "bg-indigo-600 text-white"
                    : "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <WorkoutForm
        key={
          repeatedWorkout
            ? `repeat-${repeatedWorkout.id}`
            : (activeTemplate?.id ?? "blank")
        }
        exercises={exercises}
        initialRows={initialRows}
        initialDate={initialDate ?? undefined}
        lastPerformance={lastPerformance}
      />

      <div className="border-t border-black/5 pt-4 dark:border-white/10">
        <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Falta algum exercício?
        </p>
        <AddExercise />
        {templates.length === 0 && (
          <Link
            href="/workouts/templates"
            className="mt-2 block text-center text-xs font-medium text-indigo-600 dark:text-indigo-400"
          >
            + Criar um modelo de treino reutilizável
          </Link>
        )}
      </div>
    </div>
  );
}
