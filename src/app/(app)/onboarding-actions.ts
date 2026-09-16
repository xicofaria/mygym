"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/** A per-account preference; no caller-supplied owner or redirect target. */
export async function completeOnboarding() {
  const user = await requireUser();
  await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, user.id));
  revalidatePath("/dashboard");
  return { error: null };
}
