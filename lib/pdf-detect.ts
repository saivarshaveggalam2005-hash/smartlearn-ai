/**
 * PDF type detection — text-based vs scanned/image-heavy PDFs.
 */

export type PdfContentType = "text" | "scanned" | "mixed";

export interface PdfAnalysis {
  contentType: PdfContentType;
  pageCount: number;
  textLength: number;
  charsPerPage: number;
  text: string;
  hasSelectableText: boolean;
}

/** Minimum total characters to trust pdf-parse output */
const MIN_TOTAL_CHARS = 80;

/** Minimum average chars/page for a text-based PDF */
const MIN_CHARS_PER_PAGE = 35;

/** Ratio below which PDF is treated as scanned */
const SCANNED_CHARS_RATIO = 0.55;

export interface PdfParseResult {
  text: string;
  numpages: number;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return {
    text: (data.text ?? "").trim(),
    numpages: Math.max(1, data.numpages ?? 1),
  };
}

export function analyzePdfText(
  text: string,
  pageCount: number
): Omit<PdfAnalysis, "text"> & { text: string } {
  const trimmed = text.trim();
  const charsPerPage = trimmed.length / Math.max(1, pageCount);
  const hasStructureMarkers =
    /\b(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+/i.test(
      trimmed
    );
  const hasSelectableText = trimmed.length >= MIN_TOTAL_CHARS;

  let contentType: PdfContentType = "text";

  if (!hasSelectableText || charsPerPage < MIN_CHARS_PER_PAGE) {
    contentType = "scanned";
  } else if (
    charsPerPage < MIN_CHARS_PER_PAGE * 2 ||
    (!hasStructureMarkers && charsPerPage < 120)
  ) {
    contentType = "mixed";
  }

  return {
    contentType,
    pageCount,
    textLength: trimmed.length,
    charsPerPage,
    text: trimmed,
    hasSelectableText,
  };
}

export async function detectPdfType(buffer: Buffer): Promise<PdfAnalysis> {
  const { text, numpages } = await parsePdfBuffer(buffer);
  return analyzePdfText(text, numpages);
}

export function shouldUseOcrForPdf(analysis: PdfAnalysis): boolean {
  if (analysis.contentType === "scanned") return true;
  if (analysis.contentType === "mixed") return true;
  if (!analysis.hasSelectableText) return true;
  if (analysis.charsPerPage < MIN_CHARS_PER_PAGE * SCANNED_CHARS_RATIO) return true;
  return false;
}

export function pickBetterPdfText(
  textResult: PdfAnalysis,
  ocrText: string,
  ocrPageCount: number
): { text: string; source: "pdf-text" | "pdf-ocr" } {
  const cleanedOcr = ocrText.trim();
  if (!cleanedOcr) {
    return { text: textResult.text, source: "pdf-text" };
  }

  const textScore = scoreRawExtractedText(textResult.text, textResult.pageCount);
  const ocrScore = scoreRawExtractedText(cleanedOcr, ocrPageCount);

  if (ocrScore > textScore + 5) {
    return { text: cleanedOcr, source: "pdf-ocr" };
  }

  if (
    shouldUseOcrForPdf(textResult) &&
    cleanedOcr.length > textResult.textLength * 1.2
  ) {
    return { text: cleanedOcr, source: "pdf-ocr" };
  }

  return {
    text: textResult.text.length >= cleanedOcr.length ? textResult.text : cleanedOcr,
    source:
      textResult.text.length >= cleanedOcr.length ? "pdf-text" : "pdf-ocr",
  };
}

/** Heuristic score for raw extracted syllabus text (no parser). */
export function scoreRawExtractedText(text: string, pageCount = 1): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  let score = 0;
  const lines = trimmed.split(/\n+/).filter((l) => l.trim().length > 2);

  score += Math.min(25, lines.length * 2);
  score += Math.min(20, Math.floor(trimmed.length / 200));

  const unitMatches = trimmed.match(
    /\b(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+/gi
  );
  score += Math.min(30, (unitMatches?.length ?? 0) * 10);

  const listMarkers = trimmed.match(/^[\s]*[\d.)•\-–—]+/gm);
  score += Math.min(15, (listMarkers?.length ?? 0) * 2);

  const charsPerPage = trimmed.length / Math.max(1, pageCount);
  if (charsPerPage >= MIN_CHARS_PER_PAGE) score += 10;

  return score;
}
