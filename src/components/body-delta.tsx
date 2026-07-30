import { deltaTone, type BodyGoal } from "@/lib/body-progress";

const TONE_CLASSES = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-amber-600 dark:text-amber-400",
  neutral: "text-zinc-500 dark:text-zinc-400",
} as const;

export function deltaClasses(delta: number | null, goal: BodyGoal): string {
  return TONE_CLASSES[deltaTone(delta, goal)];
}

/** A signed change like "▼ 2.1 kg", coloured by whether it is progress. */
export function DeltaBadge({
  delta,
  goal,
  unit = "",
  className = "",
}: {
  delta: number | null;
  goal: BodyGoal;
  unit?: string;
  className?: string;
}) {
  if (delta == null) {
    return (
      <span className={`text-zinc-400 dark:text-zinc-500 ${className}`}>
        sem comparação
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className={`text-zinc-500 dark:text-zinc-400 ${className}`}>
        sem alteração
      </span>
    );
  }

  const suffix = unit ? ` ${unit}` : "";
  return (
    <span className={`${deltaClasses(delta, goal)} ${className}`}>
      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
      {suffix}
    </span>
  );
}
