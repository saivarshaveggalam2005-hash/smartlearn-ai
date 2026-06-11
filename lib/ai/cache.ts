import { connectDB } from "@/lib/db";
import { AiContentCache } from "@/models/AiContentCache";
import type { AiSource } from "@/lib/ai/providers";
import type { CacheKey } from "@/lib/ai/types";

export async function getCachedAiContent(
  key: CacheKey
): Promise<{ content: string; source: AiSource } | null> {
  await connectDB();
  const doc = await AiContentCache.findOne({
    userId: key.userId,
    subjectSlug: key.subjectSlug,
    topicId: key.topicId,
    contentKind: key.contentKind,
  }).lean();

  if (!doc?.content) return null;
  if (doc.source === "fallback") return null;

  return { content: doc.content, source: doc.source as AiSource };
}

export async function saveCachedAiContent(
  key: CacheKey,
  content: string,
  source: AiSource
): Promise<void> {
  if (source === "fallback") return;

  await connectDB();
  await AiContentCache.findOneAndUpdate(
    {
      userId: key.userId,
      subjectSlug: key.subjectSlug,
      topicId: key.topicId,
      contentKind: key.contentKind,
    },
    { content, source },
    { upsert: true, new: true }
  );
}
