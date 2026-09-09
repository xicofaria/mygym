"use client";

import { useRef, type ReactNode } from "react";

/**
 * Entrada única para os fluxos de IA por fotografia (máquinas e alimentos).
 * A IA é sempre um atalho opcional: o cartão explica o que a fotografia faz,
 * quem confirma o resultado, e nunca substitui o preenchimento manual.
 */
export function AIPhotoPrompt({
  regionLabel,
  title,
  description,
  cameraLabel,
  libraryLabel,
  hasPhoto = false,
  disabled = false,
  headingLevel = 2,
  onFile,
  children,
}: {
  /** Nome acessível da região; o título é uma pergunta e não serve de rótulo. */
  regionLabel: string;
  title: string;
  description: string;
  /** Rótulo acessível do input de câmara (o botão visível é genérico). */
  cameraLabel: string;
  /** Rótulo acessível do input de galeria. */
  libraryLabel: string;
  /** Troca os botões para «outra fotografia» quando já existe uma escolhida. */
  hasPhoto?: boolean;
  disabled?: boolean;
  headingLevel?: 2 | 3;
  onFile: (file: File) => void;
  children?: ReactNode;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const accept = "image/jpeg,image/png,image/webp,image/heic,image/heif";

  return (
    <section
      aria-label={regionLabel}
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
          <Heading className="text-sm font-semibold">{title}</Heading>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      <input
        ref={camera}
        aria-label={cameraLabel}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <input
        ref={library}
        aria-label={libraryLabel}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost min-h-12 flex-1"
          disabled={disabled}
          onClick={() => camera.current?.click()}
        >
          {hasPhoto ? "Tirar outra fotografia" : "Tirar fotografia"}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-12 flex-1"
          disabled={disabled}
          onClick={() => library.current?.click()}
        >
          {hasPhoto ? "Escolher outra imagem" : "Escolher imagem"}
        </button>
      </div>
      {children}
    </section>
  );
}
