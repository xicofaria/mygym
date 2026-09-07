import {
  getExercisesWithStats,
  getFavoriteExerciseIds,
} from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AddExercise } from "@/components/add-exercise";
import { ExerciseCatalog } from "@/components/exercise-catalog";

export default async function ExercisesPage() {
  const me = await requireUser();
  const [exercises, favoriteIds] = await Promise.all([
    getExercisesWithStats(me.id),
    getFavoriteExerciseIds(),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Exercícios"
        subtitle="Encontra um exercício e acompanha a tua progressão"
      />
      <ExerciseCatalog exercises={exercises} favoriteIds={favoriteIds} isSelf />
      <AddExercise />
    </div>
  );
}
