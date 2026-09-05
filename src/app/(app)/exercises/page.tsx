import {
  getExercisesWithStats,
  getFavoriteExerciseIds,
  getPageContext,
} from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { AddExercise } from "@/components/add-exercise";
import { ExerciseCatalog } from "@/components/exercise-catalog";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { viewed, isSelf, query } = await getPageContext(searchParams);
  const [exercises, favoriteIds] = await Promise.all([
    getExercisesWithStats(viewed.id),
    isSelf ? getFavoriteExerciseIds() : Promise.resolve([]),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Exercícios"
        subtitle={
          isSelf
            ? "Encontra um exercício e acompanha a tua progressão"
            : `Exercícios de ${viewed.name}`
        }
      />
      <ExerciseCatalog
        exercises={exercises}
        favoriteIds={favoriteIds}
        isSelf={isSelf}
        query={query}
      />
      {isSelf && <AddExercise />}
    </div>
  );
}
