/**
 * Phase 9 — Contextual AI study coach (rule-based, subject-aware).
 */

export interface CoachContext {
  subjectName: string;
  topicName: string;
  unitTitle?: string;
  masteryScore: number;
  completed: boolean;
  isWeakTopic: boolean;
  prerequisites: Array<{ name: string; completed: boolean }>;
  weakTopicNames: string[];
  revisionDue: boolean;
  checklistPercent: number;
  quizUnlocked: boolean;
}

export interface CoachMessage {
  type: "tip" | "warning" | "success" | "revision" | "prerequisite";
  text: string;
  priority: number;
}

export function buildCoachMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = [];

  const missingPrereqs = ctx.prerequisites.filter((p) => !p.completed);
  if (missingPrereqs.length > 0 && !ctx.completed) {
    messages.push({
      type: "prerequisite",
      text: `Complete ${missingPrereqs.map((p) => p.name).join(", ")} before focusing on ${ctx.topicName}.`,
      priority: 95,
    });
  }

  if (ctx.isWeakTopic || ctx.masteryScore < 45) {
    messages.push({
      type: "warning",
      text: `You are weak in ${ctx.topicName}. Spend extra time on the checklist before marking complete.`,
      priority: 90,
    });
  }

  if (ctx.revisionDue && ctx.completed) {
    messages.push({
      type: "revision",
      text: `Revision due for ${ctx.topicName}. Review key concepts today to improve retention.`,
      priority: 88,
    });
  }

  if (ctx.weakTopicNames.length > 0) {
    const others = ctx.weakTopicNames.filter(
      (n) => n.toLowerCase() !== ctx.topicName.toLowerCase()
    );
    if (others.length > 0) {
      messages.push({
        type: "tip",
        text: `Also strengthen: ${others.slice(0, 3).join(", ")} in ${ctx.subjectName}.`,
        priority: 70,
      });
    }
  }

  if (!ctx.completed && ctx.checklistPercent < 100 && ctx.checklistPercent > 0) {
    messages.push({
      type: "tip",
      text: `${ctx.checklistPercent}% of your study checklist is done — finish reviewing subtopics, then mark complete.`,
      priority: 65,
    });
  }

  if (ctx.quizUnlocked) {
    messages.push({
      type: "success",
      text: `${ctx.topicName} is complete. Use the Quiz tab for practice, revision, and interview questions.`,
      priority: 60,
    });
  } else if (!ctx.completed) {
    messages.push({
      type: "tip",
      text: `Study ${ctx.topicName} first — quizzes unlock only after you mark the topic complete.`,
      priority: 55,
    });
  }

  if (ctx.masteryScore >= 75 && ctx.completed) {
    messages.push({
      type: "success",
      text: `Strong mastery (${ctx.masteryScore}%) on ${ctx.topicName}. Schedule a light revision in a few days.`,
      priority: 50,
    });
  }

  if (messages.length === 0) {
    messages.push({
      type: "tip",
      text: `Focus on ${ctx.unitTitle ? `${ctx.unitTitle} → ` : ""}${ctx.topicName}. Work through the mission checklist step by step.`,
      priority: 40,
    });
  }

  return messages.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

export function coachMessagesToStrings(messages: CoachMessage[]): string[] {
  return messages.map((m) => m.text);
}
