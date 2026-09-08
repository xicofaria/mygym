DROP INDEX `exercises_name_unique`;--> statement-breakpoint
ALTER TABLE `exercises` ADD `user_id` integer REFERENCES users(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_shared_name_unique` ON `exercises` (`name`) WHERE "exercises"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_user_name_unique` ON `exercises` (`user_id`,`name`);
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Bench Press', 'Peito', 'Supino, Supino com barra', 'Barra' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Bench Press');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Incline Dumbbell Press', 'Peito', 'Supino inclinado com halteres', 'Halteres' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Incline Dumbbell Press');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Squat', 'Pernas', 'Agachamento', 'Barra' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Squat');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Leg Press', 'Pernas', 'Prensa de pernas, Prensa', 'Máquina' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Leg Press');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Romanian Deadlift', 'Pernas', 'Peso morto romeno', 'Barra' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Romanian Deadlift');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Deadlift', 'Dorsal', 'Peso morto', 'Barra' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Deadlift');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Barbell Row', 'Dorsal', 'Remada com barra', 'Barra' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Barbell Row');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Pull Up', 'Dorsal', 'Elevações, Elevação na barra', 'Peso corporal' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Pull Up');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Lat Pulldown', 'Dorsal', 'Puxada alta, Puxada dorsal', 'Polia / cabo' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Lat Pulldown');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Overhead Press', 'Ombros', 'Press militar, Desenvolvimento de ombros', 'Barra' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Overhead Press');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Lateral Raise', 'Ombros', 'Elevações laterais', 'Halteres' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Lateral Raise');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Bicep Curl', 'Braços', 'Flexão de bíceps, Rosca bíceps', 'Halteres' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Bicep Curl');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Tricep Pushdown', 'Braços', 'Extensão de tríceps na polia', 'Polia / cabo' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Tricep Pushdown');
--> statement-breakpoint
INSERT INTO exercises (name, muscle_group, aliases, equipment) SELECT 'Plank', 'Abdominais', 'Prancha', 'Peso corporal' WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE user_id IS NULL AND name = 'Plank');
