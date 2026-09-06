import { MAX_PHOTO_BYTES } from "./recognition-contract";

/** Re-encode locally: discard EXIF (including GPS) and bound upload size. */
export async function preparePhoto(
  file: File,
  options: { maxSide?: number; maxBytes?: number } = {},
): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error(
      "Escolhe uma imagem JPEG, PNG ou WebP. Se estiver em HEIC, exporta-a como JPEG.",
    );
  }
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Escolhe uma fotografia até 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("Fotografia inválida.");
    const scale = Math.min(
      1,
      (options.maxSide ?? 1280) /
        Math.max(image.naturalWidth, image.naturalHeight),
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
      if (blob && blob.size <= (options.maxBytes ?? MAX_PHOTO_BYTES))
        return blob;
    }
    throw new Error("A fotografia é demasiado grande. Experimenta outra.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
