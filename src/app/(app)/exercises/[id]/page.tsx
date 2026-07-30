import Link from "next/link";
import { notFound } from "next/navigation";
import { getExerciseProgression, getPageContext } from "@/lib/queries";
import { PageHeader, StatCard } from "@/components/ui";
import { ProgressChart } from "@/components/progress-chart";
import { fmtDate } from "@/lib/format";

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ user?: string }>;
}) {
  const { id } = await params;
  const exerciseId = Number(id);
  const { viewed, isSelf, query } = await getPageContext(searchParams);
  const { exercise, points } = await getExerciseProgression(
    exerciseId,
    viewed.id,
  );
  if (!exercise) notFound();

  const bestWeight = points.reduce((m, p) => Math.max(m, p.maxWeight), 0);
  const best1RM = points.reduce((m, p) => Math.max(m, p.best1RM), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={exercise.name}
        subtitle={isSelf ? "A tua progressão" : `Progressão de ${viewed.name}`}
        action={
          <Link href={`/exercises${query}`} className="btn-ghost">
            Voltar
          </Link>
        }
      />

      {points.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {isSelf
            ? "Ainda não há séries registadas para este exercício. Regista um treino que o inclua para veres a tua progressão."
            : `${viewed.name} ainda não registou este exercício.`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Melhor série" value={`${bestWeight}kg`} />
            <StatCard label="1RM estimado" value={`${best1RM}kg`} />
            <StatCard label="Sessões" value={points.length} />
          </div>

          <div className="card">
            <div className="stat-label mb-1">Peso máximo e 1RM estimado</div>
            <ProgressChart
              data={points}
              unit="kg"
              lines={[
                { key: "maxWeight", name: "Peso máximo" },
                { key: "best1RM", name: "1RM estimado", color: "#059669" },
              ]}
            />
          </div>

          <div className="card">
            <div className="stat-label mb-1">Volume por sessão</div>
            <ProgressChart
              data={points}
              unit="kg"
              lines={[{ key: "volume", name: "Volume", color: "#db2777" }]}
              height={160}
            />
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Histórico
            </h2>
            <div className="card divide-y divide-black/5 p-0 dark:divide-white/10">
              {[...points].reverse().map((p) => (
                <div
                  key={p.workoutId}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {fmtDate(p.date)}
                  </span>
                  <span className="font-medium">{p.topSet}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {p.volume.toLocaleString()}kg vol.
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
