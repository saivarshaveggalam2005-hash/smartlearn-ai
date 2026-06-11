import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Subject } from "@/models/Subject";
import { Progress } from "@/models/Progress";
import { findTopicById, syncFlatTopicToUnits } from "@/lib/topics";
import {
  applyQuizScoreToTopic,
  analyzeTopicWithAdaptiveInput,
} from "@/lib/topic-analyzer";
import { applyAnalyzedToTopic } from "@/lib/topics";
import { calculateCompletion } from "@/lib/utils";
import {
  getOrCreateProgressAnalytics,
  processStudySessionOutcome,
} from "@/lib/adaptive-study-plan-engine";
import { profileFromProgress } from "@/lib/adaptive-study-time";

/** Store quiz score and update weak/strong topic analytics */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { subjectSlug, topicId, quizScore } = await req.json();

    if (!subjectSlug || !topicId || quizScore === undefined) {
      return NextResponse.json(
        { error: "subjectSlug, topicId, and quizScore required" },
        { status: 400 }
      );
    }

    await connectDB();

    const subject = await Subject.findOne({
      userId: user.clerkId,
      slug: subjectSlug,
    });

    if (!subject) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const topic = findTopicById(subject.topics, topicId);
    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    applyQuizScoreToTopic(
      topic as unknown as Record<string, unknown>,
      Number(quizScore)
    );

    const progress = await getOrCreateProgressAnalytics(user.clerkId);
    const learningFactor = profileFromProgress(progress).learningFactor;

    const analyzed = analyzeTopicWithAdaptiveInput({
      title: topic.name,
      subtopicCount: topic.subtopicCount,
      hierarchyDepth: topic.hierarchyDepth,
      baselineEstimatedMinutes: topic.baselineEstimatedMinutes,
      difficulty: topic.initialDifficultyLevel,
      isWeakTopic: topic.isWeakTopic,
      quizScore: topic.quizScore,
      revisionsCount: topic.revisionsCount,
      learningFactor,
    });

    applyAnalyzedToTopic(topic, analyzed);

    await processStudySessionOutcome(
      {
        userId: user.clerkId,
        subjectSlug,
        subjectName: subject.subjectName,
        topicId,
        topicName: topic.name,
        durationMinutes: 0,
        completed: false,
        quizScore: Number(quizScore),
      },
      topic,
      subject
    );

    syncFlatTopicToUnits(subject, topic);
    subject.progress = calculateCompletion(subject.topics);
    await subject.save();

    return NextResponse.json({
      success: true,
      quizScore: topic.quizScore,
      isWeakTopic: topic.isWeakTopic,
      estimatedMinutes: topic.estimatedMinutes,
    });
  } catch {
    return NextResponse.json({ error: "Quiz save failed" }, { status: 500 });
  }
}
