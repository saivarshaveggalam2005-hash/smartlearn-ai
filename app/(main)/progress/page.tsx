import { getOrCreateUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import { Progress as ProgressModel } from "@/models/Progress";
import { StudySession } from "@/models/StudySession";
import { buildAdaptiveStudyPlan } from "@/lib/adaptive-study-plan-engine";
import {
  averageMasteryScore,
  getTodaysRevisionQueue,
  learningSpeedLabel,
} from "@/lib/daily-planner";
import { calculateSubjectConfidence } from "@/lib/confidence-engine";
import { MasteryTrendChart } from "@/components/dashboard/mastery-trend-chart";
import { calculateMasteryScore } from "@/lib/mastery-engine";
import { calculateExamReadiness } from "@/lib/learning-engine";
import { engagementLabel } from "@/lib/engagement";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProgressPage() {
  const user = await getOrCreateUser();
  if (!user) return null;

  await connectDB();

  const [subjects, progress, sessions] = await Promise.all([
    Subject.find({ userId: user.clerkId }).lean(),
    ProgressModel.findOne({ userId: user.clerkId }).lean(),
    StudySession.find({ userId: user.clerkId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const allTopics = subjects.flatMap((s) => s.topics);
  const completed = allTopics.filter((t) => t.completed);
  const completionRate =
    allTopics.length > 0
      ? Math.round((completed.length / allTopics.length) * 100)
      : 0;
  const learningFactor =
    progress?.learningFactor ?? progress?.learningPaceMultiplier ?? 1;
  const examReadiness = calculateExamReadiness({
    completionRate,
    averageQuizScore: progress?.averageQuizScore ?? 0,
    learningFactor,
    weakTopicCount: allTopics.filter((t) => t.isWeakTopic).length,
    totalTopics: allTopics.length,
  });
  const todaysRevision = getTodaysRevisionQueue(
    subjects.map((s) => ({
      slug: s.slug,
      subjectName: s.subjectName,
      topics: s.topics,
    }))
  );

  const chartData =
    progress?.dailyLog?.slice(-14).map((d) => ({
      date: d.date,
      minutes: d.minutes,
    })) ?? [];

  const plan = buildAdaptiveStudyPlan(user, subjects, progress);

  const masteryChartData = allTopics
    .filter((t) => t.completed || (t.masteryScore ?? 0) > 0)
    .map((t) => ({
      name: t.name,
      mastery:
        t.masteryScore ??
        calculateMasteryScore({
          quizScore: t.quizScore,
          subtopicProgress: t.subtopicProgress,
          completed: t.completed,
          revisionsCount: t.revisionsCount,
          actualMinutesSpent: t.actualMinutesSpent ?? t.studyMinutes,
          estimatedMinutes: t.estimatedMinutes,
        }),
    }))
    .sort((a, b) => a.mastery - b.mastery);

  const subjectConfidences = subjects.map((s) => ({
    name: s.subjectName,
    ...calculateSubjectConfidence(
      s.subjectName,
      s.topics.map((t) => ({
        name: t.name,
        completed: t.completed,
        masteryScore: t.masteryScore,
        quizScore: t.quizScore,
        isWeakTopic: t.isWeakTopic,
        revisionsCount: t.revisionsCount,
      }))
    ),
  }));

  const weakTopicsList = allTopics.filter((t) => t.isWeakTopic).map((t) => t.name);

  return (
    <div>
      <PageHeader
        title="Progress Analytics"
        description="Track your study performance and adaptive plan"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Streak" value={`${progress?.streak ?? user.streak} days`} iconName="flame" />
        <StatCard
          title="Exam Readiness"
          value={`${examReadiness}%`}
          iconName="target"
        />
        <StatCard
          title="Avg Mastery"
          value={`${averageMasteryScore(allTopics)}%`}
          iconName="check"
        />
        <StatCard
          title="Learning Speed"
          value={learningSpeedLabel(learningFactor)}
          subtitle={`factor ${learningFactor.toFixed(2)}`}
          iconName="trending"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          title="Study Hours"
          value={
            progress?.completedStudyHours ??
            Math.round((user.totalStudyMinutes / 60) * 10) / 10
          }
          iconName="clock"
        />
        <StatCard
          title="Topics Done"
          value={`${completed.length}/${allTopics.length}`}
          iconName="target"
        />
        <StatCard
          title="Level"
          value={`Lv ${progress?.level ?? 1}`}
          subtitle={engagementLabel(progress?.level ?? 1)}
          iconName="trending"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <ProgressChart data={chartData.length ? chartData : [{ date: "—", minutes: 0 }]} />
        <MasteryTrendChart data={masteryChartData} />
      </div>

      <Card className="glass mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Exam Confidence by Subject</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subjectConfidences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Upload subjects to track confidence.</p>
          ) : (
            subjectConfidences.map((s) => (
              <div
                key={s.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30"
              >
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  {s.needsImprovement.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Needs: {s.needsImprovement.slice(0, 4).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.readyForExam ? "default" : "outline"}>
                    {s.score}%
                  </Badge>
                  <Badge variant="outline">{s.label}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Weak Areas Detected</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {weakTopicsList.length > 0 ? (
            weakTopicsList.map((name) => (
              <Badge key={name} variant="outline" className="border-amber-500/40 text-amber-200">
                {name}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Weak areas appear after quizzes, low mastery, or slow completion.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Today&apos;s Revision Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaysRevision.length > 0 ? (
            todaysRevision.slice(0, 8).map((item) => (
              <div
                key={`${item.subjectSlug}-${item.topicSlug}`}
                className="flex justify-between items-center text-sm p-2 rounded-lg bg-secondary/30"
              >
                <span>
                  {item.topicName}{" "}
                  <span className="text-muted-foreground">· {item.subjectName}</span>
                </span>
                {item.masteryScore !== undefined && (
                  <Badge variant="outline">{item.masteryScore}%</Badge>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No spaced-repetition reviews due today. Complete topics to schedule reviews.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Adaptive Study Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.slice(0, 7).map((day) => (
            <div
              key={day.date}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30"
            >
              <span className="font-medium text-sm">{day.date}</span>
              <span className="text-sm text-muted-foreground">
                {day.topics.map((t) => t.name).join(" · ")}
              </span>
              <Badge variant="outline">{day.totalMinutes} min</Badge>
            </div>
          ))}
          {plan.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Upload subjects to generate your study plan
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s._id.toString()}
              className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-secondary/30"
            >
              <span>{s.topicName}</span>
              <span className="text-muted-foreground">
                {s.duration} min · {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-muted-foreground text-sm">No sessions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
