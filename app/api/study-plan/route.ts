import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";

import { requireUser } from "@/lib/auth";

import { Subject } from "@/models/Subject";

import { Progress } from "@/models/Progress";

import { buildAdaptiveStudyPlan } from "@/lib/adaptive-study-plan-engine";



export async function GET() {

  try {

    const user = await requireUser();

    await connectDB();



    const [subjects, progress] = await Promise.all([

      Subject.find({ userId: user.clerkId }).lean(),

      Progress.findOne({ userId: user.clerkId }).lean(),

    ]);



    const plan = buildAdaptiveStudyPlan(user, subjects, progress);



    return NextResponse.json({

      plan,

      revisionQueue: progress?.revisionQueue ?? [],

      learningPaceMultiplier: progress?.learningPaceMultiplier ?? 1,

      streak: progress?.streak ?? user.streak,

      completedStudyHours: progress?.completedStudyHours ?? 0,

    });

  } catch {

    return NextResponse.json({ error: "Failed" }, { status: 500 });

  }

}

