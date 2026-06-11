/**
 * winkNLP helpers for syllabus topic extraction (server-side only).
 * Falls back to lightweight heuristics when NLP is unavailable.
 */

type WinkNlp = ReturnType<typeof import("wink-nlp").default>;

let nlpInstance: WinkNlp | null = null;
let nlpReady = false;

function loadNlp(): WinkNlp | null {
  if (nlpReady) return nlpInstance;
  nlpReady = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const winkNLP = require("wink-nlp").default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const model = require("wink-eng-lite-web-model");
    nlpInstance = winkNLP(model);
    return nlpInstance;
  } catch {
    nlpInstance = null;
    return null;
  }
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "on",
  "to",
  "for",
  "with",
  "by",
  "from",
  "as",
  "at",
  "is",
  "are",
  "be",
  "this",
  "that",
  "using",
  "use",
  "uses",
]);

export const EDUCATIONAL_KEYWORDS =
  /\b(concept|architecture|design|algorithm|scheduling|protocol|model|layer|management|overview|introduction|fundamentals|structures?|systems?|memory|process|network|database|analysis|implementation|organization|execution|hierarchy|control|security|services?)\b/i;

export interface NlpTopicMetrics {
  wordCount: number;
  technicalTermDensity: number;
  avgTokenLength: number;
  acronymCount: number;
  uniqueTokenRatio: number;
}

function heuristicMetrics(text: string): NlpTopicMetrics {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (!tokens.length) {
    return {
      wordCount: 0,
      technicalTermDensity: 0,
      avgTokenLength: 0,
      acronymCount: 0,
      uniqueTokenRatio: 0,
    };
  }

  const unique = new Set(tokens);
  const acronyms = (text.match(/\b[A-Z]{2,6}\b/g) ?? []).length;
  const longTokens = tokens.filter((t) => t.length >= 7).length;
  const contentTokens = tokens.filter((t) => !STOP_WORDS.has(t));

  return {
    wordCount: tokens.length,
    technicalTermDensity:
      contentTokens.length > 0
        ? Math.min(1, (longTokens + acronyms) / contentTokens.length)
        : 0,
    avgTokenLength:
      tokens.reduce((s, t) => s + t.length, 0) / tokens.length,
    acronymCount: acronyms,
    uniqueTokenRatio: unique.size / tokens.length,
  };
}

export function analyzeTopicText(text: string): NlpTopicMetrics {
  const trimmed = text.trim();
  if (!trimmed) return heuristicMetrics("");

  const nlp = loadNlp();
  if (!nlp) return heuristicMetrics(trimmed);

  try {
    const doc = nlp.readDoc(trimmed);
    const tokens = doc.tokens().out();
    if (!tokens.length) return heuristicMetrics(trimmed);

    const normalized = tokens.map((t: string) => t.toLowerCase());
    const unique = new Set(normalized);
    const content = normalized.filter(
      (t: string) => t.length > 2 && !STOP_WORDS.has(t)
    );
    const longTokens = content.filter((t: string) => t.length >= 7).length;
    const acronyms = (trimmed.match(/\b[A-Z]{2,6}\b/g) ?? []).length;

    return {
      wordCount: normalized.length,
      technicalTermDensity:
        content.length > 0
          ? Math.min(1, (longTokens + acronyms) / content.length)
          : 0,
      avgTokenLength:
        normalized.reduce((s: number, t: string) => s + t.length, 0) /
        normalized.length,
      acronymCount: acronyms,
      uniqueTokenRatio: unique.size / normalized.length,
    };
  } catch {
    return heuristicMetrics(trimmed);
  }
}

export function combineTopicMetrics(
  title: string,
  subtopics: string[]
): NlpTopicMetrics {
  const combined = [title, ...subtopics].join(" ");
  return analyzeTopicText(combined);
}

function countLetters(text: string): { upper: number; lower: number; total: number } {
  let upper = 0;
  let lower = 0;
  for (const ch of text) {
    if (ch >= "A" && ch <= "Z") upper++;
    else if (ch >= "a" && ch <= "z") lower++;
  }
  return { upper, lower, total: upper + lower };
}

/** ALL-CAPS section headings (e.g. OPERATING SYSTEM OVERVIEW) */
export function isMainSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 90) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 12) return false;

  const { upper, total } = countLetters(trimmed);
  if (total === 0) return false;

  const upperRatio = upper / total;
  return upperRatio >= 0.8;
}

export function isGenericUnitTitle(title: string): boolean {
  return /^(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s+[IVXLC\d]+$/i.test(
    title.trim()
  );
}

/** Split collapsed PDF lines into separate syllabus phrases */
export function segmentSyllabusLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const hasHyphenList = /[-–—]/.test(trimmed) && /[,;]/.test(trimmed);
  if (/[,;]/.test(trimmed) && !hasHyphenList) {
    return trimmed
      .split(/[,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const nlp = loadNlp();
  if (nlp) {
    try {
      const doc = nlp.readDoc(trimmed);
      const sentences = doc.sentences().out() as string[];
      if (sentences.length > 1) {
        return sentences.map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }

  const byTitleCaseBoundary = trimmed
    .split(/(?<=[a-z])\s+(?=[A-Z])|(?<=[a-z])\s+(?=[A-Z]{2,6}\b)/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (byTitleCaseBoundary.length > 1) {
    return byTitleCaseBoundary;
  }

  const byMultiSpace = trimmed
    .split(/\s{2,}|\t+|(?:\s*[•·▪●]\s*)/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (byMultiSpace.length > 1) {
    return byMultiSpace;
  }

  return [trimmed];
}

/** Extract noun-phrase style topic candidates from a line */
export function extractTopicPhrases(line: string): string[] {
  const segments = segmentSyllabusLine(line);
  const phrases: string[] = [];

  for (const segment of segments) {
    const nlp = loadNlp();
    if (nlp) {
      try {
        const doc = nlp.readDoc(segment);
        const entities = doc.entities().out() as string[];
        for (const entity of entities) {
          const cleaned = entity.trim();
          if (cleaned.length >= 3 && cleaned.length <= 80) {
            phrases.push(cleaned);
          }
        }

        const nouns = doc
          .tokens()
          .filter((t: { out: (f?: string) => string }) => t.out("pos") === "NOUN")
          .out() as string[];

        if (nouns.length >= 2 && nouns.length <= 6 && segment.split(/\s+/).length <= 8) {
          phrases.push(segment);
          continue;
        }
      } catch {
        /* heuristic fallback below */
      }
    }

    phrases.push(segment);
  }

  return phrases;
}

export function scoreTopicCandidate(phrase: string): number {
  const trimmed = phrase.trim();
  if (!trimmed) return 0;

  let score = 0;
  const words = trimmed.split(/\s+/);

  if (words.length >= 1 && words.length <= 8) score += 2;
  if (EDUCATIONAL_KEYWORDS.test(trimmed)) score += 3;
  if (/\b[A-Z]{2,6}\b/.test(trimmed)) score += 1;

  const metrics = analyzeTopicText(trimmed);
  score += metrics.technicalTermDensity * 2;

  if (/^\d/.test(trimmed)) score -= 3;
  if (words.length > 10) score -= 2;

  return score;
}

export function looksLikeSubtopicLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isMainSectionHeading(trimmed)) return false;

  if (/^[\d.)]+\s/.test(trimmed)) return true;
  if (/[,;:]/.test(trimmed)) return true;
  if (/^[-–—]\s/.test(trimmed)) return true;

  const words = trimmed.split(/\s+/);
  if (words.length <= 8 && scoreTopicCandidate(trimmed) >= 2) return true;

  return words.length <= 6;
}

const ALGORITHM_PATTERN =
  /\b(algorithms?|sorting|searching|routing|scheduling|parsing|compilation|optimization|dynamic programming|greedy|backtracking|recursion|graph traversal|deadlock detection|congestion control)\b/gi;

const FORMULA_PATTERN =
  /\b(formulas?|equations?|theorems?|proofs?|derivations?|calculations?|complexity analysis|big-o|o\s*\(\s*n)\b/gi;

const PROGRAMMING_PATTERN =
  /\b(programming|implementation|syntax|pointer|pointers|function|functions|class|classes|object-oriented|oop|code|coding|microcontroller|instruction set|assembly|gpio|register|memory allocation|system calls?)\b/gi;

const TECHNICAL_TERM_PATTERN =
  /\b(concept|architecture|design|protocol|model|layer|management|overview|introduction|fundamentals|structures?|systems?|memory|process|network|database|analysis|organization|execution|hierarchy|control|security|services?|interfac\w*|peripheral\w*|kernel|interrupt\w*|dma|cache|embedded|compiler|operating system)\b/gi;

export interface ExtractedComplexityFeatures {
  subtopicCount: number;
  technicalTermCount: number;
  algorithmCount: number;
  formulaCount: number;
  programmingConceptCount: number;
  topicLength: number;
  conceptDiversity: number;
}

function countPatternMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches?.length ?? 0;
}

/** Phase 2 — NLP/heuristic feature extraction for complexity scoring */
export function extractComplexityFeaturesFromText(
  text: string,
  subtopicCount = 0
): ExtractedComplexityFeatures {
  const trimmed = text.trim();
  const metrics = analyzeTopicText(trimmed);
  const tokens = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const uniqueTokens = new Set(tokens);

  const technicalTermCount =
    countPatternMatches(trimmed, TECHNICAL_TERM_PATTERN) +
    Math.round(metrics.technicalTermDensity * Math.max(tokens.length, 1) * 0.5) +
    metrics.acronymCount;

  return {
    subtopicCount: Math.max(subtopicCount, 1),
    technicalTermCount,
    algorithmCount: countPatternMatches(trimmed, ALGORITHM_PATTERN),
    formulaCount: countPatternMatches(trimmed, FORMULA_PATTERN),
    programmingConceptCount: countPatternMatches(trimmed, PROGRAMMING_PATTERN),
    topicLength: tokens.length,
    conceptDiversity: uniqueTokens.size,
  };
}
