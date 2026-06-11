import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Circle,
  Flame,
  Focus,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { subDays } from "date-fns";
import { getOrCreateUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import { getAIRecommendations } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Progress as ProgressModel } from "@/models/Progress";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";
import { formatDuration } from "@/lib/utils";
import {
  buildAdaptiveStudyPlan,
  pickContinueTopic,
  sortPendingTopics,
} from "@/lib/adaptive-study-plan-engine";
import {
  buildDailyPlanSummary,
  getTodaysRevisionQueue,
  averageMasteryScore,
} from "@/lib/daily-planner";
import { calculateExamReadiness } from "@/lib/learning-engine";
import { masteryLabel } from "@/lib/mastery-engine";
import { DonutProgress } from "@/components/dashboard/donut-progress";
import { ExamReadinessGauge } from "@/components/dashboard/exam-readiness-gauge";
import { WeeklyActivityChart } from "@/components/dashboard/weekly-activity-chart";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function findTopicMeta(
  subjects: Array<{ slug: string; subjectName: string; topics: Array<{ name: string; slug: string; difficulty: string; _id?: { toString(): string } }> }>,
  topicName: string
) {
  for (const s of subjects) {
    const t = s.topics.find((x) => x.name === topicName);
    if (t) {
      return {
        subjectSlug: s.slug,
        subjectName: s.subjectName,
        topicSlug: t.slug,
        topicId: t._id?.toString() ?? "",
        difficulty: t.difficulty,
      };
    }
  }
  return null;
}

export default async function DashboardPage() {
  const user = await getOrCreateUser();
  if (!user) return null;

  await connectDB();

  const [subjects, progressDoc] = await Promise.all([
    Subject.find({ userId: user.clerkId }).sort({ updatedAt: -1 }).lean(),
    ProgressModel.findOne({ userId: user.clerkId }).lean(),
  ]);

  const allTopics = subjects.flatMap((s) => s.topics);
  const completed = allTopics.filter((t) => t.completed);
  const inProgress = allTopics.filter(
    (t) => !t.completed && t.completionStatus === "in_progress"
  );
  const pending = sortPendingTopics(
    allTopics.filter((t) => !t.completed),
    progressDoc
  );
  const todayTarget = user.studyTime ?? 60;
  const learningFactor =
    progressDoc?.learningFactor ?? progressDoc?.learningPaceMultiplier ?? 1;

  const continueTopic = pickContinueTopic(subjects, progressDoc);

  const chartData =
    progressDoc?.dailyLog?.slice(-7).map((d) => ({
      date: d.date,
      minutes: d.minutes,
    })) ?? [];

  const plan = buildAdaptiveStudyPlan(user, subjects, progressDoc);
  const todayPlan = plan[0];
  const tomorrowPlan = plan[1];

  const recommendations = await getAIRecommendations({
    weakSubjects: user.weakSubjects ?? [],
    pendingTopics: pending.length,
    streak: progressDoc?.streak ?? user.streak,
    examDate: user.examDate,
    subjects: subjects.map((s) => ({
      slug: s.slug,
      subjectName: s.subjectName,
      topics: s.topics,
    })),
    progress: progressDoc,
  });

  const todaysRevision = getTodaysRevisionQueue(
    subjects.map((s) => ({
      slug: s.slug,
      subjectName: s.subjectName,
      topics: s.topics,
    }))
  );

  const dailySummary = buildDailyPlanSummary({
    subjects: subjects.map((s) => ({
      slug: s.slug,
      subjectName: s.subjectName,
      topics: s.topics,
    })),
    revisionQueue: progressDoc?.revisionQueue,
    dailyStudyMinutes: todayTarget,
  });

  const completionRate =
    allTopics.length > 0
      ? Math.round((completed.length / allTopics.length) * 100)
      : 0;

  const examReadiness = calculateExamReadiness({
    completionRate,
    averageQuizScore: progressDoc?.averageQuizScore ?? 0,
    learningFactor,
    weakTopicCount: allTopics.filter((t) => t.isWeakTopic).length,
    totalTopics: allTopics.length,
  });

  const avgMastery = averageMasteryScore(allTopics);
  const weekAgo = subDays(new Date(), 7);
  const completedThisWeek = allTopics.filter(
    (t) =>
      t.completed &&
      t.lastStudiedAt &&
      new Date(t.lastStudiedAt) >= weekAgo
  ).length;

  const weakTopics = allTopics
    .filter((t) => t.isWeakTopic || (t.masteryScore ?? 0) < 50)
    .slice(0, 5);

  const continueMastery = continueTopic?.topic.masteryScore ?? 0;
  const continueSubtopics = continueTopic?.topic.subtopicsList ?? [];
  const continueDone =
    continueTopic?.topic.subtopicProgress?.filter((p) => p.completed).length ??
    0;
  const nextSubtopic = continueSubtopics.find(
    (s) =>
      !continueTopic?.topic.subtopicProgress?.some(
        (p) =>
          p.title.toLowerCase() === s.toLowerCase() &&
          (p.completed || p.skipped)
      )
  );

  const todayMinutesStudied =
    progressDoc?.dailyLog?.slice(-1)[0]?.minutes ?? 0;

  const quickActions = [
    { href: "/progress", label: "Study Plan", icon: Calendar },
    { href: "/exam-survival", label: "Exam Survival", icon: Flame },
    { href: "/focus", label: "Focus Mode", icon: Focus },
    { href: "/notes", label: "AI Notes", icon: Brain },
    { href: "/upload", label: "Upload", icon: Upload },
  ];

  const planItems = [
    ...(todayPlan?.topics ?? []).map((item) => ({
      ...item,
      ...findTopicMeta(subjects, item.name),
      isToday: true,
    })),
    ...(todaysRevision.slice(0, 2).map((r) => ({
      name: r.topicName,
      minutes: 15,
      subjectSlug: r.subjectSlug,
      subjectName: r.subjectName,
      topicSlug: r.topicSlug,
      topicId: r.topicId,
      difficulty: "medium" as const,
      isRevision: true,
    })) ?? []),
  ].slice(0, 6);

  const upcomingTopic = tomorrowPlan?.topics[0] ?? pending[1] ?? pending[0];
  const upcomingMeta = upcomingTopic
    ? "name" in upcomingTopic
      ? findTopicMeta(subjects, upcomingTopic.name)
      : null
    : null;

  return (
    <div className="w-full max-w-[1520px] mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {user.name.split(" ")[0]}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user.goal ?? "Your personalized learning dashboard"}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/focus">
            <Focus className="h-4 w-4 mr-2" />
            Focus Music
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Study Streak",
            value: `${progressDoc?.streak ?? user.streak}`,
            sub: "days",
            icon: Flame,
            accent: "text-orange-400",
          },
          {
            label: "Today's Target",
            value: `${todayTarget}`,
            sub: "min",
            icon: Target,
            accent: "text-primary",
          },
          {
            label: "Topics Done",
            value: `${completedThisWeek}/${allTopics.length}`,
            sub: "this week",
            icon: CheckCircle2,
            accent: "text-emerald-400",
          },
          {
            label: "Level",
            value: `Lv.${progressDoc?.level ?? 1}`,
            sub: `${progressDoc?.xp ?? 0} XP`,
            icon: Zap,
            accent: "text-violet-400",
          },
          {
            label: "Mastery",
            value: `${avgMastery}%`,
            sub: "avg score",
            icon: Trophy,
            accent: "text-amber-400",
          },
        ].map((stat) => (
          <Card key={stat.label} className="glass border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg bg-secondary/60 p-2 ${stat.accent}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">
                  {stat.label}
                </p>
                <p className="text-lg font-bold leading-tight">
                  {stat.value}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {stat.sub}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-5">
        {/* Main column */}
        <div className="space-y-5 min-w-0">
          {/* Continue Learning hero */}
          <Card className="glass border-primary/30 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row">
                <div className="flex-1 p-5 lg:p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Continue Learning
                  </div>
                  {continueTopic ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {continueTopic.subjectName}
                        </p>
                        <h2 className="text-xl font-bold mt-0.5">
                          {continueTopic.topic.name}
                        </h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">{continueTopic.topic.difficulty}</Badge>
                        {continueMastery > 0 && (
                          <Badge variant="outline">
                            Mastery: {continueMastery}% (
                            {masteryLabel(continueMastery)})
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {continueSubtopics.length > 0
                              ? `${continueDone}/${continueSubtopics.length} subtopics`
                              : `${continueMastery || 0}%`}
                          </span>
                        </div>
                        <Progress
                          value={
                            continueSubtopics.length > 0
                              ? Math.round(
                                  (continueDone / continueSubtopics.length) * 100
                                )
                              : continueMastery
                          }
                          className="h-2"
                        />
                      </div>
                      {nextSubtopic && (
                        <p className="text-xs text-muted-foreground">
                          Next up:{" "}
                          <span className="text-foreground font-medium">
                            {nextSubtopic}
                          </span>
                          {continueSubtopics.length > 0 && (
                            <>
                              {" "}
                              · Subtopic {continueDone + 1} of{" "}
                              {continueSubtopics.length}
                            </>
                          )}
                          {" · "}
                          Est.{" "}
                          {formatDuration(
                            getTopicEstimatedMinutes(continueTopic.topic)
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload a syllabus to start your adaptive study journey.
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center p-5 lg:p-6 lg:border-l border-border/50 bg-primary/5 lg:min-w-[200px]">
                  {continueTopic ? (
                    <Button variant="gradient" size="lg" className="w-full lg:w-auto" asChild>
                      <Link
                        href={`/study/${continueTopic.topic.slug}?subject=${continueTopic.subjectSlug}&topicId=${continueTopic.topic._id}`}
                      >
                        Resume Study
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="gradient" asChild>
                      <Link href="/upload">Upload Syllabus</Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-5 gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors text-center"
              >
                <action.icon className="h-5 w-5 text-primary" />
                <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Plan + activity */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Card className="glass border-border/60">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Today&apos;s Study Plan
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {todayPlan?.totalMinutes ?? dailySummary.estimatedMinutes} min
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                {planItems.length > 0 ? (
                  planItems.map((item, i) => {
                    const meta =
                      "subjectSlug" in item && item.subjectSlug
                        ? item
                        : findTopicMeta(subjects, item.name);
                    const href =
                      meta?.topicSlug && meta?.subjectSlug && meta?.topicId
                        ? `/study/${meta.topicSlug}?subject=${meta.subjectSlug}&topicId=${meta.topicId}`
                        : null;
                    return (
                      <div
                        key={`${item.name}-${i}`}
                        className="flex items-center gap-3 rounded-lg border border-border/40 p-3 hover:border-primary/20 transition-colors"
                      >
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              {item.minutes} min
                            </span>
                            {meta?.difficulty && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                {meta.difficulty}
                              </Badge>
                            )}
                            {"isRevision" in item && item.isRevision && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                Revision
                              </Badge>
                            )}
                          </div>
                        </div>
                        {href && (
                          <Button variant="ghost" size="sm" className="shrink-0 h-8" asChild>
                            <Link href={href}>Start</Link>
                          </Button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {pending.length === 0 ? "All caught up!" : "No plan for today yet."}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              {upcomingTopic && upcomingMeta && (
                <Card className="glass border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Upcoming
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {"name" in upcomingTopic ? upcomingTopic.name : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {upcomingMeta.subjectName} · Tomorrow
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/study/${upcomingMeta.topicSlug}?subject=${upcomingMeta.subjectSlug}&topicId=${upcomingMeta.topicId}`}
                        >
                          Preview
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <WeeklyActivityChart
                data={
                  chartData.length
                    ? chartData
                    : [
                        { date: new Date().toISOString(), minutes: 0 },
                      ]
                }
              />
            </div>
          </div>

          {/* Subjects strip */}
          {subjects.length > 0 && (
            <Card className="glass border-border/60">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Your Subjects</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                  <Link href="/subjects">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {subjects.slice(0, 3).map((s) => {
                  const pct =
                    Math.round(
                      (s.topics.filter((t) => t.completed).length /
                        s.topics.length) *
                        100
                    ) || 0;
                  return (
                    <Link
                      key={s._id.toString()}
                      href={`/subjects/${s.slug}`}
                      className="rounded-xl border border-border/50 p-4 hover:border-primary/40 transition-colors"
                    >
                      <p className="font-medium text-sm truncate">{s.subjectName}</p>
                      <Progress value={pct} className="mt-2 h-1.5" />
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {pct}% complete
                      </p>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="glass border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DonutProgress value={completionRate} label="Complete" />
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="font-bold text-emerald-400">{completed.length}</p>
                  <p className="text-muted-foreground">Done</p>
                </div>
                <div>
                  <p className="font-bold text-primary">{inProgress.length}</p>
                  <p className="text-muted-foreground">Active</p>
                </div>
                <div>
                  <p className="font-bold">{pending.length}</p>
                  <p className="text-muted-foreground">Left</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Study time today: {todayMinutesStudied} min
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Exam Readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <ExamReadinessGauge score={examReadiness} />
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Weak Topics</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/progress">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {weakTopics.length > 0 ? (
                weakTopics.map((t) => {
                  const subj = subjects.find((s) =>
                    s.topics.some((x) => x.name === t.name)
                  );
                  return (
                    <div key={t.slug} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate font-medium">{t.name}</span>
                        <span className="text-red-400 shrink-0 ml-2">
                          {t.masteryScore ?? 0}%
                        </span>
                      </div>
                      <Progress
                        value={t.masteryScore ?? 0}
                        className="h-1.5 [&>div]:bg-red-500/70"
                      />
                      {subj && (
                        <p className="text-[10px] text-muted-foreground">
                          {subj.subjectName}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No weak areas flagged.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommendations.slice(0, 3).map((rec, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-secondary/40 p-3 text-xs leading-relaxed"
                >
                  {rec}
                </div>
              ))}
              {todaysRevision.length > 0 && (
                <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                  <Link href="/exam-survival">Go to Revision Queue</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
