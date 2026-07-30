import Link from "next/link";
import { getBodyMetrics, getPageContext } from "@/lib/queries";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ProgressChart } from "@/components/progress-chart";
import { BodyMetricForm } from "@/components/body-metric-form";
import { BodyHistoryTable } from "@/components/body-history-table";
import { DeltaBadge } from "@/components/body-delta";
import { Sparkline } from "@/components/sparkline";
import { deleteBodyMetric } from "./actions";
import {
  BODY_RANGES,
  BODY_RANGE_LABELS,
  DEFAULT_BODY_RANGE,
  buildBodyProgress,
  deltaTone,
  readBodyFieldKey,
  readBodyRange,
  type BodyFieldKey,
  type BodyFieldProgress,
  type BodyRange,
} from "@/lib/body-progress";

/** Tape measurements get their own explorable grid; weight and body fat lead the summary. */
const TAPE_KEYS: readonly BodyFieldKey[] = [
  "waistCm",
  "chestCm",
  "armCm",
  "thighCm",
  "hipCm",
];

const CHART_COLORS: Record<BodyFieldKey, string> = {
  weightKg: "#4f46e5",
  bodyFatPct: "#7c3aed",
  waistCm: "#4f46e5",
  chestCm: "#059669",
  armCm: "#db2777",
  thighCm: "#d97706",
  hipCm: "#0891b2",
};

const SPARKLINE_TONES = {
  good: "text-emerald-500",
  bad: "text-amber-500",
  neutral: "text-indigo-400 dark:text-indigo-500",
} as const;

function bodyHref(params: {
  user?: number;
  range: BodyRange;
  measure?: BodyFieldKey | null;
}): string {
  const search = new URLSearchParams();
  if (params.user != null) search.set("user", String(params.user));
  if (params.range !== DEFAULT_BODY_RANGE) search.set("range", params.range);
  if (params.measure) search.set("measure", params.measure);
  const query = search.toString();
  return query ? `/body?${query}` : "/body";
}

function MeasureCard({
  field,
  href,
  isSelected,
}: {
  field: BodyFieldProgress;
  href: string;
  isSelected: boolean;
}) {
  const tone = deltaTone(field.delta, field.goal);
  return (
    <Link
      href={href}
      aria-current={isSelected ? "true" : undefined}
      className={`card flex flex-col gap-1 transition-colors hover:border-indigo-400 dark:hover:border-indigo-500 ${
        isSelected ? "ring-2 ring-indigo-500 dark:ring-indigo-400" : ""
      }`}
    >
      <span className="stat-label">{field.label}</span>
      <span className="text-lg font-bold tracking-tight tabular-nums">
        {field.latest}
        <span className="ml-1 text-xs font-medium text-zinc-400">
          {field.unit}
        </span>
      </span>
      <DeltaBadge
        delta={field.delta}
        goal={field.goal}
        unit={field.unit}
        className="text-xs"
      />
      <Sparkline
        values={field.points.map((point) => point.value)}
        className={`mt-1 ${SPARKLINE_TONES[tone]}`}
      />
    </Link>
  );
}

export default async function BodyPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string | string[];
    range?: string | string[];
    measure?: string | string[];
  }>;
}) {
  const [{ viewed, isSelf }, params] = await Promise.all([
    getPageContext(searchParams),
    searchParams,
  ]);
  const range = readBodyRange(params.range);
  const metrics = await getBodyMetrics(viewed.id);
  const progress = buildBodyProgress(metrics, range);

  const userParam = isSelf ? undefined : viewed.id;
  const field = (key: BodyFieldKey) =>
    progress.fields.find((entry) => entry.key === key);
  const weight = field("weightKg");
  const bodyFat = field("bodyFatPct");
  const tapeFields = TAPE_KEYS.map(field).filter(
    (entry): entry is BodyFieldProgress => entry != null,
  );

  const requested = readBodyFieldKey(params.measure);
  const selected = requested ? field(requested) : undefined;
  const rangeLabel = BODY_RANGE_LABELS[range].toLowerCase();
  const emptyRange = metrics.length > 0 && progress.measurementCount === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Corpo"
        subtitle={
          isSelf
            ? "A tua evolução em peso e medidas"
            : `Evolução de ${viewed.name}`
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
          <div
            className="flex gap-1.5 overflow-x-auto"
            role="group"
            aria-label="Período"
          >
            {BODY_RANGES.map((option) => {
              const active = option === range;
              return (
                <Link
                  key={option}
                  href={bodyHref({
                    user: userParam,
                    range: option,
                    measure: selected?.key,
                  })}
                  aria-current={active ? "true" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-indigo-600 text-white dark:bg-indigo-500"
                      : "bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
                  }`}
                >
                  {BODY_RANGE_LABELS[option]}
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Peso"
              value={weight ? `${weight.latest} kg` : "—"}
              sub={
                weight && (
                  <DeltaBadge
                    delta={weight.delta}
                    goal={weight.goal}
                    unit="kg"
                  />
                )
              }
            />
            <StatCard
              label="Gordura corporal"
              value={bodyFat ? `${bodyFat.latest} %` : "—"}
              sub={
                bodyFat ? (
                  <DeltaBadge
                    delta={bodyFat.delta}
                    goal={bodyFat.goal}
                    unit="pp"
                  />
                ) : (
                  "ainda sem registo"
                )
              }
            />
            <StatCard
              label="IMC"
              value={progress.bmi ?? "—"}
              sub={
                progress.heightCm
                  ? `altura ${progress.heightCm} cm`
                  : "adiciona a altura para calcular"
              }
            />
            <StatCard
              label="Medições"
              value={progress.measurementCount}
              sub={
                range === "all"
                  ? "desde sempre"
                  : `nos últimos ${rangeLabel}`
              }
            />
          </div>

          {emptyRange && (
            <div className="card flex flex-col items-start gap-2 text-sm">
              <p className="text-zinc-500 dark:text-zinc-400">
                Sem medições nos últimos {rangeLabel}. Os valores acima são os
                mais recentes que registaste.
              </p>
              <Link
                href={bodyHref({
                  user: userParam,
                  range: "all",
                  measure: selected?.key,
                })}
                className="btn-ghost"
              >
                Ver tudo
              </Link>
            </div>
          )}

          {weight && weight.points.length >= 2 && (
            <div className="card">
              <div className="stat-label mb-1">Evolução do peso</div>
              <ProgressChart
                data={weight.points}
                lines={[
                  {
                    key: "value",
                    name: "Peso",
                    color: CHART_COLORS.weightKg,
                  },
                ]}
                unit=" kg"
              />
            </div>
          )}

          {tapeFields.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                Medidas
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {tapeFields.map((entry) => (
                  <MeasureCard
                    key={entry.key}
                    field={entry}
                    isSelected={selected?.key === entry.key}
                    href={bodyHref({
                      user: userParam,
                      range,
                      measure:
                        selected?.key === entry.key ? undefined : entry.key,
                    })}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                Toca numa medida para veres o gráfico completo.
              </p>
            </section>
          )}

          {selected && (
            <div className="card">
              <div className="stat-label mb-1">
                {selected.label} ({selected.unit})
              </div>
              {selected.points.length >= 2 ? (
                <ProgressChart
                  data={selected.points}
                  lines={[
                    {
                      key: "value",
                      name: selected.label,
                      color: CHART_COLORS[selected.key],
                    },
                  ]}
                  unit={` ${selected.unit}`}
                />
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Ainda só há uma medição desta medida — regista outra para
                  veres a evolução.
                </p>
              )}
            </div>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Histórico
            </h2>
            {progress.history.length === 0 ? (
              <EmptyState
                title={`Sem medições nos últimos ${rangeLabel}`}
                hint="Escolhe um período maior para veres o histórico."
              />
            ) : (
              <BodyHistoryTable
                rows={progress.history}
                fields={progress.fields}
                isSelf={isSelf}
                deleteAction={deleteBodyMetric}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
