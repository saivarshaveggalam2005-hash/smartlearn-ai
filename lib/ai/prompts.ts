import type { TopicContext } from "@/lib/ai/types";
import type { InterviewLevel, RevisionDuration } from "@/lib/ai/types";

function formatContext(ctx: TopicContext): string {
  const lines: string[] = [
    `Topic: ${ctx.topicName}`,
    ctx.subjectName ? `Subject: ${ctx.subjectName}` : "",
    ctx.unitTitle ? `Unit: ${ctx.unitTitle}` : "",
    ctx.parentTopicTitle ? `Main Topic: ${ctx.parentTopicTitle}` : "",
    ctx.subtopics?.length
      ? `Subtopics: ${ctx.subtopics.join("; ")}`
      : "",
    "",
    "Syllabus context:",
    ctx.content.slice(0, 4000),
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildNotesPrompt(ctx: TopicContext): string {
  return `You are an expert academic tutor. Generate comprehensive study notes in Markdown for a student.

${formatContext(ctx)}

Include these sections with clear headings:
## Topic Summary
## Key Concepts
## Important Keywords
## Revision Notes
## Exam Tips
## Common Mistakes

Use bullet points, short paragraphs, and exam-focused language. Base everything on the syllabus context provided.`;
}

export function buildFlashcardsPrompt(ctx: TopicContext): string {
  return `Generate 8–12 flashcard pairs for quick revision in Markdown.

${formatContext(ctx)}

Format each pair as:
**Q:** question
**A:** concise answer

Cover definitions, comparisons, and application questions from the subtopics.`;
}

export function buildInterviewPrompt(
  ctx: TopicContext,
  level: InterviewLevel = "all"
): string {
  const levelInstruction =
    level === "all"
      ? "Include Basic, Intermediate, and Advanced sections."
      : `Focus on ${level} level questions only.`;

  return `Generate interview preparation questions with model answers in Markdown.

${formatContext(ctx)}

${levelInstruction}

Structure:
## Basic Questions
## Intermediate Questions
## Advanced Questions

For each question provide a brief model answer (2–4 sentences).`;
}

export function buildExamPrompt(ctx: TopicContext): string {
  return `Generate exam-style practice questions in Markdown.

${formatContext(ctx)}

Include:
## Short Answer Questions (5 questions)
## Long Answer Questions (3 questions)
## Important Questions (5 high-yield exam questions)

Number each question. Add a one-line hint after each long answer question.`;
}

export function buildRevisionSheetPrompt(
  ctx: TopicContext,
  duration: RevisionDuration
): string {
  const durationGuide =
    duration === "2min"
      ? "Ultra-compact 2-minute revision — bullet-only, max 15 lines."
      : duration === "5min"
        ? "5-minute revision sheet — key points, tables, and mnemonics."
        : "Night-before-exam revision — high-yield summary, common traps, and last-minute checklist.";

  return `Create a ${duration} revision sheet in Markdown.

${formatContext(ctx)}

Guidelines: ${durationGuide}

Use headings, bullet lists, and a final "Quick Recall" section.`;
}

export function buildTutorPrompt(ctx: TopicContext, question?: string): string {
  const q =
    question?.trim() ||
    "Give a clear introduction to this topic with examples and simplified explanations.";

  return `You are a context-aware AI tutor for SmartLearn. Help the student understand this topic.

${formatContext(ctx)}

Student question or request:
${q}

Provide:
- Clear explanations tied to the unit and subtopics
- Practical examples
- Simplified concepts where helpful
- Step-by-step doubt resolution if a specific question was asked

Use Markdown formatting.`;
}
