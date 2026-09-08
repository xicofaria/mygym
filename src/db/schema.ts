import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Data model for private accounts with a common exercise catalogue.
 *
 * users          – registered accounts
 * exercises      – read-only common movements and private additions
 * workouts       – one training session for one user on a date
 * sets           – a single set within a workout: exercise × setNumber × reps × weight
 *                  (this is the "Exercise X: 3 series, 12 reps, 24kg" from a paper log)
 * body_metrics   – bodyweight + tape measurements over time, per user
 * planned_workouts – a workout scheduled for a date (optionally from a
 *                  template), optionally linked to the session that completed it
 *
 * All timestamps are stored as Unix seconds (SQLite integer) and surfaced as JS Dates.
 */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
  tokenVersion: integer("token_version").notNull().default(0),
  /** Opt-in: the weekly email is only sent to accounts that ask for it. */
  weeklyReportEnabled: integer("weekly_report_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** One-time links for email verification and password resets (hashed at rest). */
export const emailTokens = sqliteTable("email_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  /** Binds the link to the concrete address it was sent to. */
  email: text("email").notNull().default(""),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const exercises = sqliteTable(
  "exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Null denotes the read-only common catalogue, including legacy exercises.
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group"),
    aliases: text("aliases").notNull().default(""),
    equipment: text("equipment").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("exercises_shared_name_unique")
      .on(table.name)
      .where(sql`${table.userId} IS NULL`),
    uniqueIndex("exercises_user_name_unique").on(table.userId, table.name),
  ],
);

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

export const exerciseFavorites = sqliteTable(
  "exercise_favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("exercise_favorites_user_exercise_unique").on(
      table.userId,
      table.exerciseId,
    ),
  ],
);

/** One atomic counter per account and Lisbon day, shared across server instances. */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [
    uniqueIndex("ai_usage_user_day_unique").on(table.userId, table.day),
  ],
);

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

export const plannedWorkouts = sqliteTable(
  "planned_workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp" }).notNull(),
    templateId: integer("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    /** The real session that completed this exact plan, if any. */
    workoutId: integer("workout_id")
      .unique()
      .references(() => workouts.id, { onDelete: "set null" }),
    /** Non-null only for plans materialized from the weekly routine. */
    routineDate: integer("routine_date", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // SQLite permits repeated NULL values, so manual plans remain unrestricted.
    uniqueIndex("planned_workouts_user_routine_date_unique").on(
      table.userId,
      table.routineDate,
    ),
  ],
);

/** What a planned session trains ("Peito", "Tríceps", …), in display order. */
export const plannedWorkoutGroups = sqliteTable("planned_workout_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plannedWorkoutId: integer("planned_workout_id")
    .notNull()
    .references(() => plannedWorkouts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

/**
 * The user's recurring weekly split: which muscle groups belong to each
 * weekday (1 = Monday … 7 = Sunday). A weekday with no rows is a rest day.
 */
export const routineGroups = sqliteTable("routine_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  workouts: many(workouts),
  bodyMetrics: many(bodyMetrics),
  workoutTemplates: many(workoutTemplates),
  plannedWorkouts: many(plannedWorkouts),
  routineGroups: many(routineGroups),
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

export const plannedWorkoutsRelations = relations(
  plannedWorkouts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [plannedWorkouts.userId],
      references: [users.id],
    }),
    template: one(workoutTemplates, {
      fields: [plannedWorkouts.templateId],
      references: [workoutTemplates.id],
    }),
    workout: one(workouts, {
      fields: [plannedWorkouts.workoutId],
      references: [workouts.id],
    }),
    groups: many(plannedWorkoutGroups),
  }),
);

export const plannedWorkoutGroupsRelations = relations(
  plannedWorkoutGroups,
  ({ one }) => ({
    plannedWorkout: one(plannedWorkouts, {
      fields: [plannedWorkoutGroups.plannedWorkoutId],
      references: [plannedWorkouts.id],
    }),
  }),
);

export const routineGroupsRelations = relations(routineGroups, ({ one }) => ({
  user: one(users, { fields: [routineGroups.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type PlannedWorkout = typeof plannedWorkouts.$inferSelect;
export type PlannedWorkoutGroup = typeof plannedWorkoutGroups.$inferSelect;
export type RoutineGroup = typeof routineGroups.$inferSelect;

/** Nutrition is private to the signed-in account, including catalogue photos. */
export const foodProducts = sqliteTable("food_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  unit: text("unit").notNull().default("g"),
  nutrients: text("nutrients").notNull(),
  details: text("details").notNull().default("{}"),
  photo: text("photo"),
  imageUrl: text("image_url").notNull().default(""),
  source: text("source").notNull().default("manual"),
  sourceUrl: text("source_url").notNull().default(""),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const foodEntries = sqliteTable("food_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => foodProducts.id, {
    onDelete: "set null",
  }),
  date: text("date").notNull(),
  meal: text("meal").notNull(),
  quantity: real("quantity").notNull(),
  // Immutable product/nutrition snapshot: editing a product never rewrites history.
  snapshot: text("snapshot").notNull(),
});

export const calorieGoals = sqliteTable(
  "calorie_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    effectiveFrom: text("effective_from").notNull(),
    kcal: real("kcal").notNull(),
    tolerance: real("tolerance").notNull().default(10),
  },
  (table) => [
    uniqueIndex("calorie_goals_user_date_unique").on(
      table.userId,
      table.effectiveFrom,
    ),
  ],
);

export const foodDays = sqliteTable(
  "food_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("food_days_user_date_unique").on(table.userId, table.date),
  ],
);
