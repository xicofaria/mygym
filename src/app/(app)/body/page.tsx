import { getBodyMetrics, getPageContext } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { ProgressChart } from "@/components/progress-chart";
import { BodyMetricForm } from "@/components/body-metric-form";
import { DeleteButton } from "@/components/delete-button";
import { fmtDate } from "@/lib/format";
import { deleteBodyMetric } from "./actions";

const MEASURE_DEFS = [
  { key: "waistCm", name: "Cintura", color: "#4f46e5" },
  { key: "chestCm", name: "Peito", color: "#059669" },
  { key: "armCm", name: "Braço", color: "#db2777" },
  { key: "thighCm", name: "Coxa", color: "#d97706" },
  { key: "hipCm", name: "Anca", color: "#0891b2" },
] as const;

type MetricRow = Awaited<ReturnType<typeof getBodyMetrics>>[number];

function summary(m: MetricRow): string {
  const parts: string[] = [];
  if (m.weightKg != null) parts.push(`${m.weightKg} kg`);
  if (m.bodyFatPct != null) parts.push(`${m.bodyFatPct}% gordura`);
  if (m.waistCm != null) parts.push(`cintura ${m.waistCm}`);
  if (m.chestCm != null) parts.push(`peito ${m.chestCm}`);
  if (m.armCm != null) parts.push(`braço ${m.armCm}`);
  if (m.thighCm != null) parts.push(`coxa ${m.thighCm}`);
  if (m.hipCm != null) parts.push(`anca ${m.hipCm}`);
  if (m.heightCm != null) parts.push(`altura ${m.heightCm}`);
  return parts.join(" · ");
}

export default async function BodyPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { viewed, isSelf } = await getPageContext(searchParams);
  const metrics = await getBodyMetrics(viewed.id); // newest first
  const asc = [...metrics].reverse();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const weightSeries = asc
    .filter((m) => m.weightKg != null)
    .map((m) => ({ date: iso(m.date), weightKg: m.weightKg }));

  const activeMeasures = MEASURE_DEFS.filter((d) =>
    asc.some((m) => m[d.key] != null),
  );
  const measureData = asc.map((m) => ({
    date: iso(m.date),
    waistCm: m.waistCm,
    chestCm: m.chestCm,
    armCm: m.armCm,
    thighCm: m.thighCm,
    hipCm: m.hipCm,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Corpo"
        subtitle={
          isSelf
            ? "Peso e medidas ao longo do tempo"
            : `Medidas de ${viewed.name}`
        }
      />

      {isSelf && <BodyMetricForm />}

      {metrics.length === 0 ? (
        <EmptyState
          title="Ainda não há medidas"
          hint={
            isSelf
              ? "Adiciona o teu peso e quaisquer medidas de fita para veres a tua evolução."
              : `${viewed.name} ainda não adicionou medidas.`
          }
        />
      ) : (
        <>
          {weightSeries.length >= 2 && (
            <div className="card">
              <div className="stat-label mb-1">Peso corporal</div>
              <ProgressChart
                data={weightSeries}
                lines={[{ key: "weightKg", name: "Peso" }]}
                unit=" kg"
              />
            </div>
          )}

          {activeMeasures.length > 0 && asc.length >= 2 && (
            <div className="card">
              <div className="stat-label mb-1">Medidas (cm)</div>
              <ProgressChart
                data={measureData}
                unit=" cm"
                lines={activeMeasures.map((d) => ({
                  key: d.key,
                  name: d.name,
                  color: d.color,
                }))}
              />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {activeMeasures.map((d) => (
                  <span
                    key={d.key}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: d.color }}
                    />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Histórico
            </h2>
            <div className="flex flex-col gap-2">
              {metrics.map((m) => (
                <div
                  key={m.id}
                  className="card flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{fmtDate(m.date)}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {summary(m) || "—"}
                    </div>
                    {m.notes && (
                      <div className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                        {m.notes}
                      </div>
                    )}
                  </div>
                  {isSelf && (
                    <DeleteButton
                      action={deleteBodyMetric}
                      id={m.id}
                      confirmText="Eliminar esta medição?"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
