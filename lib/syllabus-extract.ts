/**
 * Syllabus text extraction pipeline:
 * PDF type detection → pdf-parse or OCR fallback → text cleaning.
 */

import {
  detectPdfType,
  pickBetterPdfText,
  shouldUseOcrForPdf,
  type PdfAnalysis,
} from "@/lib/pdf-detect";
import { ocrImageBuffer, ocrPdfBuffer } from "@/lib/pdf-ocr";
import { prepareSyllabusText } from "@/lib/syllabus-text-clean";

export type ExtractionMethod =
  | "pdf-text"
  | "pdf-ocr"
  | "pdf-mixed"
  | "image-ocr"
  | "docx"
  | "plain";

export interface SyllabusTextExtraction {
  text: string;
  rawText: string;
  method: ExtractionMethod;
  pdfType?: PdfAnalysis["contentType"];
  pageCount?: number;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

function extractTextFromPlain(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

async function extractPdfWithPipeline(
  buffer: Buffer,
  options?: { forceOcr?: boolean }
): Promise<SyllabusTextExtraction> {
  const analysis = await detectPdfType(buffer);

  if (options?.forceOcr) {
    const ocrResult = await ocrPdfBuffer(buffer);
    const fallbackText = ocrResult.text.trim() || analysis.text;
    const cleaned = prepareSyllabusText(fallbackText);
    return {
      text: cleaned,
      rawText: fallbackText,
      method: "pdf-ocr",
      pdfType: analysis.contentType,
      pageCount: ocrResult.pagesProcessed || analysis.pageCount,
    };
  }

  const needsOcr = shouldUseOcrForPdf(analysis);

  if (!needsOcr && analysis.text.length > 0) {
    const cleaned = prepareSyllabusText(analysis.text);
    return {
      text: cleaned,
      rawText: analysis.text,
      method: "pdf-text",
      pdfType: analysis.contentType,
      pageCount: analysis.pageCount,
    };
  }

  let ocrPageCount = analysis.pageCount;

  try {
    const ocrResult = await ocrPdfBuffer(buffer);
    ocrPageCount = ocrResult.pagesProcessed || analysis.pageCount;

    const picked = pickBetterPdfText(analysis, ocrResult.text, ocrPageCount);
    const cleaned = prepareSyllabusText(picked.text);

    return {
      text: cleaned,
      rawText: picked.text,
      method:
        picked.source === "pdf-ocr"
          ? options?.forceOcr
            ? "pdf-ocr"
            : analysis.text.length > 0
              ? "pdf-mixed"
              : "pdf-ocr"
          : "pdf-text",
      pdfType: analysis.contentType,
      pageCount: ocrPageCount,
    };
  } catch (ocrError) {
    console.error("PDF OCR fallback failed:", ocrError);

    if (analysis.text.length > 0) {
      const cleaned = prepareSyllabusText(analysis.text);
      return {
        text: cleaned,
        rawText: analysis.text,
        method: "pdf-text",
        pdfType: analysis.contentType,
        pageCount: analysis.pageCount,
      };
    }

    throw new Error(
      "Could not extract text from this PDF. Try a clearer scan or image upload."
    );
  }
}

/** Force OCR extraction for quality retry passes. */
export async function extractPdfViaOcr(buffer: Buffer): Promise<SyllabusTextExtraction> {
  return extractPdfWithPipeline(buffer, { forceOcr: true });
}

/**
 * Full extraction pipeline with automatic PDF OCR fallback.
 * Existing callers keep using this — behavior is improved internally.
 */
export async function extractSyllabusText(
  buffer: Buffer,
  mimeType: string,
  options?: { forceOcr?: boolean }
): Promise<SyllabusTextExtraction> {
  if (mimeType === "application/pdf") {
    return extractPdfWithPipeline(buffer, options);
  }

  if (mimeType.startsWith("image/")) {
    const raw = await ocrImageBuffer(buffer);
    if (!raw.trim()) {
      throw new Error("Could not extract text from this image.");
    }
    return {
      text: prepareSyllabusText(raw),
      rawText: raw,
      method: "image-ocr",
      pageCount: 1,
    };
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const raw = await extractTextFromDocx(buffer);
    return {
      text: prepareSyllabusText(raw),
      rawText: raw,
      method: "docx",
    };
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv"
  ) {
    const raw = extractTextFromPlain(buffer);
    return {
      text: prepareSyllabusText(raw),
      rawText: raw,
      method: "plain",
    };
  }

  throw new Error("Unsupported file type");
}

/** Backward-compatible API used by upload route. */
export async function extractTextFromSyllabus(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const result = await extractSyllabusText(buffer, mimeType);
  return result.text;
}
