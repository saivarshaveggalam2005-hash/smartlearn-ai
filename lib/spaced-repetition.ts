/**
 * Phase 10 — Spaced repetition scheduling (1 → 3 → 7 → 14 → 30 days).
 */

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export interface ReviewSchedule {
  nextReviewAt: Date;
  reviewIntervalDays: number;
}

export function scheduleNextReview(
  quizScore: number,
  currentIntervalDays = 0
): ReviewSchedule {
  let intervalIndex = REVIEW_INTERVALS_DAYS.findIndex((d) => d === currentIntervalDays);

  if (quizScore >= 80) {
    intervalIndex = Math.min(
      REVIEW_INTERVALS_DAYS.length - 1,
      Math.max(0, intervalIndex + 1)
    );
  } else if (quizScore < 60) {
    intervalIndex = 0;
  } else if (intervalIndex < 0) {
    intervalIndex = 0;
  }

  const reviewIntervalDays = REVIEW_INTERVALS_DAYS[intervalIndex];
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + reviewIntervalDays);

  return { nextReviewAt, reviewIntervalDays };
}

export function isDueForReview(nextReviewAt?: Date | string | null): boolean {
  if (!nextReviewAt) return false;
  return new Date(nextReviewAt) <= new Date();
}

export function daysUntilReview(nextReviewAt?: Date | string | null): number {
  if (!nextReviewAt) return 0;
  const diff = new Date(nextReviewAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
