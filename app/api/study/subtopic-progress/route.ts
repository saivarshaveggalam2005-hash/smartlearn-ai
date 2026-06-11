import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Subject } from "@/models/Subject";
import type { ISubtopicProgress } from "@/models/Subject";
import { findTopicById, syncFlatTopicToUnits } from "@/lib/topics";
import { applyCompletionStatus } from "@/lib/topic-analyzer";
import { calculateCompletion } from "@/lib/utils";
import {
  getOrCreateProgressAnalytics,
  processStudySessionOutcome,
} from "@/lib/adaptive-study-plan-engine";
import { refreshTopicIntelligence } from "@/lib/topic-intelligence";
import { awardXp, XP_REWARDS } from "@/lib/engagement";
import { quizPassed } from "@/lib/subtopic-quiz";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const {
      subjectSlug,
      topicId,
      subtopicTitle,
      quizScore,
      skipped,
      checklistOnly,
      completed: checklistCompleted,
    } = body as {
      subjectSlug: string;
      topicId: string;
      subtopicTitle: string;
      quizScore?: number;
      skipped?: boolean;
      checklistOnly?: boolean;
      completed?: boolean;
    };

    if (!subjectSlug || !topicId || !subtopicTitle?.trim()) {
      return NextResponse.json(
        { error: "subjectSlug, topicId, and subtopicTitle required" },
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

    const title = subtopicTitle.trim();

    if (checklistOnly) {
      const entry: ISubtopicProgress = {
        title,
        completed: Boolean(checklistCompleted),
        skipped: false,
        passed: false,
        completedAt: checklistCompleted ? new Date() : undefined,
      };

      if (!topic.subtopicProgress) {
        topic.subtopicProgress = [];
      }

      const existingIndex = topic.subtopicProgress.findIndex(
        (s) => s.title.toLowerCase() === title.toLowerCase()
      );

      if (existingIndex >= 0) {
        if (checklistCompleted) {
          topic.subtopicProgress[existingIndex] = {
            ...topic.subtopicProgress[existingIndex],
            ...entry,
          };
        } else {
          topic.subtopicProgress.splice(existingIndex, 1);
        }
      } else if (checklistCompleted) {
        topic.subtopicProgress.push(entry);
      }

      if (!topic.completed && checklistCompleted) {
        applyCompletionStatus(topic, "in_progress");
        topic.revisionStatus = "in_progress";
      }

      topic.lastStudiedAt = new Date();

      const subtopicList = topic.subtopicsList ?? [];
      const completedCount = topic.subtopicProgress.filter((s) => s.completed).length;
      const allDone =
        subtopicList.length === 0 ||
        subtopicList.every((st) =>
          topic.subtopicProgress?.some(
            (p) => p.title.toLowerCase() === st.toLowerCase() && p.completed
          )
        );

      syncFlatTopicToUnits(subject, topic);
      subject.progress = calculateCompletion(subject.topics);
      await subject.save();

      return NextResponse.json({
        success: true,
        subtopicProgress: topic.subtopicProgress,
        allSubtopicsDone: allDone,
        journeyProgress:
          subtopicList.length > 0
            ? Math.round((completedCount / subtopicList.length) * 100)
            : 100,
      });
    }

    const passed = skipped ? false : quizPassed(Number(quizScore ?? 0));
    const entry: ISubtopicProgress = {
      title,
      completed: skipped ? true : passed,
      skipped: Boolean(skipped),
      passed: skipped ? false : passed,
      quizScore: skipped ? undefined : Number(quizScore),
      completedAt: new Date(),
    };

    if (!topic.subtopicProgress) {
      topic.subtopicProgress = [];
    }

    const existingIndex = topic.subtopicProgress.findIndex(
      (s) => s.title.toLowerCase() === title.toLowerCase()
    );

    if (existingIndex >= 0) {
      topic.subtopicProgress[existingIndex] = {
        ...topic.subtopicProgress[existingIndex],
        ...entry,
      };
    } else {
      topic.subtopicProgress.push(entry);
    }

    if (!topic.completed) {
      applyCompletionStatus(topic, "in_progress");
      topic.revisionStatus = "in_progress";
    }

    topic.lastStudiedAt = new Date();

    const subtopicList = topic.subtopicsList ?? [];
    const completedCount = topic.subtopicProgress.filter(
      (s) => s.completed || s.skipped
    ).length;
    const allDone =
      subtopicList.length === 0 ||
      subtopicList.every((st) =>
        topic.subtopicProgress?.some(
          (p) =>
            p.title.toLowerCase() === st.toLowerCase() &&
            (p.completed || p.skipped)
        )
      );

    if (quizScore !== undefined && !skipped) {
      const scores = topic.subtopicProgress
        .map((s) => s.quizScore)
        .filter((s): s is number => s !== undefined);
      if (scores.length) {
        topic.quizScore = Math.round(
          scores.reduce((a, b) => a + b, 0) / scores.length
        );
      }

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
    }

    refreshTopicIntelligence(topic);

    if (passed && !skipped) {
      const progress = await getOrCreateProgressAnalytics(user.clerkId);
      const engagement = awardXp(
        { xp: progress.xp ?? 0, level: progress.level ?? 1 },
        XP_REWARDS.subtopicQuizPass
      );
      progress.xp = engagement.xp;
      progress.level = engagement.level;
      await progress.save();
    } else if (skipped) {
      const progress = await getOrCreateProgressAnalytics(user.clerkId);
      const engagement = awardXp(
        { xp: progress.xp ?? 0, level: progress.level ?? 1 },
        XP_REWARDS.subtopicSkip
      );
      progress.xp = engagement.xp;
      progress.level = engagement.level;
      await progress.save();
    }

    syncFlatTopicToUnits(subject, topic);
    subject.progress = calculateCompletion(subject.topics);
    await subject.save();

    return NextResponse.json({
      success: true,
      subtopicProgress: topic.subtopicProgress,
      allSubtopicsDone: allDone,
      journeyProgress:
        subtopicList.length > 0
          ? Math.round((completedCount / subtopicList.length) * 100)
          : 100,
      quizScore: topic.quizScore,
      isWeakTopic: topic.isWeakTopic,
      masteryScore: topic.masteryScore,
    });
  } catch (error) {
    console.error("Subtopic progress error:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
