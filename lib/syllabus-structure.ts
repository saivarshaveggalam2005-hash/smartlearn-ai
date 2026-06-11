/**
 * Syllabus structure helpers — UNIT/CHAPTER/MODULE are containers, not topics/keywords.
 */

const UNIT_HEADER_REGEX =
  /^(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+\s*[:.]?\s*$/i;

const UNIT_INLINE_REGEX =
  /\b(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+\b/gi;

const ROMAN_NUMERAL_ONLY = /^[IVXLC]+$/i;

const STRUCTURAL_WORDS = new Set([
  "unit",
  "chapter",
  "module",
  "part",
  "section",
  "units",
  "chapters",
  "modules",
]);

/** Lone Roman numeral or unit marker — not a study keyword */
export function isUnitStructuralToken(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (ROMAN_NUMERAL_ONLY.test(t)) return true;
  if (/^\d+$/.test(t) && t.length <= 2) return true;
  if (STRUCTURAL_WORDS.has(t.toLowerCase())) return true;
  if (UNIT_HEADER_REGEX.test(t)) return true;
  if (/^(?:UNIT|CHAPTER|MODULE|PART|SECTION)$/i.test(t)) return true;
  return false;
}

/** Full line is only a unit header (container), not content */
export function isUnitHeaderOnly(text: string): boolean {
  const trimmed = text.trim();
  if (UNIT_HEADER_REGEX.test(trimmed)) return true;
  return /^(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+\s*:?\s*$/i.test(
    trimmed
  );
}

/** Strip unit markers from text before keyword/topic extraction */
export function stripUnitMarkers(text: string): string {
  return text
    .replace(UNIT_INLINE_REGEX, " ")
    .replace(/\bUNIT\s*[-–—]?\s*[IVXLC\d]+\s*:?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reject as topic name, subtopic, or keyword */
export function isStructuralSyllabusNoise(text: string): boolean {
  const t = normalizeForCheck(text);
  if (!t || t.length < 2) return true;
  if (isUnitHeaderOnly(t)) return true;
  if (isUnitStructuralToken(t)) return true;
  if (/^(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+$/i.test(t)) {
    return true;
  }
  const words = t.split(/\s+/);
  if (
    words.length <= 3 &&
    words.some((w) => STRUCTURAL_WORDS.has(w.toLowerCase())) &&
    words.some((w) => ROMAN_NUMERAL_ONLY.test(w) || /^\d+$/.test(w))
  ) {
    return true;
  }
  return false;
}

function normalizeForCheck(text: string): string {
  return text.replace(/^[-–—•·▪●]\s*/, "").replace(/\.\s*$/, "").trim();
}

/** Filter keyword list — remove UNIT, II, IV, etc. */
export function filterEducationalKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of keywords) {
    const k = raw.trim();
    if (!k || k.length < 2) continue;
    if (isStructuralSyllabusNoise(k)) continue;
    if (isUnitStructuralToken(k)) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(k);
  }

  return result.slice(0, 12);
}

/** Valid acronym for keywords (not UNIT, not roman numerals) */
export function isValidTechnicalAcronym(token: string): boolean {
  if (!/^[A-Z]{2,8}$/.test(token)) return false;
  if (isUnitStructuralToken(token)) return false;
  if (ROMAN_NUMERAL_ONLY.test(token)) return false;
  return true;
}

/** Split syllabus list text on commas, semicolons, periods, and hyphens */
export function splitSyllabusListItems(text: string): string[] {
  return text
    .split(/[,;]+|(?<=\w)\.\s+(?=[A-Z])|\s+[-–—]\s+/)
    .map((part) =>
      part
        .replace(/^[\d.)]+[\s.:)\-]+/, "")
        .replace(/^[-–—•·▪●]\s*/, "")
        .replace(/\.\s*$/, "")
        .trim()
    )
    .filter(Boolean);
}
