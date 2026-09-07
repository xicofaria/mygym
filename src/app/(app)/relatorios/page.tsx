import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getWeeklyReportData,
  previousLisbonWeekRange,
} from "@/lib/queries";
import { currentLisbonWeekRange } from "@/lib/dashboard-metrics";
import { calculateWeeklyReport } from "@/lib/weekly-report";
import { fmtDate, lisbonDateKey } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Relatório semanal — Gym Tracker" };

function weekRange(week: "atual" | "anterior") {
  return week === "atual"
    ? currentLisbonWeekRange()
    : previousLisbonWeekRange();
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string | string[] }>;
}) {
  const me = await requireUser();
  const params = await searchParams;
  const week = (Array.isArray(params.semana) ? params.semana[0] : params.semana) === "atual"
    ? "atual"
    : "anterior";
  const { from, to } = weekRange(week);
  const report = calculateWeeklyReport(
    await getWeeklyReportData(me.id, from, to),
  );

  const fromLabel = fmtDate(from);
  const toLabel = fmtDate(new Date(to.getTime() - 24 * 60 * 60 * 1000));
  const otherHref = `/relatorios?semana=${week === "atual" ? "anterior" : "atual"}`;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <PageHeader
        title="Relatório semanal"
        subtitle={`${fromLabel} — ${toLabel}`}
        action={
          <Link href={otherHref} className="btn-ghost">
            {week === "atual" ? "Semana passada" : "Esta semana"}
          </Link>
        }
      />

      {report.workouts === 0 && report.kcalRecordedDays === 0 ? (
        <EmptyState
          title="Sem registos nesta semana"
          hint="Regista treinos ou calorias para veres o teu resumo semanal."
          href={week === "anterior" ? undefined : "/workouts/new"}
          cta={week === "anterior" ? undefined : "Registar treino"}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Treinos" value={report.workouts} />
            <StatCard
              label="Volume"
              value={`${report.volume.toLocaleString()} kg`}
              sub={`${report.sets} séries`}
            />
            <StatCard
              label="Calorias/dia"
              value={
                report.kcalAvg != null ? `${report.kcalAvg} kcal` : "—"
              }
              sub={
                report.goalKcal != null
                  ? `meta ${report.goalKcal} kcal`
                  : "sem meta definida"
              }
            />
            <StatCard
              label="Dias na meta"
              value={`${report.daysWithinGoal}`}
              sub={`${report.daysCompleted} concluídos`}
            />
          </div>

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Recordes batidos
            </h2>
            {report.prs.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum recorde esta semana. Continua!
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.prs.map((pr) => (
                  <li
                    key={pr.exercise}
                    className="card flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{pr.exercise}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {pr.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {report.weightChange != null && (
            <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
              Peso:{" "}
              <span
                className={
                  report.weightChange <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {report.weightChange > 0 ? "+" : ""}
                {report.weightChange} kg na semana
              </span>
            </p>
          )}

          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
            Semana de {fromLabel} a {toLabel} (fuso de Lisboa). Um dia conta
            como «na meta» só quando foi explicitamente concluído.
          </p>
        </>
      )}
    </main>
  );
}
