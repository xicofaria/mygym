"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { preparePhoto } from "@/lib/prepare-photo";
import { AIThinking } from "./ai-thinking";
import {
  recognitionSchema,
  type ExerciseSuggestion,
  type Recognition,
} from "@/lib/recognition-contract";
import { createExercise } from "@/app/(app)/exercises/actions";
import { EQUIPMENT } from "@/lib/exercise-catalog";
import { MUSCLE_GROUP_SUGGESTIONS } from "@/lib/muscle-groups";

export function MachinePhotoPicker({
  exercises,
  onSelect,
  onCreated,
  disabled = false,
  provider = "openai",
}: {
  exercises: { id: number; name: string }[];
  onSelect: (exerciseId: number) => void;
  onCreated?: (exercise: { id: number; name: string }) => void;
  disabled?: boolean;
  provider?: "openai" | "openrouter";
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Recognition | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<ExerciseSuggestion>({
    name: "",
    muscleGroup: "",
    aliases: "",
    equipment: "",
  });
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const previewUrl = useRef("");

  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
      URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function clear() {
    generation.current++;
    request.current?.abort();
    URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    setPhoto(null);
    setPreview("");
    setResult(null);
    setError("");
    setBusy(false);
    setCreating(false);
    setFormError("");
  }

  async function choose(file?: File) {
    if (!file) return;
    clear();
    setNotice("");
    setBusy(true);
    const current = generation.current;
    try {
      const prepared = await preparePhoto(file);
      if (generation.current === current) {
        setPhoto(prepared);
        previewUrl.current = URL.createObjectURL(prepared);
        setPreview(previewUrl.current);
      }
    } catch (e) {
      if (generation.current === current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível abrir a fotografia.",
        );
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }

  async function identify() {
    if (!photo || busy || disabled) return;
    if (!navigator.onLine) {
      setError(
        "Estás sem ligação. Escolhe na lista ou tenta novamente quando estiveres online.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setNotice("");
    setCreating(false);
    setFormError("");
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 130_000);
    try {
      const response = await fetch("/api/exercises/recognize", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: photo,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível analisar a fotografia.",
        );
      const parsed = recognitionSchema.parse(data);
      if (
        parsed.candidates.some(
          (c) => !exercises.some((ex) => ex.id === c.exerciseId),
        )
      ) {
        throw new Error(
          "O catálogo mudou. Reabre o treino ou escolhe o exercício na lista.",
        );
      }
      if (generation.current === current) setResult(parsed);
    } catch (e) {
      if (generation.current === current)
        setError(
          controller.signal.aborted
            ? "A análise demorou demasiado. Tenta novamente ou escolhe na lista."
            : e instanceof Error
              ? e.message
              : "Sem ligação ao servidor. Tenta novamente.",
        );
    } finally {
      clearTimeout(timeout);
      if (generation.current === current) setBusy(false);
    }
  }

  function startCreating(suggestion: ExerciseSuggestion) {
    setForm({
      name: suggestion.name,
      muscleGroup: suggestion.muscleGroup,
      aliases: suggestion.aliases,
      equipment: suggestion.equipment,
    });
    setFormError("");
    setCreating(true);
  }
  async function createSuggestion() {
    if (saving || disabled) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await createExercise({
        name: form.name,
        muscleGroup: form.muscleGroup,
        aliases: form.aliases,
        equipment: form.equipment,
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      if (typeof res.id !== "number") {
        setFormError("Criado, mas não foi possível adicionar à série.");
        setCreating(false);
        router.refresh();
        return;
      }
      const name = form.name;
      if (onCreated) onCreated({ id: res.id, name });
      else onSelect(res.id);
      router.refresh();
      setCreating(false);
      clear();
      setNotice(`«${name}» criado e adicionado à série.`);
    } catch {
      setFormError("Sem ligação. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      aria-label="Identificação por fotografia"
      className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30"
    >
      <div className="mb-3 flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-6 w-6 shrink-0 text-indigo-600 dark:text-indigo-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M8 5l1-2h6l1 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        <div>
          <h2 className="text-sm font-semibold">
            Não sabes o nome da máquina?
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fotografa o equipamento completo. A IA sugere exercícios do teu
            catálogo e tu confirmas.
          </p>
        </div>
      </div>
      <input
        ref={camera}
        aria-label="Fotografar máquina"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={library}
        aria-label="Escolher fotografia da máquina"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || disabled}
          onClick={() => camera.current?.click()}
        >
          Tirar fotografia
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || disabled}
          onClick={() => library.current?.click()}
        >
          Escolher imagem
        </button>
      </div>
      {photo && preview && (
        <div className="mt-4 flex flex-col gap-3">
          {busy && <AIThinking onCancel={clear} />}
          {/* Local object URL; never send a private image through an optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Fotografia da máquina a identificar"
            className="max-h-56 w-full rounded-xl bg-black/5 object-contain"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Ao analisar, envias esta imagem{" "}
            {provider === "openrouter"
              ? "ao OpenRouter e ao fornecedor que executar o modelo"
              : "à OpenAI"}
            . Evita incluir pessoas. A aplicação não guarda a fotografia.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || disabled}
              onClick={() => void identify()}
            >
              {busy ? "A analisar…" : "Analisar fotografia"}
            </button>
            <button type="button" className="btn-ghost" onClick={clear}>
              {busy ? "Cancelar" : "Remover fotografia"}
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {busy && (
          <p className="mt-3 text-sm text-indigo-700 dark:text-indigo-300">
            {photo
              ? "A procurar correspondências no catálogo…"
              : "A preparar fotografia…"}
          </p>
        )}
        {notice && (
          <p className="mt-3 text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {notice}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-4 border-t border-indigo-200 pt-3 dark:border-indigo-900">
          <p role="status" className="text-sm font-semibold">
            {result.candidates.length
              ? "Confirma o exercício"
              : "Sem correspondência no catálogo"}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {result.explanation}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {result.candidates.map((candidate) => {
              const name = exercises.find(
                (ex) => ex.id === candidate.exerciseId,
              )!.name;
              return (
                <button
                  key={candidate.exerciseId}
                  type="button"
                  disabled={disabled}
                  className="btn-ghost justify-between text-left"
                  onClick={() => {
                    onSelect(candidate.exerciseId);
                    clear();
                    setNotice(
                      `${name} selecionado. Preenche as repetições e o peso na série.`,
                    );
                  }}
                >
                  <span>Usar {name}</span>
                  <span className="text-xs font-normal">
                    {
                      {
                        high: "Mais provável",
                        medium: "Possível",
                        low: "Incerto",
                      }[candidate.confidence]
                    }
                  </span>
                </button>
              );
            })}
          </div>
          {result.suggestion && !creating && (
            <button
              type="button"
              disabled={disabled || saving}
              className="btn-ghost mt-2 justify-between text-left"
              onClick={() => {
                if (result.suggestion) startCreating(result.suggestion);
              }}
            >
              <span>Criar «{result.suggestion.name}»</span>
              <span className="text-xs font-normal">
                {[result.suggestion.muscleGroup, result.suggestion.equipment]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          )}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            A IA pode enganar-se. Podes sempre escolher ou corrigir o exercício
            na lista.
          </p>
        </div>
      )}
      {creating && (
        <div className="mt-4 border-t border-indigo-200 pt-3 dark:border-indigo-900">
          <p className="text-sm font-semibold">Criar exercício</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Fica disponível apenas na tua conta. Revê os valores.
          </p>
          <label className="label mt-2">
            Nome do exercício
            <input
              className="input"
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="label">
            Grupo muscular
            <input
              className="input"
              maxLength={40}
              list="suggestion-muscle-groups"
              value={form.muscleGroup}
              onChange={(e) =>
                setForm({ ...form, muscleGroup: e.target.value })
              }
            />
            <datalist id="suggestion-muscle-groups">
              {MUSCLE_GROUP_SUGGESTIONS.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </label>
          <label className="label">
            Equipamento
            <select
              className="input"
              value={form.equipment}
              onChange={(e) =>
                setForm({
                  ...form,
                  equipment: e.target.value as ExerciseSuggestion["equipment"],
                })
              }
            >
              {["", ...EQUIPMENT].map((item) => (
                <option key={item} value={item}>
                  {item || "Desconhecido"}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Nomes alternativos (separados por vírgulas)
            <input
              className="input"
              maxLength={300}
              value={form.aliases}
              onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saving}
              onClick={() => void createSuggestion()}
            >
              {saving ? "A criar…" : "Criar e adicionar à série"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={saving}
              onClick={() => setCreating(false)}
            >
              Cancelar
            </button>
          </div>
          {formError && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
