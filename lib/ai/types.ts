import type { NoteType, AiSource } from "@/lib/ai/providers";

export interface TopicContext {
  topicName: string;
  content: string;
  subjectName?: string;
  unitTitle?: string;
  parentTopicTitle?: string;
  subtopics?: string[];
}

export interface CacheKey {
  userId: string;
  subjectSlug: string;
  topicId: string;
  contentKind: string;
}

export interface AiGenerationResult {
  text: string;
  source: AiSource;
  cached?: boolean;
  unavailable?: boolean;
  error?: string;
}

export interface GenerateOptions extends TopicContext {
  userId?: string;
  subjectSlug?: string;
  topicId?: string;
  skipCache?: boolean;
}

export type RevisionDuration = "2min" | "5min" | "night";

export type InterviewLevel = "basic" | "intermediate" | "advanced" | "all";

export function noteTypeToContentKind(type: NoteType): string {
  switch (type) {
    case "summary":
    case "keyPoints":
      return "notes";
    case "revision":
      return "revision-5min";
    case "interview":
      return "interview";
    case "quiz":
      return "exam";
    default:
      return "notes";
  }
}

export function revisionDurationToKind(duration: RevisionDuration): string {
  switch (duration) {
    case "2min":
      return "revision-2min";
    case "5min":
      return "revision-5min";
    case "night":
      return "revision-night";
  }
}

export function tutorContentKind(question?: string): string {
  const q = question?.trim();
  if (!q) return "tutor-welcome";
  const normalized = q.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `tutor-q-${Math.abs(hash)}`;
}
