import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import { getOrCreateUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import {
  buildUnitViews,
  buildUnitsDocumentFromTopics,
  findUnitView,
  unitsAreInSync,
} from "@/lib/unit-helpers";
import { formatDuration } from "@/lib/utils";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ subject: string; unitId: string }>;
}

export const dynamic = "force-dynamic";

export default async function UnitDetailPage({ params }: Props) {
  const { subject: subjectSlug, unitId } = await params;
  const user = await getOrCreateUser();
  if (!user) return null;

  await connectDB();
  const subject = await Subject.findOne({
    userId: user.clerkId,
    slug: subjectSlug,
  }).lean();

  if (!subject) notFound();

  if (!unitsAreInSync(subject.units, subject.topics)) {
    const syncedUnits = buildUnitsDocumentFromTopics(subject.topics, subject.units);
    await Subject.updateOne(
      { _id: subject._id },
      { $set: { units: syncedUnits } }
    );
    subject.units = syncedUnits;
  }

  const unitViews = buildUnitViews(subject.units, subject.topics);
  const unit = findUnitView(unitViews, unitId);
  if (!unit) notFound();

  const nextTopic = unit.nextTopic;
  const studyHref =
    nextTopic &&
    `/study/${nextTopic.slug}?subject=${subjectSlug}&topicId=${nextTopic._id}`;

  return (
    <div>
      <PageHeader
        title={unit.title}
        description={
          unit.unitLabel
            ? `${unit.unitLabel} · ${unit.mainTopicCount} topics · ${unit.subtopicCount} subtopics`
            : `${unit.mainTopicCount} topics · ${unit.subtopicCount} subtopics`
        }
        action={
          studyHref && unit.progress < 100 ? (
            <Button variant="gradient" asChild>
              <Link href={studyHref}>
                Continue Study
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
        <Link href={`/subjects/${subjectSlug}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to {subject.subjectName}
        </Link>
      </Button>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Progress</p>
            <p className="text-2xl font-bold">{unit.progress}%</p>
            <Progress value={unit.progress} className="mt-3" />
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Estimated Time</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              {formatDuration(unit.estimatedMinutes)}
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Difficulty</p>
            <Badge variant="outline" className="capitalize text-base px-3 py-1">
              {unit.difficulty}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">Main Topics</h2>
      <div className="space-y-3">
        {unit.topics.map((topic) => {
          const href = `/study/${topic.slug}?subject=${subjectSlug}&topicId=${topic._id}`;
          return (
            <Card
              key={topic._id?.toString()}
              className="glass hover:border-primary/20 transition-colors"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {topic.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`font-medium ${
                          topic.completed ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {topic.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="capitalize">
                          {topic.difficulty}
                        </Badge>
                        <span>{formatDuration(getTopicEstimatedMinutes(topic))}</span>
                        {(topic.subtopicsList?.length ?? 0) > 0 && (
                          <span>
                            {topic.subtopicsList!.length} subtopic
                            {topic.subtopicsList!.length === 1 ? "" : "s"}
                          </span>
                        )}
                        {topic.isWeakTopic && (
                          <Badge variant="destructive" className="text-[10px]">
                            Weak area
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {!topic.completed && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={href}>
                        Study
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
                {(topic.subtopicsList?.length ?? 0) > 0 && (
                  <div className="pl-8 border-l border-border/40 ml-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Subtopics
                    </p>
                    <ul className="space-y-1.5">
                      {topic.subtopicsList!.map((sub) => (
                        <li
                          key={sub}
                          className="text-sm text-muted-foreground flex items-center gap-2"
                        >
                          <Circle className="h-3 w-3 shrink-0" />
                          {sub}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
