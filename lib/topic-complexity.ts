/**
 * Phases 2–4 — Domain-agnostic topic complexity, difficulty, and baseline time.
 */

import type { DifficultyLevel } from "@/lib/adaptive-study-time";
import { extractComplexityFeaturesFromText } from "@/lib/syllabus-nlp";

export interface ComplexityFeatures {
  subtopicCount: number;
  technicalTermCount: number;
  algorithmCount: number;
  formulaCount: number;
  programmingConceptCount: number;
  topicLength: number;
  conceptDiversity: number;
}

export interface ComplexityAnalysis {
  features: ComplexityFeatures;
  complexityScore: number;
  difficultyLevel: DifficultyLevel;
  baselineEstimatedMinutes: number;
  hierarchyDepth: number;
}

const BASE_MINUTES: Record<DifficultyLevel, number> = {
  easy: 15,
  medium: 30,
  hard: 45,
  very_hard: 60,
};

const MIN_STUDY_MINUTES = 15;
const MAX_STUDY_MINUTES = 120;

export function calculateComplexityScore(features: ComplexityFeatures): number {
  const raw =
    features.subtopicCount * 5 +
    features.technicalTermCount * 2 +
    features.algorithmCount * 10 +
    features.formulaCount * 10 +
    features.programmingConceptCount * 5 +
    Math.min(15, Math.round(features.topicLength / 12)) +
    features.conceptDiversity * 3;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Phase 3 — dynamic difficulty from complexity score (0–100) */
export function classifyDifficultyFromScore(score: number): DifficultyLevel {
  const normalized = Math.min(100, Math.max(0, Math.round(score)));
  if (normalized <= 30) return "easy";
  if (normalized <= 70) return "medium";
  return "hard";
}

/** Phase 4 — baseline time before personalization */
export function calculateBaselineStudyMinutes(
  difficulty: DifficultyLevel,
  features: ComplexityFeatures
): number {
  const base = BASE_MINUTES[difficulty];
  const minutes =
    base +
    features.subtopicCount * 5 +
    features.algorithmCount * 5 +
    features.formulaCount * 5;

  return Math.min(
    MAX_STUDY_MINUTES,
    Math.max(MIN_STUDY_MINUTES, Math.round(minutes))
  );
}

export interface ComplexityInput {
  title: string;
  subtopics?: string[];
  hierarchyDepth?: number;
}

export function analyzeTopicComplexity(input: ComplexityInput): ComplexityAnalysis {
  const subtopics = input.subtopics ?? [];
  const combinedText = [input.title, ...subtopics].join(" ");
  const extracted = extractComplexityFeaturesFromText(combinedText, subtopics.length);

  const features: ComplexityFeatures = {
    subtopicCount: Math.max(subtopics.length, extracted.subtopicCount, 1),
    technicalTermCount: extracted.technicalTermCount,
    algorithmCount: extracted.algorithmCount,
    formulaCount: extracted.formulaCount,
    programmingConceptCount: extracted.programmingConceptCount,
    topicLength: extracted.topicLength,
    conceptDiversity: extracted.conceptDiversity,
  };

  const complexityScore = calculateComplexityScore(features);
  const difficultyLevel = classifyDifficultyFromScore(complexityScore);
  const baselineEstimatedMinutes = calculateBaselineStudyMinutes(
    difficultyLevel,
    features
  );
  const hierarchyDepth =
    input.hierarchyDepth ?? (subtopics.length > 0 ? 3 : 2);

  return {
    features,
    complexityScore,
    difficultyLevel,
    baselineEstimatedMinutes,
    hierarchyDepth,
  };
}

export function clampStudyMinutes(minutes: number): number {
  return Math.min(
    MAX_STUDY_MINUTES,
    Math.max(MIN_STUDY_MINUTES, Math.round(minutes))
  );
}
