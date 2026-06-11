import { NextResponse } from "next/server";

export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { extractSyllabusText } from "@/lib/syllabus-extract";
import { extractSyllabusContent } from "@/lib/ai";
import { Subject } from "@/models/Subject";
import { slugify, calculateCompletion } from "@/lib/utils";
import { buildUnitsDocumentFromTopics } from "@/lib/unit-helpers";
import {
  resolveUploadMimeType,
  UPLOAD_FORMATS_LABEL,
} from "@/lib/upload-config";
import { syncAllRevisionQueues, getOrCreateProgressAnalytics, applyLearningPaceToPendingTopics } from "@/lib/adaptive-study-plan-engine";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subjectName = (formData.get("subjectName") as string)?.trim();

    if (!file || !subjectName) {
      return NextResponse.json(
        { error: "File and subject name required" },
        { status: 400 }
      );
    }

    const mimeType = resolveUploadMimeType(file.name, file.type);
    if (!mimeType) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed: ${UPLOAD_FORMATS_LABEL}`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractSyllabusText(buffer, mimeType);

    if (!extraction.text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from this file. Try a clearer image or PDF." },
        { status: 400 }
      );
    }

    const extracted = await extractSyllabusContent(extraction.text, subjectName, {
      weakSubjects: user.weakSubjects,
      sourceBuffer: buffer,
      mimeType,
      extractionMethod: extraction.method,
    });

    if (extracted.topics.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not detect syllabus topics. Use a clearer photo/PDF with visible UNIT sections and topic lists.",
        },
        { status: 400 }
      );
    }

    const slug = slugify(subjectName);

    await connectDB();

    const topics = extracted.topics.map((t) => ({
      name: t.name,
      slug: t.slug,
      unitTitle: t.unitTitle,
      difficulty: t.difficulty,
      estimatedHours: t.estimatedHours,
      estimatedMinutes: t.estimatedMinutes,
      baselineEstimatedMinutes: t.baselineEstimatedMinutes,
      subtopicCount: t.subtopicCount,
      hierarchyDepth: t.hierarchyDepth,
      parentTopicTitle: t.parentTopicTitle,
      initialDifficultyLevel: t.initialDifficultyLevel,
      practiceCount: t.practiceCount,
      learningOutcomeCount: t.learningOutcomeCount,
      recommendedPomodoros: t.recommendedPomodoros,
      actualMinutesSpent: 0,
      revisionsCount: 0,
      difficultyScore: t.difficultyScore,
      complexityScore: t.complexityScore ?? t.difficultyScore,
      learningFactor: t.learningFactor ?? 1,
      weakTopicScore: t.weakTopicScore,
      markedDifficult: false,
      revisionPriority: t.isWeakTopic ? 55 : 0,
      inRevisionQueue: t.isWeakTopic ?? false,
      completed: false,
      completionStatus: t.completionStatus,
      isWeakTopic: t.isWeakTopic,
      revisionStatus: "not_started" as const,
      studyMinutes: 0,
      content: t.content,
      overview: t.overview,
      subtopicsList: t.subtopicsList,
      keywords: t.keywords,
      learningObjectives: t.learningObjectives,
      studyBlocks: t.studyBlocks,
    }));

    const units = buildUnitsDocumentFromTopics(topics, extracted.units);

    const subject = await Subject.findOneAndUpdate(
      { userId: user.clerkId, slug },
      {
        $set: {
          userId: user.clerkId,
          subjectName,
          slug,
          units,
          topics,
          progress: 0,
          syllabusText: extraction.text.slice(0, 50000),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    const analytics = await getOrCreateProgressAnalytics(user.clerkId);
    await syncAllRevisionQueues(user.clerkId);
    await applyLearningPaceToPendingTopics(
      user.clerkId,
      analytics.learningFactor ?? analytics.learningPaceMultiplier ?? 1
    );

    return NextResponse.json({
      success: true,
      subject: {
        id: subject._id,
        name: subject.subjectName,
        slug: subject.slug,
        unitCount: units.length,
        topicCount: topics.length,
        progress: calculateCompletion(topics),
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Upload failed";

    if (message.includes("ECONNREFUSED") || message.includes("MongoServerSelectionError")) {
      return NextResponse.json(
        {
          error:
            "Could not connect to the database. Check MongoDB Atlas IP whitelist and connection string.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message.length < 120 ? message : "Upload failed" },
      { status: 500 }
    );
  }
}
