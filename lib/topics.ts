import type { ISubject, ITopic } from "@/models/Subject";
import { applyAdaptiveFieldsToTopic, type AnalyzedTopic } from "@/lib/topic-analyzer";

export function findTopicById(
  topics: ITopic[],
  topicId: string
): ITopic | undefined {
  return topics.find((t) => t._id?.toString() === topicId);
}

/** Keep nested unit topics in sync with the flat topics array used by the UI */
export function syncFlatTopicToUnits(subject: ISubject, flatTopic: ITopic): void {
  if (!subject.units?.length) return;

  for (const unit of subject.units) {
    const nested = unit.topics.find((t) => t.slug === flatTopic.slug);
    if (!nested) continue;

    nested.completed = flatTopic.completed;
    nested.completionStatus = flatTopic.completionStatus;
    nested.revisionStatus = flatTopic.revisionStatus;
    nested.difficulty = flatTopic.difficulty;
    nested.estimatedHours = flatTopic.estimatedHours;
    nested.estimatedMinutes = flatTopic.estimatedMinutes;
    nested.baselineEstimatedMinutes = flatTopic.baselineEstimatedMinutes;
    nested.subtopicCount = flatTopic.subtopicCount;
    nested.hierarchyDepth = flatTopic.hierarchyDepth;
    nested.parentTopicTitle = flatTopic.parentTopicTitle;
    nested.practiceCount = flatTopic.practiceCount;
    nested.learningOutcomeCount = flatTopic.learningOutcomeCount;
    nested.recommendedPomodoros = flatTopic.recommendedPomodoros;
    nested.actualMinutesSpent = flatTopic.actualMinutesSpent;
    nested.revisionsCount = flatTopic.revisionsCount;
    nested.difficultyScore = flatTopic.difficultyScore;
    nested.complexityScore = flatTopic.complexityScore;
    nested.learningFactor = flatTopic.learningFactor;
    nested.weakTopicScore = flatTopic.weakTopicScore;
    nested.markedDifficult = flatTopic.markedDifficult;
    nested.isWeakTopic = flatTopic.isWeakTopic;
    nested.studyMinutes = flatTopic.studyMinutes;
    nested.revisionPriority = flatTopic.revisionPriority;
    nested.inRevisionQueue = flatTopic.inRevisionQueue;
    nested.quizScore = flatTopic.quizScore;
    nested.initialDifficultyLevel = flatTopic.initialDifficultyLevel;
  }
}

export function applyAnalyzedToTopic(
  topic: ITopic,
  analyzed: AnalyzedTopic,
  options?: { incrementRevisions?: boolean }
): void {
  applyAdaptiveFieldsToTopic(topic as unknown as Record<string, unknown>, analyzed);
  topic.studyMinutes = topic.actualMinutesSpent ?? topic.studyMinutes ?? 0;
  if (options?.incrementRevisions) {
    topic.revisionsCount = (topic.revisionsCount ?? 0) + 1;
  }
}
