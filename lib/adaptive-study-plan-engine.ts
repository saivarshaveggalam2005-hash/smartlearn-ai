import { differenceInDays, isAfter, subDays } from "date-fns";
import type { IProgress, IDailyProgress } from "@/models/Progress";
import type { ITopic } from "@/models/Subject";
import type { IUser } from "@/models/User";
import { Progress } from "@/models/Progress";
import { Subject } from "@/models/Subject";
import { User } from "@/models/User";
import {
  calculateAdaptiveStudyTime,
  getTopicEstimatedMinutes,
  profileFromProgress,
} from "@/lib/adaptive-study-time";
import { updateLearningFactor, detectWeakTopic, calculateExamReadiness } from "@/lib/learning-engine";
import { refreshTopicIntelligence } from "@/lib/topic-intelligence";
import { isDueForReview } from "@/lib/spaced-repetition";
import { buildLearningGraph, isTopicUnlocked } from "@/lib/learning-graph";
import { awardXp, XP_REWARDS } from "@/lib/engagement";
import {
  generateAdaptiveStudyPlan,
  type DailyPlanItem,
  type PlanInput,
  type TopicInput,
} from "@/lib/study-plan";

export interface SubjectLike {
  slug: string;
  subjectName: string;
  topics: ITopic[];
}

export type RevisionReason =
  | "weak_topic"
  | "incomplete"
  | "marked_difficult"
  | "overdue";

export interface RevisionQueueEntry {
  topicId: string;
  subjectSlug: string;
  subjectName: string;
  topicName: string;
  priority: number;
  reason: RevisionReason;
  addedAt: Date;
}

export interface ProgressLike {
  revisionQueue?: RevisionQueueEntry[];
  learningPaceMultiplier?: number;
  streak?: number;
  completedStudyHours?: number;
  studyHours?: number;
  weakAreas?: string[];
  performanceScore?: number;
  dailyLog?: IDailyProgress[];
  completedTopics?: string[];
  fastCompletions?: number;
  slowCompletions?: number;
  incompleteSessions?: number;
  totalStudyMinutes?: number;
  lastStudyDate?: Date;
  learningFactor?: number;
  averageQuizScore?: number;
  averageCompletionRate?: number;
  averageStudyTimeRatio?: number;
  weakTopics?: string[];
  strongTopics?: string[];
  sessionsTracked?: number;
  xp?: number;
  level?: number;
}

export interface PlanTopicInput extends TopicInput {
  topicId?: string;
  subjectSlug?: string;
  revisionPriority?: number;
  inRevisionQueue?: boolean;
}

export interface StudySessionOutcome {
  userId: string;
  subjectSlug: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  durationMinutes: number;
  completed: boolean;
  markedDifficult?: boolean;
  quizScore?: number;
  sessionStartedAt?: Date;
  sessionEndedAt?: Date;
}

const PACE_MIN = 0.75;
const PACE_MAX = 1.15;
const FAST_RATIO = 0.7;
const SLOW_RATIO = 1.3;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function applyPaceToMinutes(baseMinutes: number, paceMultiplier: number): number {
  return Math.max(15, Math.round(baseMinutes * paceMultiplier));
}

export function computeRevisionPriority(topic: ITopic): number {
  let priority = topic.revisionPriority ?? 0;

  if (topic.isWeakTopic || (topic.weakTopicScore ?? 0) >= 55) {
    priority += 35 + Math.floor((topic.weakTopicScore ?? 0) / 3);
  }
  if (
    topic.quizScore !== undefined &&
    topic.quizScore >= 0 &&
    topic.quizScore < 60
  ) {
    priority += 30;
  }
  if ((topic.revisionsCount ?? 0) > 2) {
    priority += 25;
  }
  if (
    (topic.estimatedMinutes ?? 0) > 0 &&
    (topic.actualMinutesSpent ?? 0) >
      (topic.estimatedMinutes ?? 0) * 1.5
  ) {
    priority += 20;
  }
  if (topic.markedDifficult) priority += 30;
  if (!topic.completed && (topic.actualMinutesSpent ?? 0) > 0) {
    priority += 25;
  }
  if (topic.revisionStatus === "in_progress" && !topic.completed) {
    priority += 20;
  }
  if (
    topic.lastStudiedAt &&
    isAfter(subDays(new Date(), 7), topic.lastStudiedAt) &&
    !topic.completed
  ) {
    priority += 15;
  }

  return Math.min(100, priority);
}

export function upsertRevisionQueueEntry(
  queue: RevisionQueueEntry[],
  entry: Omit<RevisionQueueEntry, "addedAt"> & { addedAt?: Date }
): RevisionQueueEntry[] {
  const next = queue.filter((q) => q.topicId !== entry.topicId);
  next.push({
    ...entry,
    addedAt: entry.addedAt ?? new Date(),
  });
  return next.sort((a, b) => b.priority - a.priority);
}

export function removeFromRevisionQueue(
  queue: RevisionQueueEntry[],
  topicId: string
): RevisionQueueEntry[] {
  return queue.filter((q) => q.topicId !== topicId);
}

export async function getOrCreateProgressAnalytics(
  userId: string
): Promise<IProgress> {
  let progress = await Progress.findOne({ userId });
  if (!progress) {
    progress = await Progress.create({ userId });
  }
  return progress;
}

/** Record streak, completed hours, and daily study log */
export async function recordStudyAnalytics(
  userId: string,
  minutes: number,
  options?: { topicCompletedId?: string; weakArea?: string }
): Promise<{ streak: number; completedStudyHours: number }> {
  const today = todayStr();
  const progress = await getOrCreateProgressAnalytics(userId);
  const dbUser = await User.findOne({ clerkId: userId });

  const logIndex = progress.dailyLog.findIndex((d) => d.date === today);
  if (logIndex >= 0) {
    progress.dailyLog[logIndex].minutes += minutes;
    if (options?.topicCompletedId) {
      progress.dailyLog[logIndex].topicsCompleted += 1;
    }
  } else {
    progress.dailyLog.push({
      date: today,
      minutes,
      topicsCompleted: options?.topicCompletedId ? 1 : 0,
    });
  }

  progress.studyHours = (progress.studyHours ?? 0) + minutes / 60;
  progress.completedStudyHours = progress.studyHours;

  if (options?.topicCompletedId) {
    if (!progress.completedTopics.includes(options.topicCompletedId)) {
      progress.completedTopics.push(options.topicCompletedId);
    }
  }
  if (options?.weakArea && !progress.weakAreas.includes(options.weakArea)) {
    progress.weakAreas.push(options.weakArea);
  }

  let streak = dbUser?.streak ?? progress.streak ?? 0;
  if (dbUser) {
    const lastDate = dbUser.lastStudyDate?.toISOString().split("T")[0];
    const yesterday = subDays(new Date(), 1).toISOString().split("T")[0];

    if (lastDate !== today) {
      streak = lastDate === yesterday ? (dbUser.streak ?? 0) + 1 : 1;
      dbUser.streak = streak;
      dbUser.lastStudyDate = new Date();
    }
    dbUser.totalStudyMinutes = (dbUser.totalStudyMinutes ?? 0) + minutes;
    await dbUser.save();
  }

  progress.streak = streak;
  progress.lastStudyDate = new Date();
  progress.totalStudyMinutes = (progress.totalStudyMinutes ?? 0) + minutes;
  progress.performanceScore = computePerformanceScore(progress);

  let xpGain = 0;
  if (minutes >= 10) xpGain += XP_REWARDS.dailyStudy;
  if (options?.topicCompletedId) xpGain += XP_REWARDS.topicComplete;
  if (streak > 1 && logIndex < 0) xpGain += XP_REWARDS.streakBonus;

  if (xpGain > 0) {
    const engagement = awardXp(
      { xp: progress.xp ?? 0, level: progress.level ?? 1 },
      xpGain
    );
    progress.xp = engagement.xp;
    progress.level = engagement.level;
  }

  await progress.save();

  return {
    streak,
    completedStudyHours: Math.round(progress.completedStudyHours * 10) / 10,
  };
}

function computePerformanceScore(progress: IProgress | ProgressLike): number {
  const fast = progress.fastCompletions ?? 0;
  const slow = progress.slowCompletions ?? 0;
  const total = fast + slow + (progress.completedTopics?.length ?? 0);
  if (total === 0) return progress.performanceScore ?? 50;
  const pace = progress.learningPaceMultiplier ?? 1;
  const queuePenalty = Math.min(20, (progress.revisionQueue?.length ?? 0) * 2);
  const base = 50 + fast * 5 - slow * 3 + (1 - pace) * 40;
  return Math.max(0, Math.min(100, Math.round(base - queuePenalty)));
}

export function updateLearningPace(
  progress: IProgress | ProgressLike,
  estimatedMinutes: number,
  actualMinutes: number,
  completed: boolean
): number {
  if (!completed || estimatedMinutes <= 0) return progress.learningPaceMultiplier ?? 1;

  const ratio = actualMinutes / estimatedMinutes;
  let pace = progress.learningPaceMultiplier ?? 1;

  if (ratio < FAST_RATIO) {
    progress.fastCompletions = (progress.fastCompletions ?? 0) + 1;
    pace = Math.max(PACE_MIN, pace - 0.05);
  } else if (ratio > SLOW_RATIO) {
    progress.slowCompletions = (progress.slowCompletions ?? 0) + 1;
    pace = Math.min(PACE_MAX, pace + 0.03);
  }

  progress.learningPaceMultiplier = pace;
  return pace;
}

export function syncTopicRevisionState(
  topic: ITopic,
  subject: { slug: string; subjectName: string },
  progress: IProgress | ProgressLike,
  completed: boolean
): void {
  topic.revisionPriority = computeRevisionPriority(topic);

  if (completed) {
    topic.inRevisionQueue = false;
    progress.revisionQueue = removeFromRevisionQueue(
      (progress.revisionQueue as RevisionQueueEntry[]) ?? [],
      topic._id?.toString() ?? ""
    );

    if (isDueForReview(topic.nextReviewAt)) {
      const topicId = topic._id?.toString() ?? "";
      const priority = Math.min(100, (topic.revisionPriority ?? 0) + 50);
      topic.inRevisionQueue = true;
      topic.revisionPriority = priority;
      progress.revisionQueue = upsertRevisionQueueEntry(
        (progress.revisionQueue as RevisionQueueEntry[]) ?? [],
        {
          topicId,
          subjectSlug: subject.slug,
          subjectName: subject.subjectName,
          topicName: topic.name,
          priority,
          reason: "overdue",
        }
      );
    }
    return;
  }

  const topicId = topic._id?.toString() ?? "";
  const reasons: { reason: RevisionReason; boost: number }[] = [];

  if (topic.isWeakTopic || (topic.weakTopicScore ?? 0) >= 55) {
    reasons.push({ reason: "weak_topic", boost: 40 });
  }
  if (
    topic.quizScore !== undefined &&
    topic.quizScore >= 0 &&
    topic.quizScore < 60
  ) {
    reasons.push({ reason: "weak_topic", boost: 35 });
  }
  if ((topic.revisionsCount ?? 0) > 2) {
    reasons.push({ reason: "marked_difficult", boost: 30 });
  }
  if (
    (topic.estimatedMinutes ?? 0) > 0 &&
    (topic.actualMinutesSpent ?? 0) >
      (topic.estimatedMinutes ?? 0) * 1.5
  ) {
    reasons.push({ reason: "incomplete", boost: 28 });
  }
  if (topic.markedDifficult) {
    reasons.push({ reason: "marked_difficult", boost: 35 });
  }
  if (
    (topic.actualMinutesSpent ?? 0) > 0 &&
    !topic.completed
  ) {
    reasons.push({ reason: "incomplete", boost: 30 });
  }
  if (topic.lastStudiedAt &&
    differenceInDays(new Date(), topic.lastStudiedAt) >= 7 &&
    !topic.completed
  ) {
    reasons.push({ reason: "overdue", boost: 20 });
  }

  if (topic.completed && isDueForReview(topic.nextReviewAt)) {
    reasons.push({ reason: "overdue", boost: 50 });
  } else if (
    !topic.completed &&
    topic.nextReviewAt &&
    isDueForReview(topic.nextReviewAt)
  ) {
    reasons.push({ reason: "overdue", boost: 25 });
  }

  if (reasons.length === 0) return;

  const top = reasons.sort((a, b) => b.boost - a.boost)[0];
  const priority = Math.min(100, (topic.revisionPriority ?? 0) + top.boost);

  topic.inRevisionQueue = true;
  topic.revisionPriority = priority;

  progress.revisionQueue = upsertRevisionQueueEntry(
    (progress.revisionQueue as RevisionQueueEntry[]) ?? [],
    {
      topicId,
      subjectSlug: subject.slug,
      subjectName: subject.subjectName,
      topicName: topic.name,
      priority,
      reason: top.reason,
    }
  );
}

/** Reduce estimates for all pending topics when user learns faster */
export async function applyLearningPaceToPendingTopics(
  userId: string,
  learningFactor: number
): Promise<void> {
  const subjects = await Subject.find({ userId });

  for (const subject of subjects) {
    let changed = false;

    for (const topic of subject.topics) {
      if (topic.completed) continue;

      const adaptive = calculateAdaptiveStudyTime({
        title: topic.name,
        subtopicCount: topic.subtopicCount,
        hierarchyDepth: topic.hierarchyDepth,
        baselineEstimatedMinutes: topic.baselineEstimatedMinutes,
        difficulty: topic.initialDifficultyLevel,
        markedDifficult: topic.markedDifficult,
        isWeakTopic: topic.isWeakTopic,
        actualMinutesSpent: topic.actualMinutesSpent,
        revisionsCount: topic.revisionsCount,
        difficultyScore: topic.difficultyScore,
        weakTopicScore: topic.weakTopicScore,
        quizScore: topic.quizScore,
        learningFactor,
      });

      if (topic.estimatedMinutes !== adaptive.estimatedMinutes) {
        topic.estimatedMinutes = adaptive.estimatedMinutes;
        topic.estimatedHours = adaptive.estimatedHours;
        topic.recommendedPomodoros = adaptive.recommendedPomodoros;
        changed = true;
      }
    }

    if (changed) await subject.save();
  }
}

export async function processStudySessionOutcome(
  outcome: StudySessionOutcome,
  topic: ITopic,
  subject: SubjectLike
): Promise<void> {
  const progress = await getOrCreateProgressAnalytics(outcome.userId);

  const estimated = topic.estimatedMinutes ?? getTopicEstimatedMinutes(topic);
  const actual = topic.actualMinutesSpent ?? 0;

  const pace = updateLearningPace(
    progress,
    estimated,
    actual,
    outcome.completed
  );

  const profile = profileFromProgress(progress);
  const updatedProfile = updateLearningFactor(profile, {
    topicId: outcome.topicId,
    topicName: outcome.topicName,
    estimatedMinutes: estimated,
    actualMinutes: actual,
    completed: outcome.completed,
    quizScore: outcome.quizScore,
    revisionsCount: topic.revisionsCount,
  });

  progress.learningFactor = updatedProfile.learningFactor;
  progress.averageQuizScore = updatedProfile.averageQuizScore;
  progress.averageCompletionRate = updatedProfile.averageCompletionRate;
  progress.averageStudyTimeRatio = updatedProfile.averageStudyTimeRatio;
  progress.weakTopics = updatedProfile.weakTopics;
  progress.strongTopics = updatedProfile.strongTopics;
  progress.sessionsTracked = updatedProfile.sessionsTracked;
  progress.learningPaceMultiplier = updatedProfile.learningFactor;

  topic.isWeakTopic = detectWeakTopic({
    quizScore: outcome.quizScore ?? topic.quizScore,
    revisionsCount: topic.revisionsCount,
    actualMinutesSpent: topic.actualMinutesSpent,
    estimatedMinutes: estimated,
    markedDifficult: topic.markedDifficult,
    isWeakTopic: topic.isWeakTopic,
  });

  if (estimated > 0 && (topic.actualMinutesSpent ?? 0) > 0) {
    topic.learningFactor =
      Math.round(((topic.actualMinutesSpent ?? 0) / estimated) * 100) / 100;
  }

  if (outcome.quizScore !== undefined) {
    topic.quizScore = outcome.quizScore;
  }

  refreshTopicIntelligence(topic);

  syncTopicRevisionState(topic, subject, progress, outcome.completed);

  if (outcome.completed) {
    const engagement = awardXp(
      { xp: progress.xp ?? 0, level: progress.level ?? 1 },
      XP_REWARDS.topicComplete
    );
    progress.xp = engagement.xp;
    progress.level = engagement.level;
  } else if (
    outcome.quizScore !== undefined &&
    outcome.quizScore >= 80
  ) {
    const engagement = awardXp(
      { xp: progress.xp ?? 0, level: progress.level ?? 1 },
      XP_REWARDS.quizStrong
    );
    progress.xp = engagement.xp;
    progress.level = engagement.level;
  }

  await applyLearningPaceToPendingTopics(
    outcome.userId,
    updatedProfile.learningFactor
  );

  await progress.save();
}

/** Scan all subjects and populate revision queue for weak / incomplete topics */
export async function syncAllRevisionQueues(userId: string): Promise<void> {
  const progress = await getOrCreateProgressAnalytics(userId);
  const subjects = await Subject.find({ userId });

  for (const subject of subjects) {
    for (const topic of subject.topics) {
      refreshTopicIntelligence(topic);
      if (topic.completed) continue;
      syncTopicRevisionState(topic, subject, progress, false);
    }
    await subject.save();
  }

  await progress.save();
}

export function collectPlanTopics(
  subjects: SubjectLike[],
  paceMultiplier: number
): PlanTopicInput[] {
  const items: PlanTopicInput[] = [];

  for (const subject of subjects) {
    for (const topic of subject.topics) {
      if (topic.completed) continue;

      const baseMinutes = getTopicEstimatedMinutes(topic);
      const pacedMinutes = applyPaceToMinutes(baseMinutes, paceMultiplier);

      items.push({
        topicId: topic._id?.toString(),
        subjectSlug: subject.slug,
        name: `${subject.subjectName}: ${topic.name}`,
        difficulty: topic.difficulty,
        estimatedHours: topic.estimatedHours,
        estimatedMinutes: pacedMinutes,
        completed: false,
        revisionPriority: topic.revisionPriority ?? 0,
        inRevisionQueue: topic.inRevisionQueue ?? false,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.inRevisionQueue !== b.inRevisionQueue) {
      return a.inRevisionQueue ? -1 : 1;
    }
    return (b.revisionPriority ?? 0) - (a.revisionPriority ?? 0);
  });
}

export function buildAdaptivePlanInput(
  user: IUser,
  subjects: SubjectLike[],
  progress: ProgressLike | null
): PlanInput {
  const factor =
    progress?.learningFactor ??
    progress?.learningPaceMultiplier ??
    1;

  return {
    topics: collectPlanTopics(subjects, factor),
    dailyStudyMinutes: user.studyTime ?? 60,
    examDate: user.examDate,
    learningSpeed: user.learningSpeed ?? "medium",
  };
}

export function buildAdaptiveStudyPlan(
  user: IUser,
  subjects: SubjectLike[],
  progress: ProgressLike | null
): DailyPlanItem[] {
  return generateAdaptiveStudyPlan(buildAdaptivePlanInput(user, subjects, progress));
}

/** Whether topic prerequisites are satisfied within a subject */
export function isTopicUnlockedForStudy(
  subject: SubjectLike,
  topic: ITopic
): boolean {
  const completed = new Set(
    subject.topics.filter((t) => t.completed).map((t) => t.slug)
  );

  const stored = topic.prerequisites ?? [];
  if (stored.length > 0) {
    return stored.every((pre) => completed.has(pre));
  }

  const graph = buildLearningGraph(
    subject.topics.map((t) => ({
      slug: t.slug,
      name: t.name,
      unitTitle: t.unitTitle,
      keywords: t.keywords,
    }))
  );

  return isTopicUnlocked(topic.slug, graph, completed);
}

/** Pick next topic: revision queue first, then highest priority unlocked topic */
export function pickContinueTopic(
  subjects: SubjectLike[],
  progress: ProgressLike | null
): {
  subjectSlug: string;
  subjectName: string;
  topic: ITopic;
} | null {
  const queue = (progress?.revisionQueue as RevisionQueueEntry[]) ?? [];
  if (queue.length > 0) {
    const top = queue[0];
    for (const subject of subjects) {
      if (subject.slug !== top.subjectSlug) continue;
      const topic = subject.topics.find(
        (t) => t._id?.toString() === top.topicId && !t.completed
      );
      if (topic) {
        return {
          subjectSlug: subject.slug,
          subjectName: subject.subjectName,
          topic,
        };
      }
    }
  }

  const candidates = subjects.flatMap((s) =>
    s.topics
      .filter((t) => !t.completed && isTopicUnlockedForStudy(s, t))
      .map((t) => ({
        subjectSlug: s.slug,
        subjectName: s.subjectName,
        topic: t,
        sortKey:
          (t.inRevisionQueue ? 1000 : 0) +
          (t.revisionPriority ?? 0) +
          (t.lastStudiedAt?.getTime() ?? 0) / 1e15,
      }))
  );

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.sortKey - a.sortKey);
  const best = candidates[0];
  return {
    subjectSlug: best.subjectSlug,
    subjectName: best.subjectName,
    topic: best.topic,
  };
}

export function sortPendingTopics(
  topics: ITopic[],
  progress: ProgressLike | null
): ITopic[] {
  const queueIds = new Set(
    ((progress?.revisionQueue as RevisionQueueEntry[]) ?? []).map((q) => q.topicId)
  );

  return [...topics].sort((a, b) => {
    const aQueued =
      a.inRevisionQueue || queueIds.has(a._id?.toString() ?? "");
    const bQueued =
      b.inRevisionQueue || queueIds.has(b._id?.toString() ?? "");
    if (aQueued !== bQueued) return aQueued ? -1 : 1;
    return (b.revisionPriority ?? 0) - (a.revisionPriority ?? 0);
  });
}

export type { IDailyProgress };
