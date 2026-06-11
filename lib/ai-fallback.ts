import type { NoteType } from "@/lib/ai";

function cleanContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 4000);
}

function parseStructuredContext(content: string): {
  overview: string;
  subtopics: string[];
  keywords: string[];
  objectives: string[];
} {
  const overview =
    content.match(/Overview:\s*(.+?)(?=Subtopics:|Keywords:|Objectives:|$)/i)?.[1]?.trim() ??
    "";
  const subtopicsRaw =
    content.match(/Subtopics:\s*(.+?)(?=Keywords:|Objectives:|$)/i)?.[1] ?? "";
  const keywordsRaw =
    content.match(/Keywords:\s*(.+?)(?=Objectives:|$)/i)?.[1] ?? "";
  const objectivesRaw =
    content.match(/Objectives:\s*(.+)/i)?.[1] ?? "";

  return {
    overview,
    subtopics: subtopicsRaw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean),
    keywords: keywordsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    objectives: objectivesRaw
      .split(/(?<=\.)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10),
  };
}

export function getFallbackTutorExplanation(
  topicName: string,
  content: string,
  question?: string
): string {
  const ctx = parseStructuredContext(cleanContent(content));
  const subtopicBlock =
    ctx.subtopics.length > 0
      ? `\n\n**Subtopics to cover:** ${ctx.subtopics.slice(0, 8).join(" · ")}`
      : "";
  const keywordBlock =
    ctx.keywords.length > 0
      ? `\n\n**Keywords:** ${ctx.keywords.slice(0, 8).join(", ")}`
      : "";

  if (question?.trim()) {
    return `### Answer about **${topicName}**

You asked: *${question.trim()}*

1. **Core idea** — Relate your answer to the main concepts of *${topicName}*.
2. **Explain clearly** — Use definitions, examples, and one diagram if helpful.
3. **Connect** — Link this topic to related subtopics in your unit.

${ctx.overview ? `\n**Topic overview:** ${ctx.overview}` : ""}${subtopicBlock}${keywordBlock}

---
*Generated from structured syllabus content (offline mode).*`;
  }

  return `## Welcome to **${topicName}**

${ctx.overview || `This topic introduces core ideas you need for exams and practical understanding.`}

### Learning objectives
${(ctx.objectives.length ? ctx.objectives : [`Understand ${topicName}`, `Apply key concepts to exam questions`]).map((o) => `- ${o}`).join("\n")}

### Suggested study path
1. Read the **Topic Overview** and subtopics checklist
2. Follow the **Learning Path** blocks in order
3. Review **Keywords** and write 3 short answers
4. Use **Generate AI Notes** for revision

${subtopicBlock}${keywordBlock}

---
*Generated from structured syllabus content (offline mode).*`;
}

export function getFallbackAINotes(
  topicName: string,
  content: string,
  type: NoteType
): string {
  const ctx = parseStructuredContext(cleanContent(content));

  const summaryBody = [
    ctx.overview || `Core concepts for **${topicName}**.`,
    ctx.subtopics.length
      ? `\n**Subtopics:** ${ctx.subtopics.join(", ")}`
      : "",
    ctx.keywords.length
      ? `\n**Keywords:** ${ctx.keywords.join(", ")}`
      : "",
  ].join("");

  const templates: Record<NoteType, string> = {
    summary: `## Summary: ${topicName}

${summaryBody}

**Takeaway:** Master definitions, subtopics, and keywords before moving to the next unit topic.`,

    keyPoints: `## Key Points: ${topicName}

${ctx.subtopics.length ? ctx.subtopics.map((s) => `- ${s}`).join("\n") : `- Define ${topicName} in one sentence\n- List 3 exam-style points\n- Give one real-world example`}

**Keywords:** ${ctx.keywords.length ? ctx.keywords.join(" · ") : topicName}`,

    revision: `## Quick Revision: ${topicName}

| Concept | Recall |
|---------|--------|
${ctx.keywords.slice(0, 5).map((k) => `| ${k} | Review definition |`).join("\n") || `| ${topicName} | Core idea |`}

${ctx.objectives.slice(0, 3).map((o) => `- ${o}`).join("\n")}`,

    interview: `## Interview Q&A: ${topicName}

**Q1:** What is ${topicName}?  
**A:** ${ctx.overview.slice(0, 200) || "A core syllabus topic with practical and theoretical importance."}

**Q2:** Name important subtopics.  
**A:** ${ctx.subtopics.slice(0, 5).join(", ") || "Review your subtopics checklist on the study page."}

**Q3:** Why does this topic matter?  
**A:** It supports exam performance and connects to later units in the course.`,

    quiz: `## Quiz: ${topicName}

${ctx.subtopics.slice(0, 5).map((sub, i) => `${i + 1}. What is **${sub}**? Explain in 2–3 sentences.`).join("\n\n") || `1. Define ${topicName}.\n2. List three key keywords.\n3. Give one application.`}`,
  };

  return `${templates[type]}

---
*Generated from structured syllabus content (offline mode).*`;
}
