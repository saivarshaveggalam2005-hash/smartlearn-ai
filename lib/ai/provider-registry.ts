/**
 * Env-driven AI provider registry with automatic offline fallback.
 * Remote generation delegates to Gemini when AI_PROVIDER=gemini.
 * Never throws — callers always receive structured text.
 */

import {
  getFallbackAINotes,
  getFallbackTutorExplanation,
} from "@/lib/ai-fallback";
import { callGemini, isGeminiConfigured } from "@/lib/ai/gemini-client";
import type {
  AiTextResult,
  NotesProvider,
  NotesRequest,
  QuizProvider,
  QuizRequest,
  TutorProvider,
  TutorRequest,
  AiSource,
} from "@/lib/ai/providers";
import {
  buildExamPrompt,
  buildNotesPrompt,
  buildTutorPrompt,
} from "@/lib/ai/prompts";

export type AiProviderName =
  | "gemini"
  | "openai"
  | "huggingface"
  | "ollama"
  | "offline";

export function getConfiguredAiProvider(): AiProviderName {
  const raw = (process.env.AI_PROVIDER ?? "offline").toLowerCase();
  if (
    raw === "gemini" ||
    raw === "openai" ||
    raw === "huggingface" ||
    raw === "ollama" ||
    raw === "offline"
  ) {
    return raw;
  }
  return "offline";
}

function mapProviderToSource(provider: AiProviderName): AiSource {
  if (provider === "offline") return "fallback";
  return provider;
}

async function callRemoteText(
  provider: AiProviderName,
  prompt: string
): Promise<string | null> {
  if (provider === "offline") return null;

  if (provider === "gemini") {
    return callGemini(prompt);
  }

  try {
    if (provider === "ollama") {
      const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL ?? "llama3.2";
      const res = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { response?: string };
      return data.response?.trim() || null;
    }

    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content?.trim() || null;
    }

    if (provider === "huggingface" && process.env.HUGGINGFACE_API_KEY) {
      const model =
        process.env.HUGGINGFACE_MODEL ??
        "mistralai/Mistral-7B-Instruct-v0.2";
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: 512 },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as
        | { generated_text?: string }[]
        | { generated_text?: string };
      if (Array.isArray(data)) {
        return data[0]?.generated_text?.trim() || null;
      }
      return data.generated_text?.trim() || null;
    }
  } catch {
    return null;
  }

  return null;
}

function buildLegacyNotesPrompt(request: NotesRequest): string {
  return buildNotesPrompt({
    topicName: request.topicName,
    content: request.content,
  });
}

class RegistryNotesProvider implements NotesProvider {
  async generate(request: NotesRequest): Promise<AiTextResult> {
    const provider = getConfiguredAiProvider();
    const prompt = buildLegacyNotesPrompt(request);
    const remote = await callRemoteText(provider, prompt);
    if (remote) {
      return { text: remote, source: mapProviderToSource(provider) };
    }
    return {
      text: getFallbackAINotes(request.topicName, request.content, request.type),
      source: "fallback",
      error: isGeminiConfigured()
        ? "AI-generated notes are temporarily unavailable. You can continue studying using the extracted syllabus content."
        : undefined,
    };
  }
}

class RegistryTutorProvider implements TutorProvider {
  async explain(request: TutorRequest): Promise<AiTextResult> {
    const provider = getConfiguredAiProvider();
    const prompt = buildTutorPrompt(
      { topicName: request.topicName, content: request.content },
      request.question
    );
    const remote = await callRemoteText(provider, prompt);
    if (remote) {
      return { text: remote, source: mapProviderToSource(provider) };
    }
    return {
      text: getFallbackTutorExplanation(
        request.topicName,
        request.content,
        request.question
      ),
      source: "fallback",
      error: isGeminiConfigured()
        ? "AI-generated notes are temporarily unavailable. You can continue studying using the extracted syllabus content."
        : undefined,
    };
  }
}

class RegistryQuizProvider implements QuizProvider {
  async generate(request: QuizRequest): Promise<AiTextResult> {
    const provider = getConfiguredAiProvider();
    const prompt = buildExamPrompt({
      topicName: request.topicName,
      content: request.content,
    });
    const remote = await callRemoteText(provider, prompt);
    if (remote) {
      return { text: remote, source: mapProviderToSource(provider) };
    }
    return {
      text: getFallbackAINotes(request.topicName, request.content, "quiz"),
      source: "fallback",
    };
  }
}

const notesProvider = new RegistryNotesProvider();
const tutorProvider = new RegistryTutorProvider();
const quizProvider = new RegistryQuizProvider();

export function getRegistryNotesProvider(): NotesProvider {
  return notesProvider;
}

export function getRegistryTutorProvider(): TutorProvider {
  return tutorProvider;
}

export function getRegistryQuizProvider(): QuizProvider {
  return quizProvider;
}
