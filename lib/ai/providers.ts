/**
 * Pluggable AI provider interfaces — env-driven with offline NLP fallback.
 */

import {
  getRegistryNotesProvider,
  getRegistryQuizProvider,
  getRegistryTutorProvider,
} from "@/lib/ai/provider-registry";

export type NoteType =
  | "summary"
  | "keyPoints"
  | "revision"
  | "interview"
  | "quiz";

export type AiSource = "fallback" | "gemini" | "openai" | "huggingface" | "ollama";

export interface AiTextResult {
  text: string;
  source: AiSource;
  cached?: boolean;
  unavailable?: boolean;
  error?: string;
}

export interface NotesRequest {
  topicName: string;
  content: string;
  type: NoteType;
}

export interface TutorRequest {
  topicName: string;
  content: string;
  question?: string;
}

export interface QuizRequest {
  topicName: string;
  content: string;
}

export interface NotesProvider {
  generate(request: NotesRequest): Promise<AiTextResult>;
}

export interface TutorProvider {
  explain(request: TutorRequest): Promise<AiTextResult>;
}

export interface QuizProvider {
  generate(request: QuizRequest): Promise<AiTextResult>;
}

export function getNotesProvider(): NotesProvider {
  return getRegistryNotesProvider();
}

export function getTutorProvider(): TutorProvider {
  return getRegistryTutorProvider();
}

export function getQuizProvider(): QuizProvider {
  return getRegistryQuizProvider();
}
