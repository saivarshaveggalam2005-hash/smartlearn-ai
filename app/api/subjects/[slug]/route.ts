import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Subject } from "@/models/Subject";
import { StudySession } from "@/models/StudySession";
import { Progress } from "@/models/Progress";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const user = await requireUser();
    const { slug } = await params;

    await connectDB();

    const subject = await Subject.findOne({
      userId: user.clerkId,
      slug,
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const subjectId = subject._id.toString();
    const topicIds = subject.topics
      .map((topic) => topic._id?.toString())
      .filter((id): id is string => Boolean(id));

    await Subject.deleteOne({ _id: subject._id });

    await StudySession.deleteMany({
      userId: user.clerkId,
      subjectId,
    });

    await Progress.updateOne(
      { userId: user.clerkId },
      {
        $pull: {
          revisionQueue: { subjectSlug: slug },
          completedTopics: { $in: topicIds },
          weakTopics: { $in: topicIds },
          strongTopics: { $in: topicIds },
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete subject error:", error);
    return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}
