DROP INDEX "ai_usage_user_day_unique";--> statement-breakpoint
DROP INDEX "calorie_goals_user_date_unique";--> statement-breakpoint
DROP INDEX "email_tokens_token_hash_unique";--> statement-breakpoint
DROP INDEX "exercise_favorites_user_exercise_unique";--> statement-breakpoint
DROP INDEX "exercises_name_unique";--> statement-breakpoint
DROP INDEX "food_days_user_date_unique";--> statement-breakpoint
DROP INDEX "planned_workouts_workout_id_unique";--> statement-breakpoint
DROP INDEX "planned_workouts_user_routine_date_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "weekly_report_enabled" TO "weekly_report_enabled" integer NOT NULL DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_user_day_unique` ON `ai_usage` (`user_id`,`day`);--> statement-breakpoint
CREATE UNIQUE INDEX `calorie_goals_user_date_unique` ON `calorie_goals` (`user_id`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_tokens_token_hash_unique` ON `email_tokens` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_favorites_user_exercise_unique` ON `exercise_favorites` (`user_id`,`exercise_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_unique` ON `exercises` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `food_days_user_date_unique` ON `food_days` (`user_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `planned_workouts_workout_id_unique` ON `planned_workouts` (`workout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `planned_workouts_user_routine_date_unique` ON `planned_workouts` (`user_id`,`routine_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
-- O relatório semanal passa a opt-in. A 0005 criou a coluna com DEFAULT true no
-- mesmo PR ainda não lançado, por isso nenhuma conta chegou a consentir o envio:
-- todas arrancam desativadas e só ativam explicitamente em /conta.
UPDATE `users` SET `weekly_report_enabled` = false;
