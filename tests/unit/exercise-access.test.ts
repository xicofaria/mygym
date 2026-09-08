import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { and, eq } from "drizzle-orm";
import { exercises, users } from "../../src/db/schema";
import { visibleExercises } from "../../src/lib/exercise-access";

test("upgrade preserves legacy links and isolates equal-name private exercises", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    await client.execute("PRAGMA foreign_keys=ON");
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    for (const migration of migrations.slice(0, 8))
      await client.executeMultiple(migration.sql.join(";\n"));
    await client.executeMultiple(`
      INSERT INTO users(id,email,name,password_hash) VALUES (1,'one@example.test','One','hash'),(2,'two@example.test','Two','hash');
      INSERT INTO exercises(id,name,aliases,equipment) VALUES (100,'Máquina antiga','','');
      INSERT INTO workouts(id,user_id,date) VALUES (1,1,1788825600);
      INSERT INTO sets(workout_id,exercise_id,set_number,reps,weight) VALUES (1,100,1,12,2.8);
      INSERT INTO workout_templates(id,user_id,name) VALUES (1,1,'Antigo');
      INSERT INTO workout_template_exercises(template_id,exercise_id,position) VALUES (1,100,0);
      INSERT INTO planned_workouts(user_id,date,workout_id) VALUES (1,1788825600,1);
    `);
    await client.executeMultiple(migrations[8].sql.join(";\n"));
    const db = drizzle(client);
    const legacy = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, 100))
      .get();
    assert.equal(legacy?.userId, null);
    assert.equal(legacy?.aliases, "");
    assert.equal(
      (await client.execute("SELECT weight FROM sets")).rows[0].weight,
      2.8,
    );
    assert.equal(
      (await client.execute("SELECT workout_id FROM planned_workouts")).rows[0]
        .workout_id,
      1,
    );
    assert.equal(
      (
        await client.execute(
          "SELECT exercise_id FROM workout_template_exercises",
        )
      ).rows[0].exercise_id,
      100,
    );
    assert.equal(
      (
        await client.execute(
          "SELECT count(*) AS n FROM exercises WHERE user_id IS NULL",
        )
      ).rows[0].n,
      15,
    );
    const [one] = await db
      .insert(exercises)
      .values({ userId: 1, name: "Privada" })
      .returning();
    const [two] = await db
      .insert(exercises)
      .values({ userId: 2, name: "Privada" })
      .returning();
    await assert.rejects(
      db.insert(exercises).values({ userId: 1, name: "Privada" }),
    );
    await assert.rejects(db.insert(exercises).values({ name: "Leg Press" }));
    const visible = await db
      .select()
      .from(exercises)
      .where(visibleExercises(1));
    assert.ok(visible.some((x) => x.id === one.id));
    assert.ok(!visible.some((x) => x.id === two.id));
    assert.ok(visible.some((x) => x.id === 100));
    assert.equal(
      (
        await db
          .update(exercises)
          .set({ name: "Intrusão" })
          .where(and(eq(exercises.id, two.id), eq(exercises.userId, 1)))
          .returning()
      ).length,
      0,
    );
    assert.equal(
      (
        await db
          .update(exercises)
          .set({ name: "Intrusão" })
          .where(and(eq(exercises.id, 100), eq(exercises.userId, 1)))
          .returning()
      ).length,
      0,
    );
    await db.delete(users).where(eq(users.id, 1));
    assert.equal(
      (await db.select().from(exercises).where(eq(exercises.id, one.id)))
        .length,
      0,
    );
    assert.equal(
      (await db.select().from(exercises).where(eq(exercises.id, two.id)))
        .length,
      1,
    );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
  } finally {
    client.close();
  }
});
