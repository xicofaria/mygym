import Link from "next/link";
import { getPageContext, getWorkouts } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";
import { fmtDate } from "@/lib/format";
import { dateFromKey, readDateKey } from "@/lib/workout-calendar";

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string | string[];
    date?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const { viewed, isSelf, query } = await getPageContext(
    Promise.resolve(params),
  );
  const selectedDate = readDateKey(params.date);
  const workouts = await getWorkouts(
    viewed.id,
    undefined,
    selectedDate ? dateFromKey(selectedDate) : undefined,
  );
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
