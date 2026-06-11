/**
 * Multi-page PDF OCR using pdf-to-img + Tesseract.js.
 */

export interface PdfOcrResult {
  text: string;
  pageCount: number;
  pagesProcessed: number;
}

const MAX_OCR_PAGES = 40;
const OCR_SCALE = 2;

async function recognizePage(image: Buffer): Promise<string> {
  const Tesseract = (await import("tesseract.js")).default;
  const {
    data: { text },
  } = await Tesseract.recognize(image, "eng", {
    logger: () => {},
  });
  return text?.trim() ?? "";
}

export async function ocrPdfBuffer(buffer: Buffer): Promise<PdfOcrResult> {
  const { pdf } = await import("pdf-to-img");

  const document = await pdf(buffer, { scale: OCR_SCALE });
  const pageTexts: string[] = [];
  let pagesProcessed = 0;

  for await (const pageImage of document) {
    if (pagesProcessed >= MAX_OCR_PAGES) break;

    const pageText = await recognizePage(Buffer.from(pageImage));
    if (pageText) {
      pageTexts.push(pageText);
    }
    pagesProcessed++;
  }

  return {
    text: pageTexts.join("\n\n"),
    pageCount: pagesProcessed,
    pagesProcessed,
  };
}

export async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  return recognizePage(buffer);
}
