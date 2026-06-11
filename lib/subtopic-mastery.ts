/**
 * Phase 3 — Per-subtopic mastery scores (0–100).
 */

export interface SubtopicMasteryInput {
  completed?: boolean;
  quizScore?: number;
  studyMinutes?: number;
  estimatedShareMinutes?: number;
  revisionsCount?: number;
}

export function calculateSubtopicMastery(input: SubtopicMasteryInput): number {
  let score = 0;

  if (input.completed) score += 40;

  if (input.quizScore !== undefined && input.quizScore >= 0) {
    score += (input.quizScore / 100) * 45;
  } else if (input.completed) {
    score += 20;
  }

  const est = input.estimatedShareMinutes ?? 0;
  const actual = input.studyMinutes ?? 0;
  if (est > 0 && actual > 0) {
    const ratio = actual / est;
    if (ratio >= 0.5 && ratio <= 1.6) score += 10;
  }

  score -= Math.min(12, (input.revisionsCount ?? 0) * 4);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function masteryColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}
