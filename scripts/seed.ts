/**
 * Seeds the two user accounts and a starter exercise catalog.
 * Idempotent: safe to run repeatedly. Run with `npm run db:seed`.
 *
 * Reads credentials from .env.local (SEED_USER1_*, SEED_USER2_*).
 */
import bcrypt from "bcryptjs";

// Must load env BEFORE importing the db module (it reads DATABASE_URL at import
// time). Static imports are hoisted, so the db module is imported dynamically.
try {
  process.loadEnvFile(".env.local");
} catch {
  // rely on real environment variables
}

const STARTER_EXERCISES: { name: string; muscleGroup: string }[] = [
  { name: "Bench Press", muscleGroup: "Peito" },
  { name: "Incline Dumbbell Press", muscleGroup: "Peito" },
  { name: "Squat", muscleGroup: "Pernas" },
  { name: "Leg Press", muscleGroup: "Pernas" },
  { name: "Romanian Deadlift", muscleGroup: "Pernas" },
  { name: "Deadlift", muscleGroup: "Dorsal" },
  { name: "Barbell Row", muscleGroup: "Dorsal" },
  { name: "Pull Up", muscleGroup: "Dorsal" },
  { name: "Lat Pulldown", muscleGroup: "Dorsal" },
  { name: "Overhead Press", muscleGroup: "Ombros" },
  { name: "Lateral Raise", muscleGroup: "Ombros" },
  { name: "Bicep Curl", muscleGroup: "Braços" },
  { name: "Tricep Pushdown", muscleGroup: "Braços" },
  { name: "Plank", muscleGroup: "Abdominais" },
];

async function main() {
  const { db } = await import("../src/db");
  const { users, exercises } = await import("../src/db/schema");

  const seedUsers = [
    {
      name: process.env.SEED_USER1_NAME ?? "You",
      email: (process.env.SEED_USER1_EMAIL ?? "you@example.com").toLowerCase(),
      password: process.env.SEED_USER1_PASSWORD ?? "changeme123",
    },
    {
      name: process.env.SEED_USER2_NAME ?? "Partner",
      email: (
        process.env.SEED_USER2_EMAIL ?? "partner@example.com"
      ).toLowerCase(),
      password: process.env.SEED_USER2_PASSWORD ?? "changeme123",
    },
  ];

  for (const u of seedUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await db
      .insert(users)
      .values({ name: u.name, email: u.email, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: u.name, passwordHash },
      });
    console.log(`  user: ${u.name} <${u.email}>`);
  }

  await db
    .insert(exercises)
    .values(STARTER_EXERCISES)
    .onConflictDoNothing({ target: exercises.name });
  console.log(`  exercises: ${STARTER_EXERCISES.length} in catalog`);

  console.log("\nSeed complete. Log in with the credentials from .env.local.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
