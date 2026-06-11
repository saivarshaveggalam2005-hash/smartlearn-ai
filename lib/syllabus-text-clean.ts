/**
 * Post-extraction text normalization for syllabus parsing.
 */

import { cleanSyllabusText } from "@/lib/syllabus-parser";

const FOOTER_PATTERNS = [
  /^page\s+\d+\s*(?:of\s+\d+)?$/i,
  /^\d+\s*\/\s*\d+$/,
  /^-{3,}$/,
  /^_{3,}$/,
];

const METADATA_LINE_PATTERNS = [
  /^scheme\s+of\s+(?:instruction|examination)/i,
  /^course\s+(?:code|title|name)\s*[:]/i,
  /^department\s*[:]/i,
  /^faculty\s*[:]/i,
  /^university\s*[:]/i,
  /^college\s*[:]/i,
  /^branch\s*[:]/i,
  /^semester\s*[:]/i,
  /^regulation\s*[:]/i,
  /^credits?\s*[:]/i,
  /^hours?\s+per\s+week/i,
  /^instruction\s+hours/i,
  /^total\s+(?:credits?|hours?)/i,
  /^text\s*books?\s*[:]/i,
  /^reference\s*books?\s*[:]/i,
  /^bibliography/i,
  /^note\s*[:]/i,
  /^for\s+the\s+batch/i,
  /^course\s+outcomes?/i,
  /^program\s+outcomes?/i,
  /^contact\s+hours?/i,
  /^faculty\s+information/i,
  /^admitted\s+in/i,
  /^batch\s+admitted/i,
  /^\(?r-?\d+\)?$/i,
  /^u\d{2}[a-z]{2}\d{3}/i,
  /^\s*l\s+t\s+p\s+c\s*$/i,
  /^\s*c\s+p\s*$/i,
];

/** OCR artifact cleanup before syllabus parser runs. */
function cleanOcrArtifacts(text: string): string {
  return text
    .replace(/\f/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/[|]{2,}/g, " ")
    .replace(/(?<=\w)[|](?=\w)/g, "l")
    .replace(/(?<=\s)[|](?=\s)/g, " ")
    .replace(/\b0(?=[A-Z])/g, "O")
    .replace(/(\w)\s+-\s+(\w)/g, "$1-$2")
    .replace(/ {2,}/g, " ");
}

function stripMetadataLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (FOOTER_PATTERNS.some((p) => p.test(line))) continue;
    if (METADATA_LINE_PATTERNS.some((p) => p.test(line))) continue;
    if (/^\d{1,3}$/.test(line)) continue;
    kept.push(line);
  }

  return kept.join("\n");
}

/** Full cleaning pipeline after pdf-parse or OCR extraction. */
export function prepareSyllabusText(rawText: string): string {
  const normalized = cleanOcrArtifacts(rawText);
  const withoutMetadata = stripMetadataLines(normalized);
  return cleanSyllabusText(withoutMetadata);
}

export function countSyllabusLines(text: string): number {
  return text.split("\n").filter((l) => l.trim().length > 2).length;
}
