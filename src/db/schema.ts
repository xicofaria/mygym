import { sql, relations } from "drizzle-orm";
import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * Data model for the 2-person gym tracker.
 *
 * users          – the two people using the app
 * exercises      – a shared catalog of movements (Bench Press, Squat, ...)
 * workouts       – one training session for one user on a date
 * sets           – a single set within a workout: exercise × setNumber × reps × weight
 *                  (this is the "Exercise X: 3 series, 12 reps, 24kg" from a paper log)
 * body_metrics   – bodyweight + tape measurements over time, per user
 *
 * All timestamps are stored as Unix seconds (SQLite integer) and surfaced as JS Dates.
 */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  muscleGroup: text("muscle_group"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const sets = sqliteTable("sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weight: real("weight").notNull(),
});

export const bodyMetrics = sqliteTable("body_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  weightKg: real("weight_kg"),
  heightCm: real("height_cm"),
  waistCm: real("waist_cm"),
  chestCm: real("chest_cm"),
  armCm: real("arm_cm"),
  thighCm: real("thigh_cm"),
  hipCm: real("hip_cm"),
  bodyFatPct: real("body_fat_pct"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const workoutTemplates = sqliteTable("workout_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const workoutTemplateExercises = sqliteTable(
  "workout_template_exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    templateId: integer("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
);

export const usersRelations = relations(users, ({ many }) => ({
  workouts: many(workouts),
  bodyMetrics: many(bodyMetrics),
  workoutTemplates: many(workoutTemplates),
}));

export const workoutTemplatesRelations = relations(
  workoutTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutTemplates.userId],
      references: [users.id],
    }),
    items: many(workoutTemplateExercises),
  }),
);

export const workoutTemplateExercisesRelations = relations(
  workoutTemplateExercises,
  ({ one }) => ({
    template: one(workoutTemplates, {
      fields: [workoutTemplateExercises.templateId],
      references: [workoutTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [workoutTemplateExercises.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
  sets: many(sets),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, { fields: [workouts.userId], references: [users.id] }),
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  workout: one(workouts, {
    fields: [sets.workoutId],
    references: [workouts.id],
  }),
  exercise: one(exercises, {
    fields: [sets.exerciseId],
    references: [exercises.id],
  }),
}));

export const bodyMetricsRelations = relations(bodyMetrics, ({ one }) => ({
  user: one(users, { fields: [bodyMetrics.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
