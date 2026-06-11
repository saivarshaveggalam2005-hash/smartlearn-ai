/**
 * Extraction quality validation for parsed syllabus structures.
 */

import type { ParsedSyllabus } from "@/lib/syllabus-parser";
import { scoreRawExtractedText } from "@/lib/pdf-detect";
import { countSyllabusLines } from "@/lib/syllabus-text-clean";

export interface ExtractionQualityReport {
  score: number;
  unitCount: number;
  topicCount: number;
  subtopicCount: number;
  emptyUnits: number;
  duplicateTopics: number;
  issues: string[];
  shouldRetryOcr: boolean;
}

function countParsedTopics(parsed: ParsedSyllabus): {
  topicCount: number;
  subtopicCount: number;
  emptyUnits: number;
  duplicateTopics: number;
} {
  const seen = new Set<string>();
  let duplicateTopics = 0;
  let topicCount = 0;
  let subtopicCount = 0;
  let emptyUnits = 0;

  for (const unit of parsed.units) {
    let unitHasContent = false;

    for (const node of unit.topics) {
      if (node.subtopics.length > 0) {
        unitHasContent = true;
        for (const sub of node.subtopics) {
          subtopicCount++;
          const key = sub.toLowerCase();
          if (seen.has(key)) duplicateTopics++;
          else seen.add(key);
        }
      } else if (node.title.trim()) {
        unitHasContent = true;
        topicCount++;
        const key = node.title.toLowerCase();
        if (seen.has(key)) duplicateTopics++;
        else seen.add(key);
      }
    }

    if (!unitHasContent && unit.title.trim()) {
      emptyUnits++;
    }
  }

  return { topicCount, subtopicCount, emptyUnits, duplicateTopics };
}

export function assessExtractionQuality(
  parsed: ParsedSyllabus,
  cleanedText: string,
  extractionMethod?: string
): ExtractionQualityReport {
  const issues: string[] = [];
  const { topicCount, subtopicCount, emptyUnits, duplicateTopics } =
    countParsedTopics(parsed);
  const unitCount = parsed.units.length;
  const totalItems = topicCount + subtopicCount;

  let score = 0;
  score += Math.min(25, unitCount * 8);
  score += Math.min(40, totalItems * 3);
  score += Math.min(15, scoreRawExtractedText(cleanedText) / 4);
  score += Math.min(10, countSyllabusLines(cleanedText));

  if (unitCount === 0) {
    issues.push("No units detected");
    score -= 20;
  }

  if (totalItems < 3) {
    issues.push("Too few topics extracted");
    score -= 25;
  }

  if (emptyUnits > 0) {
    issues.push(`${emptyUnits} unit(s) have no topics`);
    score -= emptyUnits * 5;
  }

  if (duplicateTopics > totalItems * 0.3) {
    issues.push("High duplicate topic rate");
    score -= 10;
  }

  if (totalItems > 0 && subtopicCount === 0 && unitCount <= 1) {
    issues.push("Flat topic list — hierarchy may be incomplete");
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const shouldRetryOcr =
    extractionMethod !== "pdf-ocr" &&
    (totalItems < 3 ||
      score < 35 ||
      (unitCount === 0 && countSyllabusLines(cleanedText) >= 5));

  return {
    score,
    unitCount,
    topicCount,
    subtopicCount,
    emptyUnits,
    duplicateTopics,
    issues,
    shouldRetryOcr,
  };
}

export function pickBetterParsedResult(
  current: { parsed: ParsedSyllabus; text: string; quality: ExtractionQualityReport },
  candidate: { parsed: ParsedSyllabus; text: string; quality: ExtractionQualityReport }
): typeof current {
  if (candidate.quality.score > current.quality.score + 3) {
    return candidate;
  }

  const currentItems = current.quality.topicCount + current.quality.subtopicCount;
  const candidateItems =
    candidate.quality.topicCount + candidate.quality.subtopicCount;

  if (candidateItems > currentItems + 2) {
    return candidate;
  }

  return current;
}
