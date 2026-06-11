import { getOrCreateUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";
import type { SurvivalTopicInput } from "@/lib/exam-survival";
import { PageHeader } from "@/components/layout/page-header";
import { ExamSurvivalPlanner } from "@/components/exam-survival/exam-survival-planner";

export const dynamic = "force-dynamic";

export default async function ExamSurvivalPage() {
  const user = await getOrCreateUser();
  if (!user) return null;

  await connectDB();
  const subjects = await Subject.find({ userId: user.clerkId }).lean();

  const topics: SurvivalTopicInput[] = subjects.flatMap((subject) =>
    subject.topics.map((topic) => ({
      id: topic._id?.toString() ?? topic.slug,
      slug: topic.slug,
      name: topic.name,
      subjectSlug: subject.slug,
      subjectName: subject.subjectName,
      completed: topic.completed,
      isWeakTopic: topic.isWeakTopic,
      masteryScore: topic.masteryScore,
      estimatedMinutes: getTopicEstimatedMinutes(topic),
      nextReviewAt: topic.nextReviewAt,
      inRevisionQueue: topic.inRevisionQueue,
    }))
  );

  return (
    <div>
      <PageHeader
        title="Exam Survival Mode"
        description="Adaptive crash plan for last-minute revision — weak areas first"
      />
      <ExamSurvivalPlanner topics={topics} />
    </div>
  );
}
