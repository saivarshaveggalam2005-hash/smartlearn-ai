/**
 * Phase 8 — Mastery scoring (0–100) from behavior, not completion alone.
 */

export interface MasteryInput {
  quizScore?: number;
  subtopicProgress?: Array<{
    completed?: boolean;
    skipped?: boolean;
    quizScore?: number;
  }>;
  completed?: boolean;
  revisionsCount?: number;
  actualMinutesSpent?: number;
  estimatedMinutes?: number;
}

export function calculateMasteryScore(input: MasteryInput): number {
  let score = 0;

  const subtopics = input.subtopicProgress ?? [];
  if (subtopics.length > 0) {
    const passed = subtopics.filter((s) => s.completed && !s.skipped);
    const withQuiz = subtopics.filter((s) => s.quizScore !== undefined);
    const avgSubQuiz =
      withQuiz.length > 0
        ? withQuiz.reduce((sum, s) => sum + (s.quizScore ?? 0), 0) / withQuiz.length
        : 0;

    score += (passed.length / subtopics.length) * 35;
    score += (avgSubQuiz / 100) * 25;
  } else if (input.quizScore !== undefined) {
    score += (input.quizScore / 100) * 45;
  }

  if (input.quizScore !== undefined) {
    score += (input.quizScore / 100) * 25;
  }

  if (input.completed) {
    score += 15;
  }

  const estimated = input.estimatedMinutes ?? 0;
  const actual = input.actualMinutesSpent ?? 0;
  if (estimated > 0 && actual > 0) {
    const ratio = actual / estimated;
    if (ratio >= 0.7 && ratio <= 1.4) score += 10;
    else if (ratio > 1.5) score -= 5;
  }

  const revisions = input.revisionsCount ?? 0;
  score -= Math.min(15, revisions * 3);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function masteryLabel(score: number): "beginner" | "developing" | "proficient" | "mastered" {
  if (score >= 85) return "mastered";
  if (score >= 65) return "proficient";
  if (score >= 40) return "developing";
  return "beginner";
}
