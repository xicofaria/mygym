import { eq, isNull, or } from "drizzle-orm";
import { exercises } from "@/db/schema";

/** Apply to every catalogue read and validation of a caller-supplied exercise ID. */
export function visibleExercises(userId: number) {
  return or(isNull(exercises.userId), eq(exercises.userId, userId))!;
}
