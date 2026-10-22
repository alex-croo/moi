import { receiptImageLimit } from "./receipt";

/** Re-encode locally to remove photo metadata and bound the private API payload. */
export async function prepareReceiptImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw Error("image_format");
  if (!file.size || file.size > 20 * 1024 * 1024) throw Error("image_size");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    try { await image.decode(); } catch { throw Error("image_format"); }
    if (!image.naturalWidth || !image.naturalHeight) throw Error("image_format");
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (!context) throw Error("image_format");
    const scale = Math.min(1, 3200 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.65, 0.5]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= receiptImageLimit) return data;
    }
    throw Error("image_size");
  } finally { URL.revokeObjectURL(url); }
}
