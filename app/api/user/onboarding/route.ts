import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Progress } from "@/models/Progress";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    await connectDB();

    await User.findOneAndUpdate(
      { clerkId: user.clerkId },
      {
        goal: body.goal,
        subjects: body.subjects,
        studyTime: body.studyTime,
        examDate: body.examDate ? new Date(body.examDate) : undefined,
        studyStyle: body.studyStyle,
        weakSubjects: body.weakSubjects,
        learningSpeed: body.learningSpeed,
        onboardingCompleted: true,
      }
    );

    await Progress.findOneAndUpdate(
      { userId: user.clerkId },
      { userId: user.clerkId },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
