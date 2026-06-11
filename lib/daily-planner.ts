/**
 * Phase 11 — Daily learning planner helpers (revision queue + summaries).
 */

import { isDueForReview } from "@/lib/spaced-repetition";
import type { ITopic } from "@/models/Subject";
import type { IRevisionQueueEntry } from "@/models/Progress";

export interface DailyRevisionItem {
  subjectSlug: string;
  subjectName: string;
  topicSlug: string;
  topicId: string;
  topicName: string;
  masteryScore?: number;
  nextReviewAt?: Date;
}

export interface DailyPlanSummary {
  revisionCount: number;
  learningCount: number;
  estimatedMinutes: number;
  revisions: DailyRevisionItem[];
}

export function getTodaysRevisionQueue(
  subjects: Array<{ slug: string; subjectName: string; topics: ITopic[] }>
): DailyRevisionItem[] {
  const items: DailyRevisionItem[] = [];

  for (const subject of subjects) {
    for (const topic of subject.topics) {
      if (!topic.completed && !isDueForReview(topic.nextReviewAt)) continue;
      if (topic.completed && isDueForReview(topic.nextReviewAt)) {
        items.push({
          subjectSlug: subject.slug,
          subjectName: subject.subjectName,
          topicSlug: topic.slug,
          topicId: topic._id?.toString() ?? "",
          topicName: topic.name,
          masteryScore: topic.masteryScore,
          nextReviewAt: topic.nextReviewAt,
        });
      }
    }
  }

  return items.sort(
    (a, b) =>
      (a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0) -
      (b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0)
  );
}

export function averageMasteryScore(topics: ITopic[]): number {
  const scored = topics.filter(
    (t) => t.masteryScore !== undefined && (t.masteryScore ?? 0) > 0
  );
  if (!scored.length) return 0;
  return Math.round(
    scored.reduce((sum, t) => sum + (t.masteryScore ?? 0), 0) / scored.length
  );
}

export function learningSpeedLabel(
  learningFactor: number
): "fast" | "normal" | "slow" {
  if (learningFactor < 0.85) return "fast";
  if (learningFactor > 1.15) return "slow";
  return "normal";
}

export function buildDailyPlanSummary(input: {
  subjects: Array<{ slug: string; subjectName: string; topics: ITopic[] }>;
  revisionQueue?: IRevisionQueueEntry[];
  dailyStudyMinutes?: number;
}): DailyPlanSummary {
  const revisions = getTodaysRevisionQueue(input.subjects);
  const queueExtras = (input.revisionQueue ?? []).slice(0, 3);

  const revisionMinutes = revisions.length * 20 + queueExtras.length * 15;
  const learningMinutes = Math.max(
    0,
    (input.dailyStudyMinutes ?? 60) - Math.min(revisionMinutes, 30)
  );

  return {
    revisionCount: revisions.length + queueExtras.length,
    learningCount: Math.max(1, Math.ceil(learningMinutes / 35)),
    estimatedMinutes: revisionMinutes + learningMinutes,
    revisions: revisions.slice(0, 5),
  };
}
