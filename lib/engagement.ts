/**
 * Phase 12 — Lightweight engagement (XP + levels) without breaking existing streaks.
 */

export interface EngagementState {
  xp: number;
  level: number;
}

export const XP_REWARDS = {
  subtopicQuizPass: 15,
  subtopicSkip: 5,
  topicComplete: 50,
  quizStrong: 20,
  dailyStudy: 10,
  streakBonus: 5,
} as const;

export function xpForLevel(level: number): number {
  return level * 100;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function awardXp(
  current: EngagementState,
  amount: number
): EngagementState {
  const xp = Math.max(0, current.xp + amount);
  return { xp, level: levelFromXp(xp) };
}

export function engagementLabel(level: number): string {
  if (level >= 20) return "Expert Learner";
  if (level >= 10) return "Advanced Learner";
  if (level >= 5) return "Active Learner";
  return "Getting Started";
}
