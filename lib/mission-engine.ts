/**
 * Phase 2 — Mission-based learning (dynamic for any topic/subtopic).
 */

export interface MissionTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  linkedSubtopic?: string;
}

export interface TopicMission {
  title: string;
  subtitle: string;
  tasks: MissionTask[];
  rewardPoints: number;
  progressPercent: number;
}

const GENERIC_TASK_TEMPLATES = [
  { suffix: "Overview", description: "Read the core ideas and definitions." },
  { suffix: "Key Concepts", description: "Identify and explain main terms." },
  { suffix: "Examples", description: "Review practical examples and use cases." },
  { suffix: "Practice", description: "Apply concepts with short recall exercises." },
] as const;

export function buildTopicMission(input: {
  topicName: string;
  subtopics: string[];
  subtopicProgress?: Array<{ title: string; completed?: boolean; skipped?: boolean }>;
  topicCompleted?: boolean;
}): TopicMission {
  const progressMap = new Map(
    (input.subtopicProgress ?? []).map((p) => [p.title.toLowerCase(), p])
  );

  const tasks: MissionTask[] = [];

  if (input.subtopics.length > 0) {
    for (const sub of input.subtopics) {
      const saved = progressMap.get(sub.toLowerCase());
      tasks.push({
        id: `sub-${sub.toLowerCase().replace(/\s+/g, "-")}`,
        title: sub,
        description: `Study and understand ${sub} as part of ${input.topicName}.`,
        completed: Boolean(saved?.completed || saved?.skipped),
        linkedSubtopic: sub,
      });
    }
  } else {
    for (const template of GENERIC_TASK_TEMPLATES) {
      tasks.push({
        id: template.suffix.toLowerCase().replace(/\s+/g, "-"),
        title: `${input.topicName} — ${template.suffix}`,
        description: template.description,
        completed: Boolean(input.topicCompleted),
      });
    }
  }

  tasks.push({
    id: "mission-complete",
    title: `Mark ${input.topicName} complete`,
    description: "Finish studying and mark the topic complete to unlock quizzes.",
    completed: Boolean(input.topicCompleted),
  });

  const actionable = tasks.filter((t) => t.id !== "mission-complete");
  const done = actionable.filter((t) => t.completed).length;
  const progressPercent =
    actionable.length > 0 ? Math.round((done / actionable.length) * 100) : 0;

  return {
    title: `Master ${input.topicName}`,
    subtitle: `${done}/${actionable.length} mission tasks complete`,
    tasks,
    rewardPoints: Math.max(10, Math.round(10 + actionable.length * 4)),
    progressPercent,
  };
}
