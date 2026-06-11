import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Subject } from "@/models/Subject";
import { calculateCompletion } from "@/lib/utils";
import { findTopicById, syncFlatTopicToUnits } from "@/lib/topics";
import {
  applyCompletionStatus,
  completionStatusFromTopic,
  analyzeTopicWithAdaptiveInput,
} from "@/lib/topic-analyzer";
import { applyAnalyzedToTopic } from "@/lib/topics";
import {
  getOrCreateProgressAnalytics,
  syncTopicRevisionState,
} from "@/lib/adaptive-study-plan-engine";
import { refreshTopicIntelligence } from "@/lib/topic-intelligence";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    await connectDB();

    if (slug) {
      const subject = await Subject.findOne({
        userId: user.clerkId,
        slug,
      }).lean();

      if (!subject) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({
        ...subject,
        _id: subject._id.toString(),
        topics: subject.topics.map((t) => ({
          ...t,
          _id: t._id?.toString(),
        })),
      });
    }

    const subjects = await Subject.find({ userId: user.clerkId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(
      subjects.map((s) => ({
        _id: s._id.toString(),
        subjectName: s.subjectName,
        slug: s.slug,
        progress: calculateCompletion(s.topics),
        topicCount: s.topics.length,
        pendingCount: s.topics.filter((t) => !t.completed).length,
        estimatedHours: s.topics
          .filter((t) => !t.completed)
          .reduce(
            (sum, t) =>
              sum + (t.estimatedMinutes ?? t.estimatedHours * 60) / 60,
            0
          ),
        topics: s.topics.map((t) => ({
          ...t,
          _id: t._id?.toString(),
        })),
      }))
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const { subjectSlug, topicId, updates } = await req.json();

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

    Object.assign(topic, updates);

    if (updates?.completed === true) {
      applyCompletionStatus(topic, "completed");
    } else if (updates?.revisionStatus === "in_progress") {
      applyCompletionStatus(topic, "in_progress");
    } else if (
      updates?.completionStatus &&
      ["not_started", "in_progress", "completed"].includes(updates.completionStatus)
    ) {
      applyCompletionStatus(topic, updates.completionStatus);
    } else {
      topic.completionStatus = completionStatusFromTopic(topic);
    }

    if (updates?.markedDifficult === true) {
      topic.markedDifficult = true;
      const analyzed = analyzeTopicWithAdaptiveInput({
        title: topic.name,
        difficulty: topic.difficulty,
        subtopicCount: topic.subtopicCount,
        practiceCount: topic.practiceCount,
        learningOutcomeCount: topic.learningOutcomeCount,
        markedDifficult: true,
        isWeakTopic: topic.isWeakTopic,
        actualMinutesSpent: topic.actualMinutesSpent ?? topic.studyMinutes,
        revisionsCount: topic.revisionsCount,
        difficultyScore: topic.difficultyScore,
        weakTopicScore: topic.weakTopicScore,
      });
      applyAnalyzedToTopic(topic, analyzed);
    }

    const progress = await getOrCreateProgressAnalytics(user.clerkId);
    refreshTopicIntelligence(topic);
    syncTopicRevisionState(
      topic,
      { slug: subject.slug, subjectName: subject.subjectName },
      progress,
      topic.completed ?? false
    );
    await progress.save();

    syncFlatTopicToUnits(subject, topic);
    subject.progress = calculateCompletion(subject.topics);
    await subject.save();

    return NextResponse.json({ success: true, progress: subject.progress });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
