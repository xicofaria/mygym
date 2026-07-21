import Link from "next/link";
import { getExercisesWithStats, getPageContext } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { AddExercise } from "@/components/add-exercise";
import { fmtShortDate } from "@/lib/format";

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { viewed, isSelf, query } = await getPageContext(searchParams);
  const stats = await getExercisesWithStats(viewed.id);
  const tracked = stats.filter((s) => s.totalSets > 0);
  const untried = stats.filter((s) => s.totalSets === 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Exercícios"
        subtitle={
          isSelf
            ? "Toca num para veres a tua progressão"
            : `Exercícios de ${viewed.name}`
        }
      />

      {tracked.length > 0 && (
        <div className="flex flex-col gap-2">
          {tracked.map((s) => (
            <Link
              key={s.id}
              href={`/exercises/${s.id}${query}`}
              className="card flex items-center justify-between gap-3 active:scale-[0.99]"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {s.muscleGroup ? `${s.muscleGroup} · ` : ""}
                  {s.lastPerformed
                    ? `última em ${fmtShortDate(s.lastPerformed)}`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold">{s.bestWeight}kg</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    ~{s.best1RM}kg 1RM
                  </div>
                </div>
                <Chevron />
              </div>
            </Link>
          ))}
        </div>
      )}

      {tracked.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {isSelf
            ? "Ainda não há séries registadas. Regista um treino e os teus exercícios aparecem aqui com gráficos de progressão."
            : `${viewed.name} ainda não registou nenhuma série.`}
        </p>
      )}

      {untried.length > 0 && (
        <div>
          <p className="mb-2 mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Ainda não treinados
          </p>
          <div className="flex flex-wrap gap-2">
            {untried.map((s) => (
              <Link
                key={s.id}
                href={`/exercises/${s.id}${query}`}
                className="rounded-full bg-black/5 px-3 py-1.5 text-sm text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {isSelf && (
        <div className="mt-2">
          <AddExercise />
        </div>
      )}
    </div>
  );
}
