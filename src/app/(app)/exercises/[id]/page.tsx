import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getExerciseProgression } from "@/lib/queries";
import { PageHeader, StatCard } from "@/components/ui";
import { ProgressChart } from "@/components/progress-chart";
import { fmtDate } from "@/lib/format";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const exerciseId = Number(id);
  const { exercise, points } = await getExerciseProgression(
    exerciseId,
    (await requireUser()).id,
  );
  if (!exercise) notFound();

  const bestWeight = points.reduce((m, p) => Math.max(m, p.maxWeight), 0);
  const best1RM = points.reduce((m, p) => Math.max(m, p.best1RM), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={exercise.name}
        subtitle="A tua progressão"
        action={
          <Link href="/exercises" className="btn-ghost">
            Voltar
          </Link>
        }
      />

      {points.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ainda não há séries registadas para este exercício. Regista um treino
          que o inclua para veres a tua progressão.
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
