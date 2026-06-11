import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      name: user.name,
      goal: user.goal,
      studyTime: user.studyTime,
      streak: user.streak,
      examDate: user.examDate,
      learningSpeed: user.learningSpeed,
      weakSubjects: user.weakSubjects,
      onboardingCompleted: user.onboardingCompleted,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
