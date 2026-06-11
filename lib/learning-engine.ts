/**

 * Phases 5–7 — Adaptive learning profile, weak-topic detection, personalized time.

 */



import type { DifficultyLevel } from "@/lib/adaptive-study-time";

import { clampStudyMinutes } from "@/lib/topic-complexity";



export interface LearningProfile {

  learningFactor: number;

  averageQuizScore: number;

  averageCompletionRate: number;

  averageStudyTimeRatio: number;

  weakTopics: string[];

  strongTopics: string[];

  sessionsTracked: number;

}



export const DEFAULT_LEARNING_PROFILE: LearningProfile = {

  learningFactor: 1.0,

  averageQuizScore: 0,

  averageCompletionRate: 0,

  averageStudyTimeRatio: 1.0,

  weakTopics: [],

  strongTopics: [],

  sessionsTracked: 0,

};



export interface SessionLearningInput {

  topicId: string;

  topicName: string;

  estimatedMinutes: number;

  actualMinutes: number;

  completed: boolean;

  quizScore?: number;

  revisionsCount?: number;

}



export interface WeakTopicInput {

  quizScore?: number;

  revisionsCount?: number;

  actualMinutesSpent?: number;

  estimatedMinutes?: number;

  markedDifficult?: boolean;

  isWeakTopic?: boolean;

}



const LEARNING_FACTOR_MIN = 0.5;

const LEARNING_FACTOR_MAX = 2.0;

export const QUIZ_WEAK_THRESHOLD = 60;

export const QUIZ_STRONG_THRESHOLD = 80;

const REVISION_WEAK_THRESHOLD = 2;

const SLOW_COMPLETION_RATIO = 1.5;



export function getRevisionFactor(

  revisionsCount: number,

  isWeakTopic: boolean,

  markedDifficult?: boolean

): number {

  let factor = 1.0;

  if (revisionsCount > 0) factor += Math.min(0.3, revisionsCount * 0.05);

  if (isWeakTopic) factor += 0.15;

  if (markedDifficult) factor += 0.1;

  return factor;

}



export interface AdaptiveTimeInput {

  baselineEstimatedMinutes: number;

  learningFactor?: number;

  revisionsCount?: number;

  isWeakTopic?: boolean;

  markedDifficult?: boolean;

  actualMinutesSpent?: number;

  completedQuickly?: boolean;

}



/**

 * Phase 6 — Personalized time = baseline × average learning factor × revision factor

 */

export function calculatePersonalizedStudyTime(

  input: AdaptiveTimeInput

): number {

  const baseline = Math.max(15, input.baselineEstimatedMinutes);

  const learningFactor = input.learningFactor ?? 1.0;

  const revisionFactor = getRevisionFactor(

    input.revisionsCount ?? 0,

    input.isWeakTopic ?? false,

    input.markedDifficult

  );



  let minutes = Math.round(baseline * learningFactor * revisionFactor);



  if (input.completedQuickly) {

    minutes = Math.round(minutes * 0.92);

  }



  if (input.actualMinutesSpent && input.actualMinutesSpent > 0) {

    minutes = Math.round(minutes * 0.55 + input.actualMinutesSpent * 0.45);

  }



  return clampStudyMinutes(minutes);

}



/** Phase 5 — Session learning factor from actual vs estimated time */

export function calculateSessionLearningFactor(

  estimatedMinutes: number,

  actualMinutes: number

): number {

  if (estimatedMinutes <= 0 || actualMinutes <= 0) return 1.0;

  return actualMinutes / estimatedMinutes;

}



/** Phase 7 — Weak topic detection rules */

export function detectWeakTopic(input: WeakTopicInput): boolean {

  if (input.isWeakTopic || input.markedDifficult) return true;



  if (

    input.quizScore !== undefined &&

    input.quizScore >= 0 &&

    input.quizScore < QUIZ_WEAK_THRESHOLD

  ) {

    return true;

  }



  if ((input.revisionsCount ?? 0) > REVISION_WEAK_THRESHOLD) {

    return true;

  }



  const estimated = input.estimatedMinutes ?? 0;

  const actual = input.actualMinutesSpent ?? 0;

  if (estimated > 0 && actual > estimated * SLOW_COMPLETION_RATIO) {

    return true;

  }



  return false;

}



function ema(current: number, next: number, alpha = 0.25): number {

  if (current === 0) return next;

  return current * (1 - alpha) + next * alpha;

}



function clampFactor(value: number): number {

  return (

    Math.round(

      Math.min(LEARNING_FACTOR_MAX, Math.max(LEARNING_FACTOR_MIN, value)) * 100

    ) / 100

  );

}



/**

 * Phase 5–6 — Update profile learning factor from session behavior and quiz scores.

 */

export function updateLearningFactor(

  profile: LearningProfile,

  session: SessionLearningInput

): LearningProfile {

  const next: LearningProfile = {

    ...profile,

    weakTopics: [...profile.weakTopics],

    strongTopics: [...profile.strongTopics],

  };



  next.sessionsTracked = (profile.sessionsTracked ?? 0) + 1;



  if (session.estimatedMinutes > 0 && session.actualMinutes > 0) {

    const ratio = calculateSessionLearningFactor(

      session.estimatedMinutes,

      session.actualMinutes

    );

    next.averageStudyTimeRatio = ema(

      profile.averageStudyTimeRatio || 1,

      ratio

    );

    next.learningFactor = clampFactor(

      ema(profile.learningFactor || 1, ratio, 0.3)

    );

  }



  if (session.completed) {

    next.averageCompletionRate = ema(

      profile.averageCompletionRate,

      1,

      0.15

    );

  }



  if (session.quizScore !== undefined && session.quizScore >= 0) {

    next.averageQuizScore = ema(

      profile.averageQuizScore,

      session.quizScore,

      0.2

    );



    const id = session.topicId;



    if (session.quizScore < QUIZ_WEAK_THRESHOLD) {

      if (!next.weakTopics.includes(id)) next.weakTopics.push(id);

      next.strongTopics = next.strongTopics.filter((t) => t !== id);

      next.learningFactor = clampFactor(next.learningFactor + 0.03);

    } else if (session.quizScore > QUIZ_STRONG_THRESHOLD) {

      if (!next.strongTopics.includes(id)) next.strongTopics.push(id);

      next.weakTopics = next.weakTopics.filter((t) => t !== id);

      next.learningFactor = clampFactor(next.learningFactor - 0.02);

    }

  }



  if (

    next.averageQuizScore > 0 &&

    next.averageQuizScore < QUIZ_WEAK_THRESHOLD &&

    next.sessionsTracked >= 3

  ) {

    next.learningFactor = clampFactor(next.learningFactor + 0.02);

  }



  if (

    next.averageQuizScore > QUIZ_STRONG_THRESHOLD &&

    next.sessionsTracked >= 3

  ) {

    next.learningFactor = clampFactor(next.learningFactor - 0.02);

  }



  return next;

}



export function isWeakFromQuizScore(score?: number): boolean {

  return score !== undefined && score >= 0 && score < QUIZ_WEAK_THRESHOLD;

}



export function isStrongFromQuizScore(score?: number): boolean {

  return score !== undefined && score > QUIZ_STRONG_THRESHOLD;

}



export function difficultyLevelToLegacy(

  level: DifficultyLevel

): "easy" | "medium" | "hard" {

  if (level === "very_hard") return "hard";

  return level === "easy" ? "easy" : level === "hard" ? "hard" : "medium";

}



/** Phase 9 — Exam readiness from completion, quiz average, and learning factor */

export function calculateExamReadiness(input: {

  completionRate: number;

  averageQuizScore: number;

  learningFactor: number;

  weakTopicCount: number;

  totalTopics: number;

}): number {

  const completionWeight = input.completionRate * 0.45;

  const quizWeight =

    input.averageQuizScore > 0 ? (input.averageQuizScore / 100) * 35 : 15;

  const paceWeight =

    input.learningFactor <= 1.1

      ? 20

      : Math.max(5, 20 - (input.learningFactor - 1) * 25);

  const weakPenalty =

    input.totalTopics > 0

      ? Math.min(25, (input.weakTopicCount / input.totalTopics) * 40)

      : 0;



  return Math.max(

    0,

    Math.min(

      100,

      Math.round(completionWeight + quizWeight + paceWeight - weakPenalty)

    )

  );

}

