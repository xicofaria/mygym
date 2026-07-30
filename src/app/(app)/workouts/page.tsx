import Link from "next/link";
import {
  getPageContext,
  getPersonalRecords,
  getPlannedWorkouts,
  getWorkoutDatesInRange,
  getWorkoutTemplates,
  getWorkouts,
} from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";
import { MonthCalendar } from "@/components/month-calendar";
import { PlanWorkoutForm } from "@/components/plan-workout-form";
import { DeleteButton } from "@/components/delete-button";
import { deletePlannedWorkout } from "./actions";
import { fmtDate, lisbonDateKey, lisbonMonthKey } from "@/lib/format";
import { formatGroupNames } from "@/lib/muscle-groups";
import { suggestTemplates } from "@/lib/template-match";
import {
  addUtcDays,
  dateFromKey,
  readDateKey,
} from "@/lib/workout-calendar";
import {
  aggregatePlanLabels,
  buildMonthCalendar,
  monthGridRange,
  readMonthKey,
} from "@/lib/month-calendar";

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string | string[];
    date?: string | string[];
    month?: string | string[];
  }>;
}) {
  const [{ me, viewed, isSelf, query }, params] = await Promise.all([
    getPageContext(searchParams),
    searchParams,
  ]);
  const selectedDate = readDateKey(params.date);
  const monthKey =
    readMonthKey(params.month) ??
    selectedDate?.slice(0, 7) ??
    lisbonMonthKey();
  const range = monthGridRange(monthKey);

  const [workouts, monthWorkoutDates, monthPlans, dayPlans, templates, records] =
    await Promise.all([
      getWorkouts(
        viewed.id,
        undefined,
        selectedDate ? dateFromKey(selectedDate) : undefined,
      ),
      getWorkoutDatesInRange(
        viewed.id,
        dateFromKey(range.from),
        dateFromKey(range.to),
      ),
      getPlannedWorkouts(
        viewed.id,
        dateFromKey(range.from),
        dateFromKey(range.to),
      ),
      selectedDate
        ? getPlannedWorkouts(
            viewed.id,
            dateFromKey(selectedDate),
            addUtcDays(dateFromKey(selectedDate), 1),
          )
        : Promise.resolve([]),
      isSelf ? getWorkoutTemplates(me.id) : Promise.resolve([]),
      getPersonalRecords(viewed.id),
    ]);

  const calendar = buildMonthCalendar(
    monthKey,
    monthWorkoutDates,
    monthPlans.map((plan) => plan.date),
  );
  const todayKey = lisbonDateKey();
  const canPlanSelectedDay =
    isSelf && selectedDate != null && selectedDate >= todayKey;

  const ownerLabel = isSelf ? "Os teus treinos" : `Treinos de ${viewed.name}`;
  const registerHref = selectedDate
    ? `/workouts/new?date=${selectedDate}`
    : "/workouts/new";
  const planLabels = aggregatePlanLabels(
    monthPlans.map((plan) => ({
      date: plan.date.toISOString().slice(0, 10),
      label:
        plan.groups.length > 0
          ? formatGroupNames(plan.groups)
          : (plan.template?.name ?? "Treino planeado"),
    })),
  );
  const showActions = isSelf || selectedDate != null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Treinos"
        subtitle={
          selectedDate
            ? `${ownerLabel} em ${fmtDate(dateFromKey(selectedDate))}`
            : isSelf
              ? "O teu registo de treinos"
              : `Registo de treinos de ${viewed.name}`
        }
        action={
          showActions ? (
            <div className="flex flex-wrap justify-end gap-2">
              {selectedDate && (
                <Link href={`/workouts${query}`} className="btn-ghost">
                  Ver todos
                </Link>
              )}
              {isSelf && (
                <Link href="/workouts/routine" className="btn-ghost">
                  Rotina
                </Link>
              )}
              {isSelf && workouts.length > 0 && (
                <Link
                  href="/workouts/new?repeat=last"
                  className="btn-ghost"
                >
                  Repetir último
                </Link>
              )}
              {isSelf && (
                <Link href={registerHref} className="btn-primary">
                  + Registar
                </Link>
              )}
            </div>
          ) : undefined
        }
      />

      <MonthCalendar
        calendar={calendar}
        selectedDate={selectedDate}
        viewedUserId={isSelf ? undefined : viewed.id}
        planLabels={planLabels}
      />

      {selectedDate && (dayPlans.length > 0 || canPlanSelectedDay) && (
        <section className="card flex flex-col gap-3">
          <h2 className="stat-label">
            Planos para {fmtDate(dateFromKey(selectedDate))}
          </h2>

          {dayPlans.map((plan) => {
            const isDone = plan.workoutId != null;
            const registrationParams = new URLSearchParams({
              date: selectedDate,
              plan: String(plan.id),
            });
            if (plan.template) {
              registrationParams.set("template", String(plan.template.id));
            }
            // A day planned by muscle group has no exercises attached, so
            // offer the saved templates that train it.
            const suggestions =
              isSelf && !isDone && !plan.template
                ? suggestTemplates(plan.groups, templates)
                : [];
            return (
              <div
                key={plan.id}
                data-plan-id={plan.id}
                className="flex items-start gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pretty">
                    {plan.groups.length > 0
                      ? formatGroupNames(plan.groups)
                      : (plan.template?.name ?? "Treino planeado")}
                  </p>
                  {(plan.notes ||
                    (plan.groups.length > 0 && plan.template)) && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {[
                        plan.groups.length > 0 ? plan.template?.name : null,
                        plan.notes,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {suggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        Começar de:
                      </span>
                      {suggestions.map(({ template }) => {
                        const params = new URLSearchParams(registrationParams);
                        params.set("template", String(template.id));
                        return (
                          <Link
                            key={template.id}
                            href={`/workouts/new?${params.toString()}`}
                            className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-400"
                            data-template-suggestion={template.id}
                          >
                            {template.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isDone
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : selectedDate < todayKey
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                  }`}
                >
                  {isDone
                    ? "Concluído"
                    : selectedDate < todayKey
                      ? "Não realizado"
                      : "Planeado"}
                </span>
                {isSelf && !isDone && (
                  <Link
                    href={`/workouts/new?${registrationParams.toString()}`}
                    className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                  >
                    Registar
                  </Link>
                )}
                {isSelf && (
                  <DeleteButton
                    action={deletePlannedWorkout}
                    id={plan.id}
                    confirmText="Remover este plano?"
                  />
                )}
              </div>
            );
          })}

          {canPlanSelectedDay && (
            <PlanWorkoutForm
              date={selectedDate}
              templates={templates.map((template) => ({
                id: template.id,
                name: template.name,
              }))}
            />
          )}
        </section>
      )}

      {workouts.length === 0 ? (
        <EmptyState
          title={selectedDate ? "Sem treinos neste dia" : "Ainda não há treinos"}
          hint={
            selectedDate
              ? isSelf
                ? "Podes registar uma sessão nesta data ou voltar ao histórico completo."
                : `${viewed.name} não tem treinos registados nesta data.`
              : isSelf
              ? "Toca em + Registar para gravares a tua primeira sessão."
              : `${viewed.name} ainda não registou nenhum treino.`
          }
          href={isSelf ? registerHref : undefined}
          cta={isSelf ? "Registar treino" : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {workouts.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              deletable={isSelf}
              recordExerciseIds={records.get(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
