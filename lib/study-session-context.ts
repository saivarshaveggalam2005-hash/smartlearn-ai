/**
 * Server-side assembly of study session coach/mission/graph props.
 */

import { calculateSubjectConfidence } from "@/lib/confidence-engine";
import { buildTopicMission, type TopicMission } from "@/lib/mission-engine";
import { buildCoachMessages, type CoachMessage } from "@/lib/study-coach";
import { calculateSubtopicMastery } from "@/lib/subtopic-mastery";
import { calculateMasteryScore } from "@/lib/mastery-engine";
import { isDueForReview } from "@/lib/spaced-repetition";
import {
  buildLearningGraph,
  isTopicUnlocked,
} from "@/lib/learning-graph";
import type { ITopic } from "@/models/Subject";
import type { GraphNodeView } from "@/components/study/knowledge-graph-strip";
import type { SubtopicMasteryView } from "@/components/study/mastery-confidence-panel";

export interface StudySessionContext {
  subjectName: string;
  mission: TopicMission;
  coachMessages: CoachMessage[];
  topicMastery: number;
  subjectConfidence: number;
  readyForExam: boolean;
  confidenceLabel: string;
  subtopicMastery: SubtopicMasteryView[];
  graphNodes: GraphNodeView[];
  prerequisiteNames: string[];
  revisionStatus?: string;
}

export function buildStudySessionContext(input: {
  subjectName: string;
  topic: ITopic;
  allTopics: ITopic[];
  subtopics: string[];
  subtopicProgress: Array<{
    title: string;
    completed?: boolean;
    skipped?: boolean;
    quizScore?: number;
  }>;
}): StudySessionContext {
  const { topic, allTopics, subtopics, subtopicProgress } = input;

  const topicMastery =
    topic.masteryScore ??
    calculateMasteryScore({
      quizScore: topic.quizScore,
      subtopicProgress,
      completed: topic.completed,
      revisionsCount: topic.revisionsCount,
      actualMinutesSpent: topic.actualMinutesSpent ?? topic.studyMinutes,
      estimatedMinutes: topic.estimatedMinutes,
    });

  const shareMinutes =
    subtopics.length > 0
      ? Math.max(5, Math.round((topic.estimatedMinutes ?? 30) / subtopics.length))
      : topic.estimatedMinutes ?? 30;

  const subtopicMastery: SubtopicMasteryView[] = subtopics.map((title) => {
    const saved = subtopicProgress.find(
      (p) => p.title.toLowerCase() === title.toLowerCase()
    );
    return {
      title,
      score: calculateSubtopicMastery({
        completed: saved?.completed,
        quizScore: saved?.quizScore,
        estimatedShareMinutes: shareMinutes,
        revisionsCount: topic.revisionsCount,
      }),
    };
  });

  const subjectConfidenceResult = calculateSubjectConfidence(
    input.subjectName,
    allTopics.map((t) => ({
      name: t.name,
      completed: t.completed,
      masteryScore: t.masteryScore,
      quizScore: t.quizScore,
      isWeakTopic: t.isWeakTopic,
      revisionsCount: t.revisionsCount,
    }))
  );

  const slugToTopic = new Map(allTopics.map((t) => [t.slug, t]));
  const prerequisites = (topic.prerequisites ?? [])
    .map((slug) => slugToTopic.get(slug))
    .filter(Boolean) as ITopic[];

  const weakTopicNames = allTopics
    .filter((t) => t.isWeakTopic && !t.completed)
    .map((t) => t.name);

  const checklistDone = subtopicProgress.filter((p) => p.completed).length;
  const checklistPercent =
    subtopics.length > 0
      ? Math.round((checklistDone / subtopics.length) * 100)
      : topic.completed
        ? 100
        : 0;

  const coachMessages = buildCoachMessages({
    subjectName: input.subjectName,
    topicName: topic.name,
    unitTitle: topic.unitTitle,
    masteryScore: topicMastery,
    completed: topic.completed,
    isWeakTopic: topic.isWeakTopic,
    prerequisites: prerequisites.map((p) => ({
      name: p.name,
      completed: p.completed,
    })),
    weakTopicNames,
    revisionDue: isDueForReview(topic.nextReviewAt),
    checklistPercent,
    quizUnlocked: topic.completed,
  });

  const mission = buildTopicMission({
    topicName: topic.name,
    subtopics,
    subtopicProgress,
    topicCompleted: topic.completed,
  });

  const graph = buildLearningGraph(
    allTopics.map((t) => ({
      slug: t.slug,
      name: t.name,
      unitTitle: t.unitTitle,
      keywords: t.keywords,
    }))
  );

  const completedSlugs = new Set(
    allTopics.filter((t) => t.completed).map((t) => t.slug)
  );

  const unitPeers = allTopics.filter(
    (t) => (t.unitTitle ?? "") === (topic.unitTitle ?? "") || !topic.unitTitle
  );

  const graphNodes: GraphNodeView[] = (unitPeers.length ? unitPeers : allTopics)
    .slice(0, 8)
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      completed: t.completed,
      isCurrent: t.slug === topic.slug,
      unlocked: isTopicUnlocked(t.slug, graph, completedSlugs),
    }));

  let revisionStatus: string | undefined;
  if (topic.nextReviewAt) {
    if (isDueForReview(topic.nextReviewAt)) {
      revisionStatus = "Revision due today — review after studying.";
    } else {
      revisionStatus = `Next revision scheduled after completion.`;
    }
  }

  return {
    subjectName: input.subjectName,
    mission,
    coachMessages,
    topicMastery,
    subjectConfidence: subjectConfidenceResult.score,
    readyForExam: subjectConfidenceResult.readyForExam,
    confidenceLabel: subjectConfidenceResult.label,
    subtopicMastery,
    graphNodes,
    prerequisiteNames: prerequisites.map((p) => p.name),
    revisionStatus,
  };
}
