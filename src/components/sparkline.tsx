const WIDTH = 100;
const HEIGHT = 28;
const PADDING = 3;

/**
 * Tiny trend line drawn as plain SVG (no chart library, no client JS).
 * Stretches to the width of its container and inherits `currentColor`.
 */
export function Sparkline({
  values,
  className = "",
}: {
  values: readonly number[];
  className?: string;
}) {
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const usable = HEIGHT - PADDING * 2;
  const y = (value: number) => PADDING + (1 - (value - min) / span) * usable;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={`h-7 w-full ${className}`}
      aria-hidden="true"
    >
      {values.length === 1 ? (
        <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={2} fill="currentColor" />
      ) : (
        <polyline
          points={values
            .map((value, index) => {
              const x = (index * WIDTH) / (values.length - 1);
              return `${x.toFixed(1)},${y(value).toFixed(1)}`;
            })
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
