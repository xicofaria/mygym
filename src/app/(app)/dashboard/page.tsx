import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/queries";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";
import { ProgressChart } from "@/components/progress-chart";
import { WorkoutCalendar } from "@/components/workout-calendar";

export default async function DashboardPage() {
  const me = await requireUser();
  const data = await getDashboard(me.id);

  const weightSub =
    data.weightChange == null ? (
      "ainda sem alterações"
    ) : (
      <span
        className={
          data.weightChange <= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400"
        }
      >
        {data.weightChange > 0 ? "+" : ""}
        {data.weightChange} kg desde a última
      </span>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="O teu progresso"
        subtitle="Um resumo rápido de como estás a evoluir."
        action={
          <Link href="/workouts/new" className="btn-primary">
            + Registar
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Treinos esta semana" value={data.workoutsThisWeek} />
        <StatCard
          label="Volume esta semana"
          value={`${data.volumeThisWeek.toLocaleString()} kg`}
          sub="peso × repetições"
        />
        <StatCard
          label="Peso corporal"
          value={data.latestWeight != null ? `${data.latestWeight} kg` : "—"}
          sub={weightSub}
        />
        <StatCard label="Total de treinos" value={data.totalWorkouts} />
      </div>

      <WorkoutCalendar calendar={data.calendar} />

      {data.weightSeries.length >= 2 && (
        <div className="card">
          <div className="stat-label mb-1">Evolução do peso</div>
          <ProgressChart
            data={data.weightSeries}
            lines={[{ key: "weightKg", name: "Peso" }]}
            unit=" kg"
            height={200}
          />
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Treinos recentes
          </h2>
          {data.recent.length > 0 && (
            <Link
              href="/workouts"
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
            >
              Ver todos
            </Link>
          )}
        </div>

        {data.recent.length === 0 ? (
          <EmptyState
            title="Ainda não há treinos registados"
            hint="Regista a tua primeira sessão para começares a acompanhar o teu progresso."
            href="/workouts/new"
            cta="Registar treino"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {data.recent.map((w) => (
              <WorkoutCard key={w.id} workout={w} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
