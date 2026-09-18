"use client";
/* eslint-disable @next/next/no-img-element -- private JPEG endpoints and attributed external product images */
import { AIThinking } from "../ai-thinking";
import { AIPhotoPrompt } from "../ai-photo-prompt";

export function ProductPhotoSection({
  preview,
  blob,
  busy,
  analyzing,
  pending,
  photoExpanded,
  mode,
  provider,
  onMode,
  onExpand,
  onFile,
  onAnalyze,
  onRemove,
  onCancel,
}: {
  preview: string | null | undefined;
  blob: Blob | null;
  busy: boolean;
  analyzing: boolean;
  pending: boolean;
  photoExpanded: boolean;
  mode: string;
  provider: "openai" | "openrouter";
  onMode: (mode: string) => void;
  onExpand: () => void;
  onFile: (file?: File) => void;
  onAnalyze: () => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <AIPhotoPrompt
        headingLevel={3}
        regionLabel="Preenchimento por fotografia"
        title="Não sabes os valores nutricionais?"
        description="Fotografa o rótulo do produto. A IA preenche a tabela nutricional e tu confirmas antes de guardar."
        cameraLabel="Fotografar alimento"
        libraryLabel="Escolher fotografia do alimento"
        hasPhoto={Boolean(preview)}
        disabled={busy || pending}
        onFile={onFile}
      >
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          O rótulo dá os valores mais fiáveis. Podes ignorar a IA e preencher a
          tabela à mão nos campos abaixo.
        </p>
        {preview && !photoExpanded && (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={preview}
              alt="Miniatura do produto"
              className="h-12 w-12 shrink-0 rounded-lg bg-black/5 object-contain dark:bg-white/5"
              referrerPolicy="no-referrer"
            />
            <p className="min-w-0 flex-1 text-xs text-zinc-600 dark:text-zinc-400">
              Fotografia guardada com o produto.
            </p>
            <button
              type="button"
              className="btn-ghost shrink-0"
              disabled={pending}
              onClick={onExpand}
            >
              Ver ou analisar
            </button>
          </div>
        )}
        {preview && photoExpanded && (
          <img
            src={preview}
            alt="Fotografia do produto"
            className="mt-3 max-h-56 w-full rounded-xl bg-black/5 object-contain dark:bg-white/5"
            referrerPolicy="no-referrer"
          />
        )}
        {photoExpanded && (preview || blob) && (
          <button
            type="button"
            className="btn-ghost mt-3 min-h-12"
            disabled={pending}
            onClick={onRemove}
          >
            Remover fotografia
          </button>
        )}
        {blob && photoExpanded && (
          <div className="mt-3 border-t border-indigo-200 pt-3 dark:border-indigo-900">
            <label className="label">
              Tipo de análise
              <select
                className="input"
                value={mode}
                onChange={(e) => onMode(e.target.value)}
                disabled={busy}
              >
                <option value="estimate">
                  Preencher com IA (permite estimativas)
                </option>
                <option value="label">Só valores legíveis do rótulo</option>
              </select>
            </label>
            <p className="my-2 text-xs text-zinc-600 dark:text-zinc-400">
              Ao analisar, envias esta imagem{" "}
              {provider === "openrouter"
                ? "ao OpenRouter e ao fornecedor que executar o modelo"
                : "à OpenAI"}
              , e o nome, marca e código de barras identificados seguem para o
              Open Food Facts à procura de correspondências. Evita incluir
              pessoas. A foto reduzida só fica no teu catálogo quando guardares
              o produto.
            </p>
            <button
              type="button"
              className="btn-primary min-h-12 w-full"
              disabled={busy || pending}
              onClick={onAnalyze}
            >
              {busy ? "A analisar…" : "Analisar alimento"}
            </button>
          </div>
        )}
        <div aria-live="polite" aria-atomic="true">
          {busy && !analyzing && (
            <p className="mt-3 text-sm text-indigo-700 dark:text-indigo-300">
              A preparar fotografia…
            </p>
          )}
        </div>
      </AIPhotoPrompt>
      {analyzing && <AIThinking food onCancel={onCancel} />}
    </>
  );
}
