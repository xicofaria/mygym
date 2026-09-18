"use client";
/* eslint-disable @next/next/no-img-element -- attributed external product images */
import type { ProductCandidate } from "./use-photo-analysis";

export function ProductCandidates({
  candidates,
  onApply,
  onDismiss,
}: {
  candidates: ProductCandidate[];
  onApply: (candidate: ProductCandidate) => void;
  onDismiss: () => void;
}) {
  if (!candidates.length) return null;
  return (
    <section
      aria-label="Correspondências no Open Food Facts"
      className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10"
    >
      <h3 className="text-sm font-semibold">Encontrado no Open Food Facts?</h3>
      {candidates.map((candidate, index) => (
        <div key={index} className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {candidate.imageUrl && (
              <img
                src={candidate.imageUrl}
                alt={`Fotografia de ${candidate.name}`}
                className="h-10 w-10 shrink-0 rounded object-contain"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{candidate.name}</p>
              <p className="text-xs text-zinc-500">
                {[
                  candidate.brand,
                  `${candidate.nutrients.kcal} kcal/100 ${candidate.unit}`,
                  candidate.details.packageQuantity !== null
                    ? `Embalagem: ${candidate.details.packageQuantity} ${candidate.unit}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {candidate.sourceUrl && (
              <a
                className="text-xs underline"
                href={candidate.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Fonte
              </a>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onApply(candidate)}
            >
              Usar
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={onDismiss}>
        Nenhum destes — manter a análise IA
      </button>
      <p className="text-xs text-zinc-500">
        Dados ODbL do Open Food Facts; confirma sempre a embalagem atual.
      </p>
    </section>
  );
}
