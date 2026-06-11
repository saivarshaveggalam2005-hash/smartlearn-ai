/**
 * Transform syllabus fragments into structured student-facing learning content.
 * Filters admin metadata and uses winkNLP for keywords and concept grouping.
 */

import { EDUCATIONAL_KEYWORDS } from "@/lib/syllabus-nlp";
import {
  filterEducationalKeywords,
  isStructuralSyllabusNoise,
  isValidTechnicalAcronym,
  isUnitStructuralToken,
  stripUnitMarkers,
} from "@/lib/syllabus-structure";

export interface StudyBlock {
  title: string;
  description: string;
  minutes: number;
  order: number;
}

/** Strip MongoDB subdocument fields before passing to client components */
export function serializeStudyBlocks(
  blocks?: Array<StudyBlock & { _id?: unknown }>
): StudyBlock[] {
  if (!blocks?.length) return [];
  return blocks.map(({ title, description, minutes, order }) => ({
    title,
    description,
    minutes,
    order,
  }));
}

export interface StructuredTopicContent {
  overview: string;
  subtopics: string[];
  keywords: string[];
  learningObjectives: string[];
  studyBlocks: StudyBlock[];
}

const ADMIN_LINE_PATTERNS: RegExp[] = [
  /scheme\s+of\s+instruction/i,
  /for\s+the\s+batch(es)?\s+admitted/i,
  /contact\s+hours?\s+per\s+week/i,
  /^\s*l\s+t\s+p\s+c\s*$/i,
  /^\s*c\s+p\s*$/i,
  /prerequisite/i,
  /^\s*credits?\s*$/i,
  /\bcredits?\s*:\s*\d/i,
  /course\s+code/i,
  /course\s+title/i,
  /^\s*tt\s+a\s*$/i,
  /^u\d{2}[a-z]{2}\d{3}/i,
  /mvsrec/i,
  /regulation/i,
  /instruction\s+hours/i,
  /total\s+(credits?|hours?)/i,
  /department\s+of/i,
  /faculty\s+of/i,
  /semester\s*$/i,
  /text\s*books?/i,
  /reference\s*books?/i,
  /^\s*\d+\s*$/, // lone page numbers
];

const OBJECTIVE_LINE_REGEX =
  /^(?:to\s+)?(?:understand|learn|gain|acquire|develop|analyze|apply|explain|identify|describe|study|explore|implement|design|evaluate)\b/i;

type WinkNlp = ReturnType<typeof import("wink-nlp").default>;

let nlpInstance: WinkNlp | null = null;
let nlpReady = false;

function loadNlp(): WinkNlp | null {
  if (nlpReady) return nlpInstance;
  nlpReady = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const winkNLP = require("wink-nlp").default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const model = require("wink-eng-lite-web-model");
    nlpInstance = winkNLP(model);
    return nlpInstance;
  } catch {
    nlpInstance = null;
    return null;
  }
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Remove administrative syllabus noise */
export function filterEducationalText(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .filter((line) => !ADMIN_LINE_PATTERNS.some((p) => p.test(line)))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string, topicName: string): string[] {
  const keywords = new Set<string>();
  const combined = stripUnitMarkers(`${topicName} ${text}`);

  const acronymMatches = combined.match(/\b[A-Z]{2,8}\b/g) ?? [];
  for (const ac of acronymMatches) {
    if (isValidTechnicalAcronym(ac)) keywords.add(ac);
  }

  const eduMatches = combined.match(EDUCATIONAL_KEYWORDS) ?? [];
  for (const m of eduMatches) keywords.add(titleCase(m));

  const nlp = loadNlp();
  if (nlp) {
    try {
      const doc = nlp.readDoc(combined.slice(0, 2000));
      const entities = doc.entities().out() as string[];
      for (const entity of entities.slice(0, 8)) {
        const cleaned = entity.trim();
        if (
          cleaned.length >= 3 &&
          cleaned.length <= 40 &&
          !isStructuralSyllabusNoise(cleaned)
        ) {
          keywords.add(titleCase(cleaned));
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const word of topicName.split(/\s+/)) {
    if (word.length > 3 && !isUnitStructuralToken(word)) {
      keywords.add(titleCase(word));
    }
  }

  return filterEducationalKeywords(Array.from(keywords)).filter(
    (k) => !/^(the|and|for|with|from|this|that)$/i.test(k)
  );
}

function extractObjectivesFromText(text: string, topicName: string): string[] {
  const objectives: string[] = [];
  const lines = text.split(/[.\n]+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!OBJECTIVE_LINE_REGEX.test(line)) continue;
    if (ADMIN_LINE_PATTERNS.some((p) => p.test(line))) continue;
    const cleaned = line.replace(/^[-•*]\s*/, "").trim();
    if (cleaned.length >= 20 && cleaned.length <= 180) {
      objectives.push(
        cleaned.endsWith(".") ? cleaned : `${cleaned}.`
      );
    }
  }

  if (objectives.length >= 2) return objectives.slice(0, 6);

  return [
    `Understand the core concepts of ${topicName}.`,
    `Explain key terms and how they relate to ${topicName}.`,
    `Apply ${topicName} ideas to exam-style questions and examples.`,
  ];
}

function sanitizeStoredOverview(overview: string, keywords: string[]): string {
  let cleaned = stripUnitMarkers(overview);
  if (keywords.length > 0 && /Focus areas include/i.test(cleaned)) {
    cleaned = cleaned.replace(
      /Focus areas include [^.]+\./i,
      `Focus areas include ${keywords.slice(0, 5).join(", ")}.`
    );
  }
  return cleaned;
}

function buildOverview(input: {
  topicName: string;
  unitTitle?: string;
  parentTopicTitle?: string;
  subjectName?: string;
  keywords: string[];
}): string {
  const unitLabel =
    input.unitTitle && !isStructuralSyllabusNoise(input.unitTitle)
      ? ` in **${input.unitTitle}**`
      : "";
  const parent = input.parentTopicTitle
    ? ` It builds on *${input.parentTopicTitle}*.`
    : "";
  const subject = input.subjectName ? ` (${input.subjectName})` : "";
  const keywordHint =
    input.keywords.length > 0
      ? ` Focus areas include ${input.keywords.slice(0, 5).join(", ")}.`
      : "";

  return (
    `**${input.topicName}**${subject}${unitLabel} introduces essential ideas you need for exams and practical understanding.${parent}${keywordHint} ` +
    `Work through the subtopics below in order, then use the learning path and quick notes to revise.`
  );
}

function buildStudyBlocks(
  topicName: string,
  subtopics: string[],
  estimatedMinutes: number
): StudyBlock[] {
  const blocks: StudyBlock[] = [
    {
      title: "Topic Overview",
      description: `Read the overview and preview all subtopics for ${topicName}.`,
      minutes: Math.max(5, Math.round(estimatedMinutes * 0.15)),
      order: 1,
    },
  ];

  if (subtopics.length > 0) {
    const perSub = Math.max(
      5,
      Math.round((estimatedMinutes * 0.55) / subtopics.length)
    );
    subtopics.forEach((sub, index) => {
      blocks.push({
        title: sub,
        description: `Study definitions, examples, and exam points for ${sub}.`,
        minutes: perSub,
        order: index + 2,
      });
    });
  } else {
    blocks.push({
      title: "Core Concepts",
      description: `Study the main ideas and terminology of ${topicName}.`,
      minutes: Math.max(10, Math.round(estimatedMinutes * 0.4)),
      order: 2,
    });
  }

  blocks.push({
    title: "Practice & Recall",
    description: "Write 3 short answers and explain the topic aloud without notes.",
    minutes: Math.max(8, Math.round(estimatedMinutes * 0.2)),
    order: blocks.length + 1,
  });

  blocks.push({
    title: "Quick Revision",
    description: "Review keywords and learning objectives; mark weak areas for revision.",
    minutes: Math.max(5, Math.round(estimatedMinutes * 0.1)),
    order: blocks.length + 1,
  });

  return blocks;
}

export interface BuildStructuredContentInput {
  topicName: string;
  unitTitle?: string;
  parentTopicTitle?: string;
  siblingSubtopics?: string[];
  subjectName?: string;
  syllabusExcerpt?: string;
  estimatedMinutes?: number;
}

export function buildStructuredLearningContent(
  input: BuildStructuredContentInput
): StructuredTopicContent {
  const filteredExcerpt = input.syllabusExcerpt
    ? filterEducationalText(input.syllabusExcerpt)
    : "";

  let subtopics = (input.siblingSubtopics ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !isStructuralSyllabusNoise(s));

  if (subtopics.length === 0 && filteredExcerpt.includes(",")) {
    subtopics = filteredExcerpt
      .split(/[,;]+|\s+[-–—]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && s.length <= 80)
      .filter((s) => !ADMIN_LINE_PATTERNS.some((p) => p.test(s)))
      .filter((s) => !isStructuralSyllabusNoise(s))
      .slice(0, 10);
  }

  subtopics = subtopics
    .map((s) => titleCase(s.replace(/^[\d.)]+\s*/, "")))
    .filter((s) => !isStructuralSyllabusNoise(s))
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, 12);

  const keywords = extractKeywords(filteredExcerpt, input.topicName);
  const learningObjectives = extractObjectivesFromText(
    filteredExcerpt,
    input.topicName
  );
  const overview = buildOverview({
    topicName: input.topicName,
    unitTitle: input.unitTitle,
    parentTopicTitle: input.parentTopicTitle,
    subjectName: input.subjectName,
    keywords,
  });

  const estimatedMinutes = input.estimatedMinutes ?? 30;
  const studyBlocks = buildStudyBlocks(
    input.topicName,
    subtopics,
    estimatedMinutes
  );

  return {
    overview,
    subtopics,
    keywords,
    learningObjectives,
    studyBlocks,
  };
}

/** Serialize structured content for AI tutor/notes (no raw PDF) */
export function formatStructuredContentForAi(
  content: StructuredTopicContent,
  topicName: string
): string {
  return [
    `Topic: ${topicName}`,
    `Overview: ${content.overview.replace(/\*\*/g, "")}`,
    content.subtopics.length
      ? `Subtopics: ${content.subtopics.join("; ")}`
      : "",
    content.keywords.length
      ? `Keywords: ${content.keywords.join(", ")}`
      : "",
    content.learningObjectives.length
      ? `Objectives: ${content.learningObjectives.join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Ensure legacy topics get structured content at read time */
export function resolveStructuredContent(
  topic: {
    name: string;
    unitTitle?: string;
    parentTopicTitle?: string;
    overview?: string;
    subtopicsList?: string[];
    keywords?: string[];
    learningObjectives?: string[];
    studyBlocks?: StudyBlock[];
    estimatedMinutes?: number;
    content?: string;
  },
  subjectName?: string
): StructuredTopicContent {
  if (
    topic.overview &&
    topic.subtopicsList &&
    topic.keywords &&
    topic.learningObjectives &&
    topic.studyBlocks?.length
  ) {
    const filteredKeywords = filterEducationalKeywords(topic.keywords);
    return {
      overview: sanitizeStoredOverview(topic.overview, filteredKeywords),
      subtopics: topic.subtopicsList.filter((s) => !isStructuralSyllabusNoise(s)),
      keywords: filteredKeywords,
      learningObjectives: topic.learningObjectives,
      studyBlocks: serializeStudyBlocks(topic.studyBlocks),
    };
  }

  return buildStructuredLearningContent({
    topicName: topic.name,
    unitTitle: topic.unitTitle,
    parentTopicTitle: topic.parentTopicTitle,
    siblingSubtopics: topic.subtopicsList,
    subjectName,
    syllabusExcerpt: topic.content,
    estimatedMinutes: topic.estimatedMinutes,
  });
}
