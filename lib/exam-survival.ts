/**
 * Phase 8 — Exam survival / crash plan generator.
 */

import { isDueForReview } from "@/lib/spaced-repetition";

export interface SurvivalTopicInput {
  id: string;
  slug: string;
  name: string;
  subjectSlug: string;
  subjectName: string;
  completed: boolean;
  isWeakTopic: boolean;
  masteryScore?: number;
  estimatedMinutes: number;
  nextReviewAt?: Date | string | null;
  inRevisionQueue?: boolean;
}

export interface SurvivalBlock {
  topicId: string;
  topicName: string;
  subjectSlug: string;
  subjectName: string;
  minutes: number;
  reason: "weak" | "revision" | "unfinished" | "review";
  studyHref: string;
}

export interface ExamSurvivalPlan {
  totalMinutes: number;
  hoursAvailable: number;
  estimatedCoverage: number;
  blocks: SurvivalBlock[];
  weakAreasIncluded: string[];
}

function priorityScore(topic: SurvivalTopicInput): number {
  let score = 0;
  if (topic.isWeakTopic) score += 50;
  if (!topic.completed) score += 40;
  if ((topic.masteryScore ?? 100) < 50) score += 35;
  if (topic.inRevisionQueue) score += 25;
  if (isDueForReview(topic.nextReviewAt)) score += 30;
  if (topic.completed && (topic.masteryScore ?? 0) >= 75) score -= 20;
  return score;
}

export function buildExamSurvivalPlan(input: {
  hoursAvailable: number;
  topics: SurvivalTopicInput[];
}): ExamSurvivalPlan {
  const budgetMinutes = Math.max(30, Math.round(input.hoursAvailable * 60));
  const ranked = [...input.topics]
    .map((t) => ({ topic: t, priority: priorityScore(t) }))
    .filter((x) => x.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  const blocks: SurvivalBlock[] = [];
  let used = 0;
  const weakAreasIncluded: string[] = [];

  for (const { topic } of ranked) {
    if (used >= budgetMinutes) break;

    const base = Math.max(10, Math.min(topic.estimatedMinutes, 25));
    const remaining = budgetMinutes - used;
    const minutes = Math.min(base, remaining);
    if (minutes < 8) break;

    let reason: SurvivalBlock["reason"] = "review";
    if (topic.isWeakTopic || (topic.masteryScore ?? 100) < 50) {
      reason = "weak";
      weakAreasIncluded.push(topic.name);
    } else if (!topic.completed) {
      reason = "unfinished";
    } else if (isDueForReview(topic.nextReviewAt)) {
      reason = "revision";
    }

    blocks.push({
      topicId: topic.id,
      topicName: topic.name,
      subjectSlug: topic.subjectSlug,
      subjectName: topic.subjectName,
      minutes,
      reason,
      studyHref: `/study/${topic.slug}?subject=${topic.subjectSlug}&topicId=${topic.id}`,
    });

    used += minutes;
  }

  const totalTopics = input.topics.length || 1;
  const coveredTopics = new Set(blocks.map((b) => b.topicId)).size;
  const weakCoverage = weakAreasIncluded.length > 0 ? 15 : 0;
  const estimatedCoverage = Math.min(
    100,
    Math.round((coveredTopics / totalTopics) * 70 + weakCoverage + (used / budgetMinutes) * 15)
  );

  return {
    totalMinutes: used,
    hoursAvailable: input.hoursAvailable,
    estimatedCoverage,
    blocks,
    weakAreasIncluded: [...new Set(weakAreasIncluded)].slice(0, 8),
  };
}
