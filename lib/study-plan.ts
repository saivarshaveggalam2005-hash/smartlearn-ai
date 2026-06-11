import { differenceInDays } from "date-fns";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";

export interface TopicInput {
  name: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  estimatedMinutes?: number;
  completed?: boolean;
}

export interface PlanInput {
  topics: TopicInput[];
  dailyStudyMinutes: number;
  examDate?: Date;
  learningSpeed: "slow" | "medium" | "fast";
  completedTopicIds?: string[];
}

const speedMultiplier = { slow: 1.4, medium: 1, fast: 0.75 };

export interface DailyPlanItem {
  date: string;
  topics: { name: string; minutes: number }[];
  totalMinutes: number;
}

export function generateAdaptiveStudyPlan(input: PlanInput): DailyPlanItem[] {
  const { topics, dailyStudyMinutes, examDate, learningSpeed } = input;
  const speed = speedMultiplier[learningSpeed];
  const pending = topics.filter((t) => !t.completed);

  const totalMinutesNeeded = pending.reduce((sum, t) => {
    const mins = Math.round(getTopicEstimatedMinutes(t) * speed);
    return sum + mins;
  }, 0);

  const daysAvailable = examDate
    ? Math.max(1, differenceInDays(examDate, new Date()))
    : Math.ceil(totalMinutesNeeded / dailyStudyMinutes) || 7;

  const dailyBudget = Math.min(
    dailyStudyMinutes,
    Math.ceil(totalMinutesNeeded / daysAvailable)
  );

  const plan: DailyPlanItem[] = [];
  let topicIndex = 0;
  const start = new Date();

  for (let d = 0; d < daysAvailable && topicIndex < pending.length; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    const dayTopics: { name: string; minutes: number }[] = [];
    let used = 0;

    while (topicIndex < pending.length && used < dailyBudget) {
      const topic = pending[topicIndex];
      const needed = Math.round(getTopicEstimatedMinutes(topic) * speed);
      const allocate = Math.min(needed, dailyBudget - used);

      if (allocate > 0) {
        dayTopics.push({ name: topic.name, minutes: allocate });
        used += allocate;
        if (allocate >= needed) topicIndex++;
      } else break;
    }

    if (dayTopics.length) {
      plan.push({
        date: date.toISOString().split("T")[0],
        topics: dayTopics,
        totalMinutes: used,
      });
    }
  }

  return plan;
}
