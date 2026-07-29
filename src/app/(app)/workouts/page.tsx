import Link from "next/link";
import { getPageContext, getWorkouts } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { viewed, isSelf } = await getPageContext(searchParams);
  const workouts = await getWorkouts(viewed.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Treinos"
        subtitle={
          isSelf ? "O teu registo de treinos" : `Registo de treinos de ${viewed.name}`
        }
        action={
          isSelf ? (
            <div className="flex gap-2">
              {workouts.length > 0 && (
                <Link href="/workouts/new?repeat=last" className="btn-ghost">
                  Repetir último
                </Link>
              )}
              <Link href="/workouts/new" className="btn-primary">
                + Registar
              </Link>
            </div>
          ) : undefined
        }
      />

      {workouts.length === 0 ? (
        <EmptyState
          title="Ainda não há treinos"
          hint={
            isSelf
              ? "Toca em + Registar para gravares a tua primeira sessão."
              : `${viewed.name} ainda não registou nenhum treino.`
          }
          href={isSelf ? "/workouts/new" : undefined}
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
