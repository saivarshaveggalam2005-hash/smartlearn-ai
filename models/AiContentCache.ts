import mongoose, { Schema, Document, Model } from "mongoose";
import type { AiSource } from "@/lib/ai/providers";

export type AiContentKind =
  | "notes"
  | "flashcards"
  | "interview"
  | "exam"
  | "revision-2min"
  | "revision-5min"
  | "revision-night"
  | "tutor-welcome"
  | `tutor-q-${string}`;

export interface IAiContentCache extends Document {
  userId: string;
  subjectSlug: string;
  topicId: string;
  contentKind: string;
  content: string;
  source: AiSource;
  createdAt: Date;
  updatedAt: Date;
}

const AiContentCacheSchema = new Schema<IAiContentCache>(
  {
    userId: { type: String, required: true, index: true },
    subjectSlug: { type: String, required: true },
    topicId: { type: String, required: true },
    contentKind: { type: String, required: true },
    content: { type: String, required: true },
    source: {
      type: String,
      enum: ["fallback", "gemini", "openai", "huggingface", "ollama"],
      required: true,
    },
  },
  { timestamps: true }
);

AiContentCacheSchema.index(
  { userId: 1, subjectSlug: 1, topicId: 1, contentKind: 1 },
  { unique: true }
);

export const AiContentCache: Model<IAiContentCache> =
  mongoose.models.AiContentCache ??
  mongoose.model<IAiContentCache>("AiContentCache", AiContentCacheSchema);
