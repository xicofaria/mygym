import { MAX_PHOTO_BYTES } from "./recognition-contract";

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;
const IS_HEIC = /^image\/hei[cf]$|\.(heic|heif)$/i;

async function decodeImage(source: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("Fotografia inválida.");
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderToJpeg(
  image: HTMLImageElement,
  maxSide: number,
  maxBytes: number,
): Promise<Blob> {
  const scale = Math.min(
    1,
    maxSide / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "Não foi possível preparar a fotografia neste dispositivo.",
    );
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.65, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("A fotografia é demasiado grande. Experimenta outra.");
}

/** Re-encode locally: discard EXIF (including GPS) and bound upload size.
 * HEIC (iPhone) is used directly where the browser decodes it natively
 * (Safari/iOS 17+); elsewhere the message explains how to get a JPEG. */
export async function preparePhoto(
  file: File,
  options: { maxSide?: number; maxBytes?: number } = {},
): Promise<Blob> {
  // Chrome and several desktop pickers hand back an empty `type` for .heic, so
  // the extension has to count too — otherwise the one message that actually
  // helps an iPhone user is unreachable for the case it was written for.
  const isHeic = IS_HEIC.test(file.type) || IS_HEIC.test(file.name);
  if (!ACCEPTED.test(file.type) && !isHeic) {
    throw new Error("Escolhe uma imagem JPEG, PNG, WebP ou HEIC.");
  }
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Escolhe uma fotografia até 20 MB.");

  const maxSide = options.maxSide ?? 1280;
  const maxBytes = options.maxBytes ?? MAX_PHOTO_BYTES;

  let image: HTMLImageElement;
  try {
    image = await decodeImage(file);
  } catch {
    // Only a *decode* failure means the browser lacks the codec. Re-encoding
    // errors (a photo that stays too large) keep their own message, and no raw
    // DOMException text reaches the pt-PT UI.
    throw new Error(
      isHeic
        ? "O teu browser não abre fotos HEIC. No iPhone usa o Safari (funciona desde o iOS 17) ou muda Definições → Câmara → Formatos para «Mais compatível»."
        : "Não foi possível ler esta fotografia. Experimenta outra.",
    );
  }
  return renderToJpeg(image, maxSide, maxBytes);
}
