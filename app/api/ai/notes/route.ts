import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import { findTopicById } from "@/lib/topics";
import { generateByNoteType } from "@/lib/ai/index";
import type { NoteType } from "@/lib/ai/providers";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const {
      topicName,
      subjectSlug,
      topicId,
      type,
      content: clientContent,
      subjectName,
      unitTitle,
      parentTopicTitle,
      subtopics,
      skipCache,
    } = await req.json();

    if (!topicName?.trim()) {
      return NextResponse.json(
        { error: "Topic name is required" },
        { status: 400 }
      );
    }

    let content = (clientContent as string)?.trim() ?? "";
    let resolvedSubjectName = subjectName as string | undefined;
    let resolvedUnitTitle = unitTitle as string | undefined;
    let resolvedSubtopics = subtopics as string[] | undefined;

    if (subjectSlug && topicId) {
      await connectDB();
      const subject = await Subject.findOne({
        userId: user.clerkId,
        slug: subjectSlug,
      });
      const topic = subject ? findTopicById(subject.topics, topicId) : undefined;

      if (!content && topic) {
        content = topic.content ?? topic.notes ?? "";
      }
      if (!resolvedSubjectName && subject) {
        resolvedSubjectName = subject.subjectName;
      }
      if (!resolvedUnitTitle && topic?.unitTitle) {
        resolvedUnitTitle = topic.unitTitle;
      }
      if (!resolvedSubtopics?.length && topic?.subtopicsList?.length) {
        resolvedSubtopics = topic.subtopicsList;
      }
    }

    const result = await generateByNoteType({
      userId: user.clerkId,
      subjectSlug,
      topicId,
      topicName,
      content: content || `Study material for ${topicName}`,
      subjectName: resolvedSubjectName,
      unitTitle: resolvedUnitTitle,
      parentTopicTitle,
      subtopics: resolvedSubtopics,
      skipCache: Boolean(skipCache),
      type: ((type as NoteType) || "summary"),
    });

    return NextResponse.json({
      notes: result.text,
      source: result.source,
      cached: result.cached ?? false,
      unavailable: result.unavailable ?? false,
      error: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
