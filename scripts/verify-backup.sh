#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: npm run backup:verify -- caminho/backup.sql" >&2
  exit 2
fi

backup_file=$1
if [[ ! -f "$backup_file" ]]; then
  echo "Backup não encontrado: $backup_file" >&2
  exit 2
fi

work_dir=$(mktemp -d)
restore_db="$work_dir/restore.db"
trap 'rm -rf -- "$work_dir"' EXIT

# Do not load the operator's ~/.sqliterc and stop at the first restore error.
# The input must be a trusted dump created by the documented Turso command.
sqlite3 -noinit -bail "$restore_db" < "$backup_file"

integrity=$(sqlite3 "$restore_db" "PRAGMA integrity_check;")
if [[ "$integrity" != "ok" ]]; then
  echo "Falha no integrity_check: $integrity" >&2
  exit 1
fi

foreign_key_errors=$(sqlite3 "$restore_db" "PRAGMA foreign_key_check;")
if [[ -n "$foreign_key_errors" ]]; then
  echo "O backup contém relações inválidas:" >&2
  echo "$foreign_key_errors" >&2
  exit 1
fi

required_tables=(
  users
  exercises
  workouts
  sets
  body_metrics
  workout_templates
  workout_template_exercises
)

for table in "${required_tables[@]}"; do
  present=$(sqlite3 "$restore_db" \
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '$table';")
  if [[ "$present" != "1" ]]; then
    echo "Tabela obrigatória em falta: $table" >&2
    exit 1
  fi
done

echo "Backup restaurado com sucesso numa base temporária."
echo "integrity_check: ok"
for table in "${required_tables[@]}"; do
  count=$(sqlite3 "$restore_db" "SELECT COUNT(*) FROM \"$table\";")
  printf '%s: %s registos\n' "$table" "$count"
done
