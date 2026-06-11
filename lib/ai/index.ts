import { callGemini, GEMINI_UNAVAILABLE, isGeminiConfigured } from "@/lib/ai/gemini-client";
import {
  getFallbackAINotes,
  getFallbackTutorExplanation,
} from "@/lib/ai-fallback";
import { getCachedAiContent, saveCachedAiContent } from "@/lib/ai/cache";
import {
  buildExamPrompt,
  buildFlashcardsPrompt,
  buildInterviewPrompt,
  buildNotesPrompt,
  buildRevisionSheetPrompt,
  buildTutorPrompt,
} from "@/lib/ai/prompts";
import type {
  AiGenerationResult,
  GenerateOptions,
  InterviewLevel,
  RevisionDuration,
  TopicContext,
} from "@/lib/ai/types";
import {
  noteTypeToContentKind,
  revisionDurationToKind,
  tutorContentKind,
} from "@/lib/ai/types";
import type { NoteType } from "@/lib/ai/providers";

async function generateWithGeminiOrFallback(
  prompt: string,
  fallback: () => string
): Promise<AiGenerationResult> {
  if (isGeminiConfigured()) {
    const remote = await callGemini(prompt);
    if (remote) {
      return { text: remote, source: "gemini" };
    }
    return {
      text: appendGeminiUnavailableNotice(fallback()),
      source: "fallback",
      unavailable: true,
      error: GEMINI_UNAVAILABLE,
    };
  }

  return { text: fallback(), source: "fallback" };
}

function appendGeminiUnavailableNotice(text: string): string {
  const cleaned = text.replace(
    /\*Generated from structured syllabus content \(offline mode\)\.\*/g,
    ""
  );
  return `${cleaned.trim()}\n\n---\n*${GEMINI_UNAVAILABLE}*`;
}

function cacheKeyFromOptions(
  options: GenerateOptions,
  contentKind: string
): { userId: string; subjectSlug: string; topicId: string; contentKind: string } | null {
  if (!options.userId || !options.subjectSlug || !options.topicId) return null;
  return {
    userId: options.userId,
    subjectSlug: options.subjectSlug,
    topicId: options.topicId,
    contentKind,
  };
}

async function withCache(
  options: GenerateOptions,
  contentKind: string,
  generate: () => Promise<AiGenerationResult>
): Promise<AiGenerationResult> {
  const key = cacheKeyFromOptions(options, contentKind);

  if (key && !options.skipCache) {
    const cached = await getCachedAiContent(key);
    if (cached) {
      return {
        text: cached.content,
        source: cached.source,
        cached: true,
      };
    }
  }

  const result = await generate();

  if (key && result.source !== "fallback") {
    await saveCachedAiContent(key, result.text, result.source);
  }

  return result;
}

function topicContextFromOptions(options: GenerateOptions): TopicContext {
  return {
    topicName: options.topicName,
    content: options.content,
    subjectName: options.subjectName,
    unitTitle: options.unitTitle,
    parentTopicTitle: options.parentTopicTitle,
    subtopics: options.subtopics,
  };
}

/** Comprehensive notes: summary, key concepts, keywords, revision, exam tips, mistakes */
export async function generateNotes(
  options: GenerateOptions
): Promise<AiGenerationResult> {
  const ctx = topicContextFromOptions(options);
  return withCache(options, "notes", () =>
    generateWithGeminiOrFallback(buildNotesPrompt(ctx), () =>
      getFallbackAINotes(options.topicName, options.content, "summary")
    )
  );
}

export async function generateFlashcards(
  options: GenerateOptions
): Promise<AiGenerationResult> {
  const ctx = topicContextFromOptions(options);
  return withCache(options, "flashcards", () =>
    generateWithGeminiOrFallback(buildFlashcardsPrompt(ctx), () =>
      `## Flashcards: ${options.topicName}\n\n**Q:** What is ${options.topicName}?\n**A:** Review the topic overview and subtopics in your study checklist.\n\n---\n*${GEMINI_UNAVAILABLE}*`
    )
  );
}

export async function generateInterviewQuestions(
  options: GenerateOptions & { level?: InterviewLevel }
): Promise<AiGenerationResult> {
  const ctx = topicContextFromOptions(options);
  return withCache(options, "interview", () =>
    generateWithGeminiOrFallback(
      buildInterviewPrompt(ctx, options.level ?? "all"),
      () => getFallbackAINotes(options.topicName, options.content, "interview")
    )
  );
}

export async function generateExamQuestions(
  options: GenerateOptions
): Promise<AiGenerationResult> {
  const ctx = topicContextFromOptions(options);
  return withCache(options, "exam", () =>
    generateWithGeminiOrFallback(buildExamPrompt(ctx), () =>
      getFallbackAINotes(options.topicName, options.content, "quiz")
    )
  );
}

export async function generateRevisionSheet(
  options: GenerateOptions & { duration?: RevisionDuration }
): Promise<AiGenerationResult> {
  const duration = options.duration ?? "5min";
  const kind = revisionDurationToKind(duration);
  const ctx = topicContextFromOptions(options);
  return withCache(options, kind, () =>
    generateWithGeminiOrFallback(buildRevisionSheetPrompt(ctx, duration), () =>
      getFallbackAINotes(options.topicName, options.content, "revision")
    )
  );
}

export async function askTutor(
  options: GenerateOptions & { question?: string }
): Promise<AiGenerationResult> {
  const ctx = topicContextFromOptions(options);
  const kind = tutorContentKind(options.question);
  return withCache(options, kind, () =>
    generateWithGeminiOrFallback(
      buildTutorPrompt(ctx, options.question),
      () =>
        getFallbackTutorExplanation(
          options.topicName,
          options.content,
          options.question
        )
    )
  );
}

/** Routes legacy NoteType values to the appropriate generator (backward compatible). */
export async function generateByNoteType(
  options: GenerateOptions & { type: NoteType }
): Promise<AiGenerationResult> {
  const { type, ...rest } = options;

  switch (type) {
    case "summary":
    case "keyPoints":
      return generateNotes(rest);
    case "revision":
      return generateRevisionSheet({ ...rest, duration: "5min" });
    case "interview":
      return generateInterviewQuestions(rest);
    case "quiz":
      return generateExamQuestions(rest);
    default:
      return generateNotes(rest);
  }
}

export { noteTypeToContentKind, GEMINI_UNAVAILABLE };
