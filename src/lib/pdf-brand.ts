import type { PDFDocument, PDFPage } from "pdf-lib";

export type PublicAssetLoader = (path: string) => Promise<Uint8Array>;
export const loadPublicAsset: PublicAssetLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error("brand_or_font_unavailable");
  return new Uint8Array(await response.arrayBuffer());
};

// Embed the same transparent lockup as the app, including "by Croo.Studio".
// The PNG alpha channel becomes a PDF soft mask, never a white rectangle.
export async function pdfBrand(pdf: PDFDocument, load = loadPublicAsset) {
  const image = await pdf.embedPng(await load("/brand/tredmeal/logo.png"));
  pdf.setCreator("Tred’meal — by Croo.Studio");
  return (page: PDFPage, x: number, y: number, width: number) => {
    page.drawImage(image, { x, y, width, height: width * image.height / image.width });
  };
}
