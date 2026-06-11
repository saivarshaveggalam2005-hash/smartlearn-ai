/**
 * Phase 3 — Dynamic study time breakdown (no static easy/medium/hard timers).
 */

import type { DifficultyLevel } from "@/lib/adaptive-study-time";

export interface StudyTimeBreakdown {
  readingMinutes: number;
  understandingMinutes: number;
  practiceMinutes: number;
  quizMinutes: number;
  revisionMinutes: number;
  totalMinutes: number;
}

export interface BreakdownInput {
  totalMinutes: number;
  subtopicCount: number;
  complexityScore?: number;
  difficultyLevel?: DifficultyLevel | "easy" | "medium" | "hard";
  practiceCount?: number;
}

export function calculateStudyTimeBreakdown(
  input: BreakdownInput
): StudyTimeBreakdown {
  const total = Math.max(15, Math.round(input.totalMinutes));
  const subtopics = Math.max(1, input.subtopicCount);
  const complexity = Math.min(100, input.complexityScore ?? 45);
  const practice = input.practiceCount ?? Math.max(1, Math.ceil(subtopics / 2));

  const quizBase = Math.max(5, Math.round(subtopics * 2));
  const revisionBase = complexity > 60 ? 8 : 5;

  let reading = Math.round(total * 0.18);
  let understanding = Math.round(total * 0.32);
  let practiceMin = Math.round(total * 0.28 + practice * 2);
  let quiz = quizBase;
  let revision = revisionBase;

  if (complexity > 70) {
    understanding += 5;
    practiceMin += 5;
  }

  const sum = reading + understanding + practiceMin + quiz + revision;
  const scale = total / sum;

  reading = Math.max(3, Math.round(reading * scale));
  understanding = Math.max(5, Math.round(understanding * scale));
  practiceMin = Math.max(5, Math.round(practiceMin * scale));
  quiz = Math.max(5, Math.round(quiz * scale));
  revision = Math.max(3, Math.round(revision * scale));

  const adjustedTotal =
    reading + understanding + practiceMin + quiz + revision;

  return {
    readingMinutes: reading,
    understandingMinutes: understanding,
    practiceMinutes: practiceMin,
    quizMinutes: quiz,
    revisionMinutes: revision,
    totalMinutes: adjustedTotal,
  };
}
