import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { StudySession } from "@/models/StudySession";
import { Subject } from "@/models/Subject";
import { Progress } from "@/models/Progress";
import {
  findTopicById,
  syncFlatTopicToUnits,
  applyAnalyzedToTopic,
} from "@/lib/topics";
import { calculateCompletion } from "@/lib/utils";
import {
  applyCompletionStatus,
  adaptTopicAfterSession,
} from "@/lib/topic-analyzer";
import { processStudySessionOutcome } from "@/lib/adaptive-study-plan-engine";
import { profileFromProgress } from "@/lib/adaptive-study-time";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const {
      subjectId,
      topicId,
      topicName,
      duration,
      completed,
      notesGenerated,
      pomodoroSessions,
      subjectSlug,
      markedDifficult,
      quizScore,
      sessionStartedAt,
      sessionEndedAt,
    } = await req.json();

    await connectDB();

    const progressDoc = await Progress.findOne({ userId: user.clerkId });
    const learningFactor = profileFromProgress(progressDoc).learningFactor;

    if (subjectSlug && topicId) {
      const subject = await Subject.findOne({
        userId: user.clerkId,
        slug: subjectSlug,
      });

      if (subject) {
        const topic = findTopicById(subject.topics, topicId);
        if (topic) {
          const sessionMinutes = duration ?? 0;
          const endedAt = sessionEndedAt
            ? new Date(sessionEndedAt)
            : new Date();
          const startedAt = sessionStartedAt
            ? new Date(sessionStartedAt)
            : new Date(endedAt.getTime() - sessionMinutes * 60_000);

          const session = await StudySession.create({
            userId: user.clerkId,
            subjectId,
            topicId,
            topicName,
            duration: sessionMinutes,
            sessionStartedAt: startedAt,
            sessionEndedAt: endedAt,
            estimatedMinutesAtStart:
              topic.estimatedMinutes ?? topic.baselineEstimatedMinutes,
            quizScore,
            completedAt: completed ? endedAt : undefined,
            notesGenerated,
            pomodoroSessions: pomodoroSessions ?? 0,
          });

          if (completed) {
            applyCompletionStatus(topic, "completed");
          } else if (topic.revisionStatus === "not_started") {
            applyCompletionStatus(topic, "in_progress");
          }

          topic.actualMinutesSpent =
            (topic.actualMinutesSpent ?? topic.studyMinutes ?? 0) +
            sessionMinutes;
          topic.studyMinutes = topic.actualMinutesSpent;
          topic.lastStudiedAt = endedAt;

          if (markedDifficult) {
            topic.markedDifficult = true;
          }
          if (quizScore !== undefined) {
            topic.quizScore = quizScore;
          }

          const analyzed = adaptTopicAfterSession(
            {
              title: topic.name,
              difficulty: topic.initialDifficultyLevel ?? topic.difficulty,
              subtopicCount: topic.subtopicCount,
              hierarchyDepth: topic.hierarchyDepth,
              baselineEstimatedMinutes: topic.baselineEstimatedMinutes,
              practiceCount: topic.practiceCount,
              learningOutcomeCount: topic.learningOutcomeCount,
              estimatedMinutes: topic.estimatedMinutes,
              actualMinutesSpent: topic.actualMinutesSpent,
              revisionsCount: topic.revisionsCount,
              markedDifficult: topic.markedDifficult,
              isWeakTopic: topic.isWeakTopic,
              completed: completed ?? false,
              sessionDurationMinutes: sessionMinutes,
              difficultyScore: topic.difficultyScore,
              weakTopicScore: topic.weakTopicScore,
              quizScore: topic.quizScore,
            },
            learningFactor
          );

          applyAnalyzedToTopic(topic, analyzed, { incrementRevisions: true });

          await processStudySessionOutcome(
            {
              userId: user.clerkId,
              subjectSlug,
              subjectName: subject.subjectName,
              topicId,
              topicName: topic.name,
              durationMinutes: sessionMinutes,
              completed: completed ?? false,
              markedDifficult,
              quizScore,
              sessionStartedAt: startedAt,
              sessionEndedAt: endedAt,
            },
            topic,
            subject
          );

          syncFlatTopicToUnits(subject, topic);
          subject.progress = calculateCompletion(subject.topics);
          await subject.save();

          return NextResponse.json({ sessionId: session._id });
        }
      }
    }

    const session = await StudySession.create({
      userId: user.clerkId,
      subjectId,
      topicId,
      topicName,
      duration: duration ?? 0,
      completedAt: completed ? new Date() : undefined,
      notesGenerated,
      pomodoroSessions: pomodoroSessions ?? 0,
    });

    return NextResponse.json({ sessionId: session._id });
  } catch {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
