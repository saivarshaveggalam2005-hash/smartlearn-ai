import { analyzeColdStartDifficulty } from "@/lib/cold-start-analyzer";
import {
  calculatePersonalizedStudyTime,
  getRevisionFactor,
  type LearningProfile,
} from "@/lib/learning-engine";

export type DifficultyLevel = "easy" | "medium" | "hard" | "very_hard";

export type { LearningProfile };
export {
  DEFAULT_LEARNING_PROFILE,
  updateLearningFactor,
  calculatePersonalizedStudyTime,
  getRevisionFactor,
  isWeakFromQuizScore,
  isStrongFromQuizScore,
  difficultyLevelToLegacy,
} from "@/lib/learning-engine";

export interface AdaptiveStudyTimeInput {
  title: string;
  subtopics?: string[];
  subtopicCount?: number;
  hierarchyDepth?: number;
  unitTitle?: string;
  unitTopicCount?: number;
  difficulty?: DifficultyLevel;
  learningFactor?: number;
  practiceCount?: number;
  learningOutcomeCount?: number;
  markedDifficult?: boolean;
  completedQuickly?: boolean;
  revisionsCount?: number;
  isWeakTopic?: boolean;
  actualMinutesSpent?: number;
  baselineEstimatedMinutes?: number;
  difficultyScore?: number;
  weakTopicScore?: number;
  quizScore?: number;
}

export interface AdaptiveStudyTimeResult {
  title: string;
  difficulty: DifficultyLevel;
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
  estimatedHours: number;
  learningFactorApplied: number;
  revisionFactorApplied: number;
}

export function calculateRecommendedPomodoros(estimatedMinutes: number): number {
  if (estimatedMinutes <= 30) return 1;
  if (estimatedMinutes <= 60) return 2;
  if (estimatedMinutes <= 120) return 3;
  return Math.max(4, Math.ceil(estimatedMinutes / 30));
}

function inferPracticeCount(
  difficulty: DifficultyLevel,
  subtopicCount: number
): number {
  const base = { easy: 1, medium: 2, hard: 3, very_hard: 4 };
  return Math.max(1, base[difficulty] + Math.floor(subtopicCount / 4));
}

function inferLearningOutcomes(
  subtopicCount: number,
  difficulty: DifficultyLevel
): number {
  const base = { easy: 1, medium: 2, hard: 3, very_hard: 4 };
  return Math.max(base[difficulty], Math.ceil(subtopicCount / 2));
}

function computeWeakTopicScore(
  isWeakTopic: boolean,
  difficulty: DifficultyLevel,
  difficultyScore: number,
  quizScore?: number
): number {
  let score = isWeakTopic
    ? Math.min(100, difficultyScore + 15)
    : Math.max(0, difficultyScore - 40);
  if (quizScore !== undefined && quizScore < 60) {
    score = Math.min(100, score + 20);
  }
  if (quizScore !== undefined && quizScore > 80) {
    score = Math.max(0, score - 10);
  }
  return score;
}

/**
 * Cold-start baseline + personalized adaptive study time.
 * Adaptive Time = Baseline × Learning Factor × Revision Factor
 */
export function calculateAdaptiveStudyTime(
  input: AdaptiveStudyTimeInput
): AdaptiveStudyTimeResult {
  const title = input.title.trim();
  const subtopics = input.subtopics ?? [];

  const coldStart = analyzeColdStartDifficulty({
    title,
    subtopics,
    unitTitle: input.unitTitle,
    unitTopicCount: input.unitTopicCount,
    hierarchyDepth: input.hierarchyDepth,
  });

  const difficulty = input.difficulty ?? coldStart.difficultyLevel;
  const subtopicCount = input.subtopicCount ?? coldStart.subtopicCount;
  const hierarchyDepth = input.hierarchyDepth ?? coldStart.hierarchyDepth;
  const baseline =
    input.baselineEstimatedMinutes ?? coldStart.baselineEstimatedMinutes;

  const practiceCount =
    input.practiceCount ?? inferPracticeCount(difficulty, subtopicCount);
  const learningOutcomeCount =
    input.learningOutcomeCount ??
    inferLearningOutcomes(subtopicCount, difficulty);

  const learningFactor = input.learningFactor ?? 1.0;
  const revisionFactor = getRevisionFactor(
    input.revisionsCount ?? 0,
    input.isWeakTopic ?? false,
    input.markedDifficult
  );

  let estimatedMinutes = calculatePersonalizedStudyTime({
    baselineEstimatedMinutes: baseline,
    learningFactor,
    revisionsCount: input.revisionsCount,
    isWeakTopic: input.isWeakTopic,
    markedDifficult: input.markedDifficult,
    actualMinutesSpent: input.actualMinutesSpent,
    completedQuickly: input.completedQuickly,
  });

  if (input.markedDifficult) {
    estimatedMinutes = Math.round(estimatedMinutes * 1.08);
  }

  const difficultyScore = input.difficultyScore ?? coldStart.complexityScore;
  const complexityScore = coldStart.complexityScore;
  const weakTopicScore =
    input.weakTopicScore ??
    computeWeakTopicScore(
      input.isWeakTopic ?? false,
      difficulty,
      difficultyScore,
      input.quizScore
    );

  return {
    title,
    difficulty,
    estimatedMinutes,
    baselineEstimatedMinutes: baseline,
    subtopicCount,
    hierarchyDepth,
    practiceCount,
    learningOutcomeCount,
    recommendedPomodoros: calculateRecommendedPomodoros(estimatedMinutes),
    difficultyScore,
    complexityScore,
    weakTopicScore,
    estimatedHours: Math.round((estimatedMinutes / 60) * 10) / 10,
    learningFactorApplied: learningFactor,
    revisionFactorApplied: revisionFactor,
  };
}

export function recalculateAfterStudySession(
  topic: AdaptiveStudyTimeInput & {
    estimatedMinutes?: number;
    completed?: boolean;
    sessionDurationMinutes: number;
  },
  learningFactor = 1.0
): AdaptiveStudyTimeResult {
  const actualMinutesSpent =
    (topic.actualMinutesSpent ?? 0) + topic.sessionDurationMinutes;
  const previousEstimate =
    topic.estimatedMinutes ?? topic.baselineEstimatedMinutes ?? 60;

  const completedQuickly =
    topic.completed === true &&
    actualMinutesSpent < previousEstimate * 0.7;

  return calculateAdaptiveStudyTime({
    ...topic,
    actualMinutesSpent,
    completedQuickly,
    learningFactor,
    revisionsCount: (topic.revisionsCount ?? 0) + 1,
  });
}

export function toLegacyDifficulty(
  difficulty: DifficultyLevel
): "easy" | "medium" | "hard" {
  if (difficulty === "very_hard") return "hard";
  return difficulty;
}

export function getPomodoroSessionMinutes(
  estimatedMinutes: number,
  recommendedPomodoros: number
): number {
  const sessions = Math.max(1, recommendedPomodoros);
  return Math.max(15, Math.ceil(estimatedMinutes / sessions));
}

export function getTopicEstimatedMinutes(topic: {
  estimatedMinutes?: number;
  baselineEstimatedMinutes?: number;
  estimatedHours?: number;
}): number {
  if (topic.estimatedMinutes && topic.estimatedMinutes > 0) {
    return topic.estimatedMinutes;
  }
  if (topic.baselineEstimatedMinutes && topic.baselineEstimatedMinutes > 0) {
    return topic.baselineEstimatedMinutes;
  }
  return Math.round((topic.estimatedHours ?? 1) * 60);
}

export function profileFromProgress(
  doc: {
    learningFactor?: number;
    averageQuizScore?: number;
    averageCompletionRate?: number;
    averageStudyTimeRatio?: number;
    weakTopics?: string[];
    strongTopics?: string[];
    sessionsTracked?: number;
  } | null
): LearningProfile {
  return {
    learningFactor: doc?.learningFactor ?? 1.0,
    averageQuizScore: doc?.averageQuizScore ?? 0,
    averageCompletionRate: doc?.averageCompletionRate ?? 0,
    averageStudyTimeRatio: doc?.averageStudyTimeRatio ?? 1.0,
    weakTopics: doc?.weakTopics ?? [],
    strongTopics: doc?.strongTopics ?? [],
    sessionsTracked: doc?.sessionsTracked ?? 0,
  };
}
