import { notFound } from "next/navigation";

import { getOrCreateUser } from "@/lib/auth";

import { connectDB } from "@/lib/db";

import { Subject } from "@/models/Subject";

import { Progress } from "@/models/Progress";

import { StudySession } from "@/components/study/study-session";

import {

  calculateAdaptiveStudyTime,

  getPomodoroSessionMinutes,

  profileFromProgress,

} from "@/lib/adaptive-study-time";

import {

  formatStructuredContentForAi,

  resolveStructuredContent,

} from "@/lib/structured-learning-content";

import { findNextStudyTopic } from "@/lib/study-navigation";
import { buildStudySessionContext } from "@/lib/study-session-context";



interface Props {

  params: Promise<{ topic: string }>;

  searchParams: Promise<{ subject?: string; topicId?: string }>;

}



export default async function StudyPage({ params, searchParams }: Props) {

  const { topic: topicSlug } = await params;

  const { subject: subjectSlug, topicId } = await searchParams;



  if (!subjectSlug || !topicId) notFound();



  const user = await getOrCreateUser();

  if (!user) return null;



  await connectDB();

  const [subject, progressDoc] = await Promise.all([

    Subject.findOne({

      userId: user.clerkId,

      slug: subjectSlug,

    }).lean(),

    Progress.findOne({ userId: user.clerkId }).lean(),

  ]);



  if (!subject) notFound();



  const topic = subject.topics.find(

    (t) => t._id?.toString() === topicId || t.slug === topicSlug

  );



  if (!topic) notFound();



  const learningFactor = profileFromProgress(progressDoc).learningFactor;



  const adaptive = calculateAdaptiveStudyTime({

    title: topic.name,

    difficulty: topic.initialDifficultyLevel ?? topic.difficulty,

    subtopicCount: topic.subtopicCount,

    hierarchyDepth: topic.hierarchyDepth,

    baselineEstimatedMinutes: topic.baselineEstimatedMinutes,

    practiceCount: topic.practiceCount,

    learningOutcomeCount: topic.learningOutcomeCount,

    markedDifficult: topic.markedDifficult,

    isWeakTopic: topic.isWeakTopic,

    actualMinutesSpent: topic.actualMinutesSpent ?? topic.studyMinutes,

    revisionsCount: topic.revisionsCount,

    difficultyScore: topic.difficultyScore,

    weakTopicScore: topic.weakTopicScore,

    quizScore: topic.quizScore,

    learningFactor,

  });



  const sessionFocusMinutes = getPomodoroSessionMinutes(

    adaptive.estimatedMinutes,

    adaptive.recommendedPomodoros

  );



  const structuredContent = resolveStructuredContent(

    {

      name: topic.name,

      unitTitle: topic.unitTitle,

      parentTopicTitle: topic.parentTopicTitle,

      overview: topic.overview,

      subtopicsList: topic.subtopicsList,

      keywords: topic.keywords,

      learningObjectives: topic.learningObjectives,

      studyBlocks: topic.studyBlocks,

      estimatedMinutes: adaptive.estimatedMinutes,

      content: topic.content,

    },

    subject.subjectName

  );



  const aiContext = formatStructuredContentForAi(structuredContent, topic.name);

  const nextTopic = findNextStudyTopic(subject.topics, topicId);

  const studyContext = buildStudySessionContext({
    subjectName: subject.subjectName,
    topic,
    allTopics: subject.topics,
    subtopics: structuredContent.subtopics,
    subtopicProgress: topic.subtopicProgress ?? [],
  });

  const clientSubtopicProgress = (topic.subtopicProgress ?? []).map(
    ({ title, completed, skipped, passed, quizScore }) => ({
      title,
      completed: completed ?? false,
      skipped,
      passed,
      quizScore,
    })
  );

  return (
    <StudySession
      topicName={topic.name}
      topicSlug={topic.slug}
      subjectSlug={subjectSlug}
      subjectName={subject.subjectName}
      topicId={topicId}
      subjectId={subject._id.toString()}
      unitTitle={topic.unitTitle}
      parentTopicTitle={topic.parentTopicTitle}
      difficulty={topic.difficulty}
      aiContext={aiContext}
      structuredContent={structuredContent}
      estimatedMinutes={adaptive.estimatedMinutes}
      recommendedPomodoros={adaptive.recommendedPomodoros}
      sessionFocusMinutes={sessionFocusMinutes}
      subtopicCount={adaptive.subtopicCount}
      practiceCount={adaptive.practiceCount}
      completed={topic.completed}
      completionStatus={topic.completionStatus}
      initialSubtopicProgress={clientSubtopicProgress}
      nextTopic={nextTopic}
      studyContext={studyContext}
    />
  );
}


