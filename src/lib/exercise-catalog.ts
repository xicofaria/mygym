import { z } from "zod";
import { formatMuscleGroup } from "./muscle-groups";

export const EQUIPMENT = [
  "Máquina",
  "Polia / cabo",
  "Barra",
  "Halteres",
  "Peso corporal",
  "Outro",
] as const;
export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  muscleGroup: z.string().trim().max(40).optional(),
  aliases: z.string().trim().max(300).optional(),
  equipment: z.enum(["", ...EQUIPMENT]).optional(),
});
export type SearchableExercise = {
  id: number;
  name: string;
  muscleGroup?: string | null;
  aliases?: string;
  equipment?: string;
};
const STARTER_METADATA: Record<string, { aliases: string; equipment: string }> =
  {
    "Bench Press": { aliases: "Supino, Supino com barra", equipment: "Barra" },
    "Incline Dumbbell Press": {
      aliases: "Supino inclinado com halteres",
      equipment: "Halteres",
    },
    Squat: { aliases: "Agachamento", equipment: "Barra" },
    "Leg Press": { aliases: "Prensa de pernas, Prensa", equipment: "Máquina" },
    "Romanian Deadlift": { aliases: "Peso morto romeno", equipment: "Barra" },
    Deadlift: { aliases: "Peso morto", equipment: "Barra" },
    "Barbell Row": { aliases: "Remada com barra", equipment: "Barra" },
    "Pull Up": {
      aliases: "Elevações, Elevação na barra",
      equipment: "Peso corporal",
    },
    "Lat Pulldown": {
      aliases: "Puxada alta, Puxada dorsal",
      equipment: "Polia / cabo",
    },
    "Overhead Press": {
      aliases: "Press militar, Desenvolvimento de ombros",
      equipment: "Barra",
    },
    "Lateral Raise": { aliases: "Elevações laterais", equipment: "Halteres" },
    "Bicep Curl": {
      aliases: "Flexão de bíceps, Rosca bíceps",
      equipment: "Halteres",
    },
    "Tricep Pushdown": {
      aliases: "Extensão de tríceps na polia",
      equipment: "Polia / cabo",
    },
    Plank: { aliases: "Prancha", equipment: "Peso corporal" },
  };
export function enrichExercise<T extends Omit<SearchableExercise, "id">>(
  exercise: T,
) {
  const defaults = STARTER_METADATA[exercise.name];
  return {
    ...exercise,
    aliases: exercise.aliases ?? defaults?.aliases ?? "",
    equipment: exercise.equipment ?? defaults?.equipment ?? "",
  };
}
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .trim();
}
export function matchesExercise(exercise: SearchableExercise, search: string) {
  const value = enrichExercise(exercise);
  const haystack = normalizeSearch(
    [
      value.name,
      value.aliases,
      value.equipment,
      value.muscleGroup,
      formatMuscleGroup(value.muscleGroup ?? ""),
    ].join(" "),
  );
  return normalizeSearch(search)
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}
