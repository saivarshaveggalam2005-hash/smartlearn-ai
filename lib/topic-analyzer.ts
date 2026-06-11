import {
  calculateAdaptiveStudyTime,
  recalculateAfterStudySession,
  toLegacyDifficulty,
  type AdaptiveStudyTimeInput,
  type AdaptiveStudyTimeResult,
  type DifficultyLevel,
} from "@/lib/adaptive-study-time";
import {
  detectWeakTopic,
  isStrongFromQuizScore,
  isWeakFromQuizScore,
} from "@/lib/learning-engine";

export type Difficulty = "easy" | "medium" | "hard";
export type CompletionStatus = "not_started" | "in_progress" | "completed";

export interface AnalyzedTopic {
  name: string;
  difficulty: Difficulty;
  difficultyLevel: DifficultyLevel;
  estimatedHours: number;
  estimatedMinutes: number;
  baselineEstimatedMinutes: number;
  subtopicCount: number;
  hierarchyDepth: number;
  practiceCount: number;
  learningOutcomeCount: number;
  recommendedPomodoros: number;
  difficultyScore: number;
  complexityScore: number;
  weakTopicScore: number;
  isWeakTopic: boolean;
  completionStatus: CompletionStatus;
  initialDifficultyLevel: DifficultyLevel;
}

export interface TopicAnalysisContext {
  subjectName?: string;
  weakSubjects?: string[];
  unitTopicCount?: number;
  unitTitle?: string;
  subtopics?: string[];
  parentTopicTitle?: string;
  hierarchyDepth?: number;
  learningFactor?: number;
}

function matchesWeakSubject(
  topicName: string,
  subjectName: string | undefined,
  weakSubjects: string[] | undefined
): boolean {
  if (!weakSubjects?.length) return false;
  const topic = topicName.toLowerCase();
  const subject = subjectName?.toLowerCase() ?? "";
  return weakSubjects.some((weak) => {
    const w = weak.toLowerCase().trim();
    if (!w) return false;
    return topic.includes(w) || subject.includes(w) || w.includes(topic);
  });
}

function toAnalyzedTopic(
  name: string,
  adaptive: AdaptiveStudyTimeResult,
  isWeakTopic: boolean
): AnalyzedTopic {
  return {
    name,
    difficulty: toLegacyDifficulty(adaptive.difficulty),
    difficultyLevel: adaptive.difficulty,
    initialDifficultyLevel: adaptive.difficulty,
    estimatedHours: adaptive.estimatedHours,
    estimatedMinutes: adaptive.estimatedMinutes,
    baselineEstimatedMinutes: adaptive.baselineEstimatedMinutes,
    subtopicCount: adaptive.subtopicCount,
    hierarchyDepth: adaptive.hierarchyDepth,
    practiceCount: adaptive.practiceCount,
    learningOutcomeCount: adaptive.learningOutcomeCount,
    recommendedPomodoros: adaptive.recommendedPomodoros,
    difficultyScore: adaptive.difficultyScore,
    complexityScore: adaptive.complexityScore,
    weakTopicScore: adaptive.weakTopicScore,
    isWeakTopic,
    completionStatus: "not_started",
  };
}

export function analyzeTopic(
  name: string,
  context: TopicAnalysisContext = {}
): AnalyzedTopic {
  const isWeakTopic = matchesWeakSubject(
    name,
    context.subjectName,
    context.weakSubjects
  );

  const adaptive = calculateAdaptiveStudyTime({
    title: name,
    subtopics: context.subtopics,
    subtopicCount: context.subtopics?.length ?? context.unitTopicCount,
    unitTitle: context.unitTitle,
    unitTopicCount: context.unitTopicCount,
    hierarchyDepth: context.hierarchyDepth,
    learningFactor: context.learningFactor ?? 1.0,
    isWeakTopic,
  });

  return toAnalyzedTopic(name.trim(), adaptive, isWeakTopic);
}

export function analyzeTopics(
  topicNames: string[],
  context: TopicAnalysisContext = {}
): AnalyzedTopic[] {
  const seen = new Set<string>();
  return topicNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((name) => analyzeTopic(name, { ...context, unitTopicCount: 1 }));
}

export function analyzeTopicWithAdaptiveInput(
  input: AdaptiveStudyTimeInput
): AnalyzedTopic {
  const adaptive = calculateAdaptiveStudyTime(input);
  return toAnalyzedTopic(
    input.title,
    adaptive,
    input.isWeakTopic ?? false
  );
}

export function adaptTopicAfterSession(
  topic: AdaptiveStudyTimeInput & {
    estimatedMinutes?: number;
    baselineEstimatedMinutes?: number;
    completed?: boolean;
    sessionDurationMinutes: number;
    isWeakTopic?: boolean;
    quizScore?: number;
  },
  learningFactor = 1.0
): AnalyzedTopic {
  const adaptive = recalculateAfterStudySession(topic, learningFactor);
  const weak = detectWeakTopic({
    quizScore: topic.quizScore,
    revisionsCount: topic.revisionsCount,
    actualMinutesSpent: topic.actualMinutesSpent,
    estimatedMinutes: topic.estimatedMinutes ?? topic.baselineEstimatedMinutes,
    markedDifficult: topic.markedDifficult,
    isWeakTopic: topic.isWeakTopic,
  }) ||
    isWeakFromQuizScore(topic.quizScore) ||
    adaptive.weakTopicScore >= 60;
  return toAnalyzedTopic(topic.title, adaptive, weak);
}

export function completionStatusFromTopic(topic: {
  completed?: boolean;
  revisionStatus?: string;
}): CompletionStatus {
  if (topic.completed) return "completed";
  if (topic.revisionStatus === "in_progress") return "in_progress";
  return "not_started";
}

export function applyCompletionStatus(
  topic: {
    completed?: boolean;
    revisionStatus?: string;
    completionStatus?: CompletionStatus;
  },
  status: CompletionStatus
): void {
  topic.completionStatus = status;
  if (status === "completed") {
    topic.completed = true;
    topic.revisionStatus = "done";
  } else if (status === "in_progress") {
    topic.completed = false;
    topic.revisionStatus = "in_progress";
  } else {
    topic.completed = false;
    topic.revisionStatus = "not_started";
  }
}

export function applyAdaptiveFieldsToTopic(
  target: Record<string, unknown>,
  analyzed: AnalyzedTopic | AdaptiveStudyTimeResult
): void {
  target.difficulty = toLegacyDifficulty(analyzed.difficulty as DifficultyLevel);
  target.estimatedHours = analyzed.estimatedHours;
  target.estimatedMinutes = analyzed.estimatedMinutes;
  target.baselineEstimatedMinutes = analyzed.baselineEstimatedMinutes;
  target.subtopicCount = analyzed.subtopicCount;
  target.hierarchyDepth =
    "hierarchyDepth" in analyzed ? analyzed.hierarchyDepth : 2;
  target.practiceCount = analyzed.practiceCount;
  target.learningOutcomeCount =
    "learningOutcomeCount" in analyzed ? analyzed.learningOutcomeCount : 0;
  target.recommendedPomodoros = analyzed.recommendedPomodoros;
  target.difficultyScore = analyzed.difficultyScore;
  target.complexityScore =
    "complexityScore" in analyzed && analyzed.complexityScore !== undefined
      ? analyzed.complexityScore
      : analyzed.difficultyScore;
  target.weakTopicScore = analyzed.weakTopicScore;
  target.learningFactor =
    "learningFactorApplied" in analyzed ? analyzed.learningFactorApplied : 1;
  target.initialDifficultyLevel = analyzed.difficulty;
  if ("isWeakTopic" in analyzed) {
    target.isWeakTopic = analyzed.isWeakTopic;
  }
}

export function applyQuizScoreToTopic(
  topic: Record<string, unknown>,
  quizScore: number
): void {
  topic.quizScore = quizScore;
  topic.isWeakTopic = isWeakFromQuizScore(quizScore);
  if (isStrongFromQuizScore(quizScore)) {
    topic.isWeakTopic = false;
  }
}
