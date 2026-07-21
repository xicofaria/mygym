import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub != null && (
        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {sub}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  href,
  cta,
}: {
  title: string;
  hint?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && (
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {href && cta && (
        <Link href={href} className="btn-primary mt-2">
          {cta}
        </Link>
      )}
    </div>
  );
}
