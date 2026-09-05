CREATE TABLE `ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`day` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_user_day_unique` ON `ai_usage` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `exercise_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_favorites_user_exercise_unique` ON `exercise_favorites` (`user_id`,`exercise_id`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `aliases` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `equipment` text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Starter metadata only: exercise IDs, names and existing history are preserved.
UPDATE exercises SET aliases = 'Supino, Supino com barra', equipment = 'Barra' WHERE name = 'Bench Press';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Supino inclinado com halteres', equipment = 'Halteres' WHERE name = 'Incline Dumbbell Press';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Agachamento', equipment = 'Barra' WHERE name = 'Squat';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Prensa de pernas, Prensa', equipment = 'Máquina' WHERE name = 'Leg Press';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Peso morto romeno', equipment = 'Barra' WHERE name = 'Romanian Deadlift';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Peso morto', equipment = 'Barra' WHERE name = 'Deadlift';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Remada com barra', equipment = 'Barra' WHERE name = 'Barbell Row';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Elevações, Elevação na barra', equipment = 'Peso corporal' WHERE name = 'Pull Up';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Puxada alta, Puxada dorsal', equipment = 'Polia / cabo' WHERE name = 'Lat Pulldown';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Press militar, Desenvolvimento de ombros', equipment = 'Barra' WHERE name = 'Overhead Press';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Elevações laterais', equipment = 'Halteres' WHERE name = 'Lateral Raise';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Flexão de bíceps, Rosca bíceps', equipment = 'Halteres' WHERE name = 'Bicep Curl';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Extensão de tríceps na polia', equipment = 'Polia / cabo' WHERE name = 'Tricep Pushdown';
--> statement-breakpoint
UPDATE exercises SET aliases = 'Prancha', equipment = 'Peso corporal' WHERE name = 'Plank';
