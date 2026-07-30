import Link from "next/link";
import {
  getPageContext,
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
import { fmtDate } from "@/lib/format";
import {
  addUtcDays,
  dateFromKey,
  dateKey,
  readDateKey,
} from "@/lib/workout-calendar";
import {
  buildMonthCalendar,
  monthGridRange,
  monthKeyOf,
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
    monthKeyOf(new Date());
  const range = monthGridRange(monthKey);

  const [workouts, monthWorkoutDates, monthPlans, dayPlans, templates] =
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
    ]);

  const calendar = buildMonthCalendar(
    monthKey,
    monthWorkoutDates,
    monthPlans.map((plan) => plan.date),
  );
  const todayKey = dateKey(new Date());
  const canPlanSelectedDay =
    isSelf && selectedDate != null && selectedDate >= todayKey;
  const dayIsDone = workouts.length > 0;

  const ownerLabel = isSelf ? "Os teus treinos" : `Treinos de ${viewed.name}`;
  const registerHref = selectedDate
    ? `/workouts/new?date=${selectedDate}`
    : "/workouts/new";
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
      />

      {selectedDate && (dayPlans.length > 0 || canPlanSelectedDay) && (
        <section className="card flex flex-col gap-3">
          <h2 className="stat-label">
            Planos para {fmtDate(dateFromKey(selectedDate))}
          </h2>

          {dayPlans.map((plan) => (
            <div
              key={plan.id}
              data-plan-id={plan.id}
              className="flex items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {plan.template?.name ?? "Treino planeado"}
                </p>
                {plan.notes && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {plan.notes}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  dayIsDone
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : selectedDate < todayKey
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                }`}
              >
                {dayIsDone
                  ? "Concluído"
                  : selectedDate < todayKey
                    ? "Não realizado"
                    : "Planeado"}
              </span>
              {isSelf && !dayIsDone && (
                <Link
                  href={
                    plan.template
                      ? `/workouts/new?date=${selectedDate}&template=${plan.template.id}`
                      : registerHref
                  }
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
          ))}

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
            <WorkoutCard key={w.id} workout={w} deletable={isSelf} />
          ))}
        </div>
      )}
    </div>
  );
}
