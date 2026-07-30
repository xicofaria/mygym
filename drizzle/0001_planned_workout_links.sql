CREATE TABLE `__planned_workouts_migration_state` (`sequence` integer);--> statement-breakpoint
INSERT INTO `__planned_workouts_migration_state` (`sequence`)
SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'planned_workouts';--> statement-breakpoint
CREATE TABLE `__new_planned_workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` integer NOT NULL,
	`template_id` integer,
	`workout_id` integer,
	`routine_date` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_planned_workouts` (
	`id`, `user_id`, `date`, `template_id`, `workout_id`, `routine_date`, `notes`, `created_at`
)
SELECT
	`id`, `user_id`, `date`, `template_id`, NULL, NULL, `notes`, `created_at`
FROM `planned_workouts`;--> statement-breakpoint
DROP TABLE `planned_workouts`;--> statement-breakpoint
ALTER TABLE `__new_planned_workouts` RENAME TO `planned_workouts`;--> statement-breakpoint
-- Preserve the old date-based completion only when the historical relation is
-- unambiguous. Multiple plans or sessions on one day cannot be linked safely.
UPDATE `planned_workouts`
SET `workout_id` = (
	SELECT `workouts`.`id`
	FROM `workouts`
	WHERE `workouts`.`user_id` = `planned_workouts`.`user_id`
		AND `workouts`.`date` = `planned_workouts`.`date`
	LIMIT 1
)
WHERE (
	SELECT count(*)
	FROM `planned_workouts` AS `sibling_plans`
	WHERE `sibling_plans`.`user_id` = `planned_workouts`.`user_id`
		AND `sibling_plans`.`date` = `planned_workouts`.`date`
) = 1
	AND (
		SELECT count(*)
		FROM `workouts` AS `candidate_workouts`
		WHERE `candidate_workouts`.`user_id` = `planned_workouts`.`user_id`
			AND `candidate_workouts`.`date` = `planned_workouts`.`date`
	) = 1;--> statement-breakpoint
DELETE FROM `sqlite_sequence` WHERE `name` = 'planned_workouts';--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`)
SELECT
	'planned_workouts',
	max(
		`sequence`,
		coalesce((SELECT max(`id`) FROM `planned_workouts`), 0)
	)
FROM `__planned_workouts_migration_state`;--> statement-breakpoint
DROP TABLE `__planned_workouts_migration_state`;--> statement-breakpoint
CREATE UNIQUE INDEX `planned_workouts_workout_id_unique` ON `planned_workouts` (`workout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `planned_workouts_user_routine_date_unique` ON `planned_workouts` (`user_id`,`routine_date`);
