import { z } from "zod";
import { EQUIPMENT } from "./exercise-catalog";

export const MAX_PHOTO_BYTES = 1024 * 1024;
export const SUGGESTION_DUPLICATE_SCORE = 0.8;
export const exerciseSuggestionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  muscleGroup: z.string().trim().max(40),
  aliases: z.string().trim().max(300),
  equipment: z.enum(["", ...EQUIPMENT]),
});
export const recognitionSchema = z.object({
  candidates: z
    .array(
      z.object({
        exerciseId: z.number().int().positive(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(3),
  suggestion: exerciseSuggestionSchema.nullable(),
  explanation: z.string().min(1).max(400),
});
export type ExerciseSuggestion = z.infer<typeof exerciseSuggestionSchema>;
export type Recognition = z.infer<typeof recognitionSchema>;
