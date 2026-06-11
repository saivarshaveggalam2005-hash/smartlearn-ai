/**
 * Phase 15 — Data-driven learning recommendations (no hardcoded subject logic).
 */

import { isDueForReview } from "@/lib/spaced-repetition";
import type { ITopic } from "@/models/Subject";
import type { IRevisionQueueEntry } from "@/models/Progress";

export interface RecommendationContext {
  weakSubjects?: string[];
  pendingTopics: number;
  streak: number;
  examDate?: Date;
  revisionQueue?: IRevisionQueueEntry[];
  weakTopicIds?: string[];
  averageQuizScore?: number;
  learningFactor?: number;
  subjects?: Array<{
    slug: string;
    subjectName: string;
    topics: ITopic[];
  }>;
}

export interface StructuredRecommendation {
  type: "revision" | "weak_area" | "next_topic" | "practice" | "streak" | "exam";
  message: string;
  subjectSlug?: string;
  topicSlug?: string;
  topicId?: string;
  priority: number;
}

export function buildStructuredRecommendations(
  ctx: RecommendationContext
): StructuredRecommendation[] {
  const recs: StructuredRecommendation[] = [];

  const dueReviews: StructuredRecommendation[] = [];
  for (const subject of ctx.subjects ?? []) {
    for (const topic of subject.topics) {
      if (topic.completed && isDueForReview(topic.nextReviewAt)) {
        dueReviews.push({
          type: "revision",
          message: `Revision due: ${topic.name} (${subject.subjectName})`,
          subjectSlug: subject.slug,
          topicSlug: topic.slug,
          topicId: topic._id?.toString(),
          priority: 90,
        });
      }
    }
  }
  recs.push(...dueReviews.slice(0, 2));

  for (const entry of (ctx.revisionQueue ?? []).slice(0, 2)) {
    recs.push({
      type: "weak_area",
      message: `Review weak topic: ${entry.topicName}`,
      subjectSlug: entry.subjectSlug,
      topicId: entry.topicId,
      priority: 85 - recs.length,
    });
  }

  for (const subject of ctx.subjects ?? []) {
    const weak = subject.topics.filter((t) => t.isWeakTopic && !t.completed);
    for (const t of weak.slice(0, 1)) {
      recs.push({
        type: "weak_area",
        message: `Strengthen: ${t.name} in ${subject.subjectName}`,
        subjectSlug: subject.slug,
        topicSlug: t.slug,
        topicId: t._id?.toString(),
        priority: 75,
      });
    }
  }

  for (const subject of ctx.subjects ?? []) {
    const next = subject.topics.find((t) => !t.completed);
    if (next) {
      recs.push({
        type: "next_topic",
        message: `Continue ${subject.subjectName}: ${next.name}`,
        subjectSlug: subject.slug,
        topicSlug: next.slug,
        topicId: next._id?.toString(),
        priority: 60,
      });
      break;
    }
  }

  if ((ctx.averageQuizScore ?? 0) > 0 && (ctx.averageQuizScore ?? 0) < 65) {
    recs.push({
      type: "practice",
      message:
        "Your quiz average is below 65% — retry weak subtopics before new units.",
      priority: 55,
    });
  }

  if (ctx.streak > 0) {
    recs.push({
      type: "streak",
      message: `Keep your ${ctx.streak}-day streak — study at least 25 minutes today.`,
      priority: 40,
    });
  } else {
    recs.push({
      type: "streak",
      message: "Start a study streak today — even 15 minutes counts.",
      priority: 35,
    });
  }

  if (ctx.examDate) {
    const days = Math.ceil(
      (ctx.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days > 0 && days <= 30) {
      recs.push({
        type: "exam",
        message: `Exam in ${days} day${days === 1 ? "" : "s"} — prioritize revision queue and weak topics.`,
        priority: 95,
      });
    }
  }

  if (ctx.pendingTopics > 0 && recs.length < 3) {
    recs.push({
      type: "next_topic",
      message: `${ctx.pendingTopics} topics remaining — follow your daily plan.`,
      priority: 30,
    });
  }

  return recs
    .sort((a, b) => b.priority - a.priority)
    .filter((r, i, arr) => arr.findIndex((x) => x.message === r.message) === i)
    .slice(0, 5);
}

export function recommendationsToStrings(
  recs: StructuredRecommendation[]
): string[] {
  return recs.map((r) => r.message);
}
