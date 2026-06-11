/**
 * Orchestrates mastery, spaced repetition, and graph updates on topics.
 */

import { calculateMasteryScore } from "@/lib/mastery-engine";
import { scheduleNextReview, isDueForReview } from "@/lib/spaced-repetition";
import type { ITopic } from "@/models/Subject";

export function refreshTopicIntelligence(topic: ITopic): void {
  topic.masteryScore = calculateMasteryScore({
    quizScore: topic.quizScore,
    subtopicProgress: topic.subtopicProgress,
    completed: topic.completed,
    revisionsCount: topic.revisionsCount,
    actualMinutesSpent: topic.actualMinutesSpent ?? topic.studyMinutes,
    estimatedMinutes: topic.estimatedMinutes,
  });

  const quizForSchedule =
    topic.quizScore ?? (topic.completed ? 75 : undefined);

  if (quizForSchedule !== undefined) {
    const schedule = scheduleNextReview(
      quizForSchedule,
      topic.reviewIntervalDays ?? 0
    );
    topic.nextReviewAt = schedule.nextReviewAt;
    topic.reviewIntervalDays = schedule.reviewIntervalDays;
  }

  if (isDueForReview(topic.nextReviewAt) && !topic.inRevisionQueue) {
    topic.revisionPriority = Math.min(
      100,
      (topic.revisionPriority ?? 0) + 20
    );
  }
}
