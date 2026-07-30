import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getExerciseCatalog,
  getLastPerformanceByExercise,
  getLatestWorkoutForRepeat,
  getPlannedWorkout,
  getWorkoutTemplate,
  getWorkoutTemplates,
} from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { AddExercise } from "@/components/add-exercise";
import { dateKey, readDateKey } from "@/lib/workout-calendar";

function readPositiveInteger(
  value: string | string[] | undefined,
): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d+$/.test(candidate)) return null;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    template?: string | string[];
    repeat?: string | string[];
    date?: string | string[];
    plan?: string | string[];
  }>;
}) {
  const user = await requireUser();
  const {
    template: templateParam,
    repeat,
    date: dateParam,
    plan: planParam,
  } = await searchParams;
  const templateId = readPositiveInteger(templateParam);
  const plannedWorkoutId = readPositiveInteger(planParam);
  const shouldRepeat = repeat === "last";
  const requestedDate = readDateKey(dateParam);

  const linkedPlan = plannedWorkoutId
    ? await getPlannedWorkout(plannedWorkoutId, user.id)
    : null;
  const initialDate = linkedPlan ? dateKey(linkedPlan.date) : requestedDate;

  const [catalog, templates, activeTemplate, repeatedWorkout, lastPerformance] =
    await Promise.all([
      getExerciseCatalog(),
      getWorkoutTemplates(user.id),
      !shouldRepeat && templateId != null
        ? getWorkoutTemplate(templateId, user.id)
        : Promise.resolve(null),
      shouldRepeat
        ? getLatestWorkoutForRepeat(user.id)
        : Promise.resolve(null),
      getLastPerformanceByExercise(user.id),
    ]);

  if (
    plannedWorkoutId != null &&
    (!linkedPlan || linkedPlan.workoutId != null)
  ) {
    const completed = linkedPlan?.workoutId != null;
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Registar treino" />
        <EmptyState
          title={
            completed ? "Este plano já foi concluído" : "Plano não encontrado"
          }
          hint={
            completed
              ? "Cada plano só pode ficar associado a uma sessão."
              : "O plano pode ter sido removido ou pertencer a outra conta."
          }
          href="/workouts"
          cta="Voltar aos treinos"
        />
      </div>
    );
  }

  function workoutHref(nextTemplateId?: number): string {
    const params = new URLSearchParams();
    if (initialDate) params.set("date", initialDate);
    if (linkedPlan) params.set("plan", String(linkedPlan.id));
    if (nextTemplateId != null) params.set("template", String(nextTemplateId));
    const query = params.toString();
    return query ? `/workouts/new?${query}` : "/workouts/new";
  }

  const exercises = catalog.map((e) => ({ id: e.id, name: e.name }));
  const initialRows =
    repeatedWorkout?.entries ??
    activeTemplate?.exercises.map((exercise) => ({
      exerciseId: exercise.id,
    }));

  /**
   * Drafts are scoped to what the URL asked for. Without this, a draft left on
   * the blank form restores over an explicit prefill — silently saving a
   * planned session on today's date instead of the day it was planned for.
   */
  const draftScope = [
    initialDate ? `date:${initialDate}` : null,
    linkedPlan ? `plan:${linkedPlan.id}` : null,
    activeTemplate ? `tpl:${activeTemplate.id}` : null,
    repeatedWorkout ? "repeat" : null,
  ]
    .filter(Boolean)
    .join("|");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={repeatedWorkout ? "Repetir último treino" : "Registar treino"}
        action={
          <Link
            href={initialDate ? `/workouts?date=${initialDate}` : "/workouts"}
            className="btn-ghost"
          >
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
              href={workoutHref()}
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
                href={workoutHref(t.id)}
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
            : `${linkedPlan?.id ?? "free"}-${activeTemplate?.id ?? "blank"}`
        }
        userId={user.id}
        exercises={exercises}
        initialRows={initialRows}
        initialDate={initialDate ?? undefined}
        draftScope={draftScope}
        lastPerformance={lastPerformance}
        plannedWorkoutId={linkedPlan?.id}
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
