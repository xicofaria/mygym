import { z } from "zod";

export const MAX_PHOTO_BYTES = 1024 * 1024;
export const recognitionSchema = z.object({
  candidates: z
    .array(
      z.object({
        exerciseId: z.number().int().positive(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(3),
  explanation: z.string().min(1).max(400),
});
export type Recognition = z.infer<typeof recognitionSchema>;
