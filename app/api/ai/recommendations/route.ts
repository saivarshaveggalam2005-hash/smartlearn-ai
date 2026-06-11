import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Subject } from "@/models/Subject";
import { Progress } from "@/models/Progress";
import { getAIRecommendations } from "@/lib/ai";

export async function GET() {
  try {
    const user = await requireUser();
    await connectDB();

    const subjects = await Subject.find({ userId: user.clerkId }).lean();
    const progress = await Progress.findOne({ userId: user.clerkId }).lean();
    const pending = subjects.reduce(
      (sum, s) => sum + s.topics.filter((t) => !t.completed).length,
      0
    );

    const recommendations = await getAIRecommendations({
      weakSubjects: user.weakSubjects ?? [],
      pendingTopics: pending,
      streak: progress?.streak ?? user.streak,
      examDate: user.examDate,
      subjects: subjects.map((s) => ({
        slug: s.slug,
        subjectName: s.subjectName,
        topics: s.topics,
      })),
      progress,
    });

    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
