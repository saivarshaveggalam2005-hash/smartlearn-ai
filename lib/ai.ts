import { type AnalyzedTopic } from "@/lib/topic-analyzer";
import { parseSyllabusWithFallback } from "@/lib/syllabus-parser";
import {
  buildSubjectContentFromSyllabus,
  type StoredSubjectContent,
} from "@/lib/subject-storage";
import {
  type NoteType,
  type AiTextResult,
  type AiSource,
} from "@/lib/ai/providers";
import {
  generateByNoteType,
  askTutor as askTutorService,
  generateNotes,
  generateFlashcards,
  generateInterviewQuestions,
  generateExamQuestions,
  generateRevisionSheet,
} from "@/lib/ai/index";
import type { GenerateOptions } from "@/lib/ai/types";import { extractPdfViaOcr, type ExtractionMethod } from "@/lib/syllabus-extract";
import {
  assessExtractionQuality,
  pickBetterParsedResult,
} from "@/lib/syllabus-quality";

export type { NoteType, AiTextResult, AiSource, GenerateOptions };
export {
  generateNotes,
  generateFlashcards,
  generateInterviewQuestions,
  generateExamQuestions,
  generateRevisionSheet,
  askTutorService as askTutorFromService,
};

export interface ExtractedSyllabusContent extends StoredSubjectContent {
  analyzedTopics: AnalyzedTopic[];
}

export interface ExtractSyllabusOptions {
  weakSubjects?: string[];
  sourceBuffer?: Buffer;
  mimeType?: string;
  extractionMethod?: ExtractionMethod;
}

/** Hierarchical NLP/rule-based extraction with OCR quality retry */
export async function extractSyllabusContent(
  text: string,
  subjectHint?: string,
  options?: ExtractSyllabusOptions
): Promise<ExtractedSyllabusContent> {
  let workingText = text;
  let parsed = parseSyllabusWithFallback(workingText);
  let quality = assessExtractionQuality(
    parsed,
    workingText,
    options?.extractionMethod
  );

  if (
    quality.shouldRetryOcr &&
    options?.sourceBuffer &&
    options.mimeType === "application/pdf"
  ) {
    try {
      const ocrExtraction = await extractPdfViaOcr(options.sourceBuffer);
      const ocrParsed = parseSyllabusWithFallback(ocrExtraction.text);
      const ocrQuality = assessExtractionQuality(
        ocrParsed,
        ocrExtraction.text,
        ocrExtraction.method
      );

      const picked = pickBetterParsedResult(
        { parsed, text: workingText, quality },
        { parsed: ocrParsed, text: ocrExtraction.text, quality: ocrQuality }
      );

      parsed = picked.parsed;
      workingText = picked.text;
    } catch (error) {
      console.error("Parse-quality OCR retry failed:", error);
    }
  }

  const built = buildSubjectContentFromSyllabus(parsed, {
    subjectName: subjectHint ?? "General",
    weakSubjects: options?.weakSubjects,
    syllabusSnippet: workingText.slice(0, 2000),
  });

  return {
    ...built,
    analyzedTopics: built.topics.map((t) => ({
      name: t.name,
      difficulty: t.difficulty,
      difficultyLevel: t.initialDifficultyLevel ?? t.difficulty,
      initialDifficultyLevel: t.initialDifficultyLevel ?? "medium",
      estimatedHours: t.estimatedHours,
      estimatedMinutes: t.estimatedMinutes,
      baselineEstimatedMinutes: t.baselineEstimatedMinutes,
      subtopicCount: t.subtopicCount,
      hierarchyDepth: t.hierarchyDepth,
      practiceCount: t.practiceCount,
      learningOutcomeCount: t.learningOutcomeCount,
      recommendedPomodoros: t.recommendedPomodoros,
      difficultyScore: t.difficultyScore,
      complexityScore: t.complexityScore,
      weakTopicScore: t.weakTopicScore,
      isWeakTopic: t.isWeakTopic,
      completionStatus: t.completionStatus,
    })),
  };
}

/** @deprecated Use extractSyllabusContent — kept for compatibility */
export async function extractTopicsFromText(
  text: string,
  subjectHint?: string,
  options?: { weakSubjects?: string[] }
): Promise<AnalyzedTopic[]> {
  const content = await extractSyllabusContent(text, subjectHint, options);
  return content.analyzedTopics;
}

export async function generateAINotes(
  topicName: string,
  content: string,
  type: NoteType,
  options?: Omit<GenerateOptions, "topicName" | "content" | "type">
): Promise<AiTextResult> {
  return generateByNoteType({
    topicName,
    content: content.trim() || `Study material for ${topicName}`,
    type,
    ...options,
  });
}

export async function getTutorExplanation(
  topicName: string,
  question?: string,
  content?: string,
  options?: Omit<
    GenerateOptions,
    "topicName" | "content" | "question"
  >
): Promise<AiTextResult> {
  return askTutorService({
    topicName,
    question,
    content:
      content?.trim() || `Introduction and learning goals for ${topicName}.`,
    ...options,
  });
}

export async function getAIRecommendations(context: {
  weakSubjects: string[];
  pendingTopics: number;
  streak: number;
  examDate?: Date;
  subjects?: Array<{
    slug: string;
    subjectName: string;
    topics: import("@/models/Subject").ITopic[];
  }>;
  progress?: {
    revisionQueue?: import("@/models/Progress").IRevisionQueueEntry[];
    weakTopics?: string[];
    averageQuizScore?: number;
    learningFactor?: number;
  } | null;
}): Promise<string[]> {
  const {
    buildStructuredRecommendations,
    recommendationsToStrings,
  } = await import("@/lib/recommendations");

  const recs = buildStructuredRecommendations({
    weakSubjects: context.weakSubjects,
    pendingTopics: context.pendingTopics,
    streak: context.streak,
    examDate: context.examDate,
    revisionQueue: context.progress?.revisionQueue,
    weakTopicIds: context.progress?.weakTopics,
    averageQuizScore: context.progress?.averageQuizScore,
    learningFactor: context.progress?.learningFactor,
    subjects: context.subjects,
  });

  const strings = recommendationsToStrings(recs);
  if (strings.length > 0) return strings;

  return [
    "Review your weakest topic for 25 minutes today",
    "Complete one pending topic before starting a new subject",
    "Take a 5-minute break every 25 minutes (Pomodoro)",
  ];
}
