"use client";
import { useEffect, useRef, useState } from "react";
import { parseWeight } from "@/lib/decimal";
import { unitSuggestionSchema } from "@/lib/nutrition";
import { AIThinking } from "./ai-thinking";

export function DiaryPortion({
  productId,
  mode,
  unit,
  initialQuantity,
  initialEstimated,
  provider,
  onChange,
}: {
  productId: number;
  mode: "pieces" | "package";
  unit: "g" | "ml";
  initialQuantity: number | null;
  initialEstimated: boolean;
  provider: string;
  onChange: (value: { unitQuantity: number; estimated: boolean }) => void;
}) {
  const [value, setValue] = useState(initialQuantity?.toString() ?? "");
  const [estimated, setEstimated] = useState(initialEstimated);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  const valid = Number.isFinite(parseWeight(value)) && parseWeight(value) > 0;
  async function estimate() {
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/calories/products/${productId}/unit`, {
        method: "POST",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(130000),
        ]),
      });
      const body = await response.json();
      if (current !== generation.current) return;
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Não foi possível estimar.",
        );
      const result = unitSuggestionSchema.parse(body);
      if (result.unit !== unit)
        throw new Error("Unidade incompatível. Indica o peso manualmente.");
      setNotice(result.explanation);
      if (result.quantity === null) return;
      setValue(String(result.quantity));
      setEstimated(result.estimated);
      onChange({ unitQuantity: result.quantity, estimated: result.estimated });
    } catch {
      if (current === generation.current)
        setNotice(
          "Não foi possível estimar. Indica o peso aqui ou regista em gramas/ml.",
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <div className="text-sm" aria-label="Conversão no diário">
      <details open={initialQuantity === null}>
        <summary className="cursor-pointer text-zinc-500">
          {valid
            ? `1 ${mode === "pieces" ? "unidade" : "embalagem"} = ${value} ${unit}${estimated ? " (estimativa)" : ""} · ajustar`
            : "Falta o peso para converter esta quantidade"}
        </summary>
        <p className="my-2 text-xs text-zinc-500">
          {mode === "pieces"
            ? "Indica quantas unidades comeste em cima. Este peso médio serve apenas para converter unidades em gramas/ml."
            : "Indica a fração que comeste em cima e o conteúdo da embalagem aqui, sem sair do diário."}
        </p>
        <label className="label">
          {mode === "pieces" ? "Peso de uma unidade" : "Conteúdo da embalagem"}{" "}
          ({unit})
          <input
            className="input"
            aria-label={
              mode === "pieces"
                ? "Peso de uma unidade"
                : "Conteúdo da embalagem"
            }
            inputMode="decimal"
            maxLength={12}
            value={value}
            disabled={busy}
            onChange={(e) => {
              setValue(e.target.value);
              onChange({
                unitQuantity: parseWeight(e.target.value),
                estimated,
              });
            }}
          />
        </label>
        <label className="my-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={estimated}
            disabled={busy}
            onChange={(e) => {
              setEstimated(e.target.checked);
              onChange({
                unitQuantity: parseWeight(value),
                estimated: e.target.checked,
              });
            }}
          />
          Peso aproximado, não pesado
        </label>
        {mode === "pieces" && (
          <>
            <p className="my-2 text-xs text-zinc-500">
              A IA recebe apenas nome, marca e tabela do produto via{" "}
              {provider === "openrouter"
                ? "OpenRouter e o fornecedor"
                : "OpenAI"}
              . Não envia fotografias nem o diário. A sugestão é uma estimativa.
            </p>
            <button
              className="btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => void estimate()}
            >
              Estimar peso por unidade com IA
            </button>
          </>
        )}
      </details>
      {estimated && valid && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Conversão estimada. Confirma o peso médio antes de registar; pesar é
          mais preciso.
        </p>
      )}
      {busy && (
        <AIThinking
          message="A estimar o peso por unidade…"
          onCancel={() => {
            generation.current++;
            request.current?.abort();
            setBusy(false);
            setNotice(
              "Estimativa cancelada; uma chamada já enviada pode ser cobrada.",
            );
          }}
        />
      )}
      {notice && (
        <p role="status" className="mt-2 text-xs text-zinc-500">
          {notice}
        </p>
      )}
    </div>
  );
}
