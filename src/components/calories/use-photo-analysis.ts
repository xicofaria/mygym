"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { productSchema, type FoodProduct } from "@/lib/nutrition";
import { preparePhoto } from "@/lib/prepare-photo";

export type AnalyzedProduct = ReturnType<typeof productSchema.parse>;
export type ProductCandidate = Omit<FoodProduct, "id" | "hasPhoto">;

/**
 * Owns the photo and the recognition request for the product form.
 * `generation` guards against a slow reply overwriting fields the person
 * changed meanwhile, or a reply from a photo that was already replaced.
 */
export function usePhotoAnalysis({
  pending,
  dirtyRef,
  onError,
  onNotice,
  onCandidates,
  onInvalidate,
  onProduct,
}: {
  pending: boolean;
  dirtyRef: RefObject<boolean>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onCandidates: (candidates: ProductCandidate[]) => void;
  /** A new photo or a new analysis drops the previous review and match. */
  onInvalidate: () => void;
  onProduct: (product: AnalyzedProduct) => void;
}) {
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mode, setMode] = useState("estimate");
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(true);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );

  async function choose(file?: File) {
    if (!file) return;
    dirtyRef.current = true;
    const current = ++generation.current;
    request.current?.abort();
    setBusy(true);
    onError("");
    onNotice("");
    onInvalidate();
    setAnalyzing(false);
    setPhotoExpanded(true);
    try {
      const prepared = await preparePhoto(file);
      const thumb = await preparePhoto(file, {
        maxSide: 512,
        maxBytes: 140000,
      });
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Não foi possível ler a foto."));
        reader.readAsDataURL(thumb);
      });
      if (current !== generation.current) return;
      setBlob(prepared);
      setPhoto(data);
    } catch (e) {
      if (current === generation.current)
        onError(
          e instanceof Error
            ? e.message
            : "Escolhe uma imagem JPEG, PNG, WebP ou HEIC até 20 MB.",
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  async function analyze() {
    if (!blob || busy || pending) return;
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setAnalyzing(true);
    onError("");
    onInvalidate();
    try {
      const response = await fetch("/api/calories/recognize", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/jpeg", "x-food-mode": mode },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(130000),
        ]),
      });
      const body = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(body.error || "Análise indisponível.");
      onNotice(
        typeof body.explanation === "string"
          ? body.explanation
          : "Confirma os valores.",
      );
      onCandidates(
        Array.isArray(body.candidates) ? body.candidates.slice(0, 3) : [],
      );
      if (!body.product) {
        setPhotoExpanded(true);
        return;
      }
      const data = productSchema.parse({
        ...body.product,
        source: mode === "label" ? "label-ai" : "estimate-ai",
        sourceUrl: "",
        imageUrl: "",
      });
      setPhotoExpanded(false);
      onProduct(data);
    } catch (e) {
      if (current === generation.current) {
        setPhotoExpanded(true);
        onError(e instanceof Error ? e.message : "Não foi possível analisar.");
      }
    } finally {
      if (current === generation.current) {
        setBusy(false);
        setAnalyzing(false);
      }
    }
  }

  function cancel() {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setAnalyzing(false);
    setPhotoExpanded(true);
    onNotice(
      "Análise cancelada. A fotografia e os campos foram mantidos; uma chamada já enviada pode ser cobrada.",
    );
  }

  function remove() {
    dirtyRef.current = true;
    generation.current++;
    request.current?.abort();
    setPhoto(null);
    setBlob(null);
    setBusy(false);
    setAnalyzing(false);
    onCandidates([]);
  }

  return {
    photo,
    blob,
    mode,
    setMode,
    busy,
    analyzing,
    photoExpanded,
    setPhotoExpanded,
    choose,
    analyze,
    cancel,
    remove,
  };
}
