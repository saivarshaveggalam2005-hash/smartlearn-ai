import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";

import { requireUser } from "@/lib/auth";

import { Subject } from "@/models/Subject";

import { Progress } from "@/models/Progress";

import { StudySession } from "@/models/StudySession";

import { recordStudyAnalytics } from "@/lib/adaptive-study-plan-engine";
import { calculateExamReadiness } from "@/lib/learning-engine";
import {
  averageMasteryScore,
  buildDailyPlanSummary,
  getTodaysRevisionQueue,
  learningSpeedLabel,
} from "@/lib/daily-planner";



export async function GET() {

  try {

    const user = await requireUser();

    await connectDB();



    const [subjects, progress, sessions] = await Promise.all([

      Subject.find({ userId: user.clerkId }).lean(),

      Progress.findOne({ userId: user.clerkId }).lean(),

      StudySession.find({ userId: user.clerkId })

        .sort({ createdAt: -1 })

        .limit(20)

        .lean(),

    ]);



    const allTopics = subjects.flatMap((s) => s.topics);

    const completed = allTopics.filter((t) => t.completed);

    const pending = allTopics.filter((t) => !t.completed);



    const chartData =

      progress?.dailyLog?.slice(-7).map((d) => ({

        date: d.date,

        minutes: d.minutes,

      })) ?? [];



    const completionRate =
      allTopics.length > 0
        ? Math.round((completed.length / allTopics.length) * 100)
        : 0;
    const weakTopicCount = allTopics.filter((t) => t.isWeakTopic).length;
    const learningFactor =
      progress?.learningFactor ?? progress?.learningPaceMultiplier ?? 1;
    const dailyPlan = buildDailyPlanSummary({
      subjects: subjects.map((s) => ({
        slug: s.slug,
        subjectName: s.subjectName,
        topics: s.topics,
      })),
      revisionQueue: progress?.revisionQueue,
      dailyStudyMinutes: user.studyTime ?? 60,
    });

    return NextResponse.json({

      streak: progress?.streak ?? user.streak,

      totalStudyMinutes: progress?.totalStudyMinutes ?? user.totalStudyMinutes,

      completedCount: completed.length,

      pendingCount: pending.length,

      completionRate,

      studyHours:

        progress?.completedStudyHours ??

        Math.round((user.totalStudyMinutes / 60) * 10) / 10,

      weakAreas: progress?.weakAreas ?? user.weakSubjects ?? [],

      performanceScore: progress?.performanceScore ?? 0,

      learningPaceMultiplier: progress?.learningPaceMultiplier ?? 1,

      learningFactor,

      learningSpeed: learningSpeedLabel(learningFactor),

      averageQuizScore: progress?.averageQuizScore ?? 0,

      averageMastery: averageMasteryScore(allTopics),

      weakTopics: progress?.weakTopics ?? [],

      strongTopics: progress?.strongTopics ?? [],

      xp: progress?.xp ?? 0,

      level: progress?.level ?? 1,

      examReadiness: calculateExamReadiness({

        completionRate,

        averageQuizScore: progress?.averageQuizScore ?? 0,

        learningFactor,

        weakTopicCount,

        totalTopics: allTopics.length,

      }),

      revisionQueue: progress?.revisionQueue ?? [],

      todaysRevision: getTodaysRevisionQueue(
        subjects.map((s) => ({
          slug: s.slug,
          subjectName: s.subjectName,
          topics: s.topics,
        }))
      ),

      dailyPlan,

      chartData,

      recentSessions: sessions.map((s) => ({

        topicName: s.topicName,

        duration: s.duration,

        createdAt: s.createdAt,

      })),

    });

  } catch {

    return NextResponse.json({ error: "Server error" }, { status: 500 });

  }

}



export async function POST(req: Request) {

  try {

    const user = await requireUser();

    const { minutes, topicCompleted, weakArea } = await req.json();



    await connectDB();



    const { streak, completedStudyHours } = await recordStudyAnalytics(

      user.clerkId,

      minutes ?? 0,

      {

        topicCompletedId: topicCompleted,

        weakArea,

      }

    );



    return NextResponse.json({

      success: true,

      streak,

      completedStudyHours,

    });

  } catch {

    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  }

}

