import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { getOrCreateUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import { calculateCompletion, formatDuration } from "@/lib/utils";
import {
  buildUnitViews,
  buildUnitsDocumentFromTopics,
  serializeUnitViews,
  unitsAreInSync,
} from "@/lib/unit-helpers";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteSubjectButton } from "@/components/subjects/delete-subject-button";
import { ExpandableUnitCard } from "@/components/subjects/expandable-unit-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ subject: string }>;
}

export default async function SubjectDetailPage({ params }: Props) {
  const { subject: slug } = await params;
  const user = await getOrCreateUser();
  if (!user) return null;

  await connectDB();
  const subject = await Subject.findOne({
    userId: user.clerkId,
    slug,
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

  const unitViews = serializeUnitViews(
    buildUnitViews(subject.units, subject.topics)
  );
  const progress = calculateCompletion(subject.topics);
  const weakTopics = subject.topics.filter((t) => t.isWeakTopic && !t.completed);
  const nextTopic =
    subject.topics.find((t) => !t.completed && t.revisionStatus === "in_progress") ??
    subject.topics.find((t) => !t.completed);

  const mainTopicCount = subject.topics.length;
  const totalSubtopics = subject.topics.reduce(
    (sum, t) => sum + (t.subtopicsList?.length ?? Math.max(1, t.subtopicCount ?? 1)),
    0
  );
  const unitCount = unitViews.length;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2 mb-4 text-muted-foreground hover:text-foreground"
        asChild
      >
        <Link href="/subjects">
          <ArrowLeft className="h-4 w-4" />
          Back to Subjects
        </Link>
      </Button>

      <PageHeader
        title={subject.subjectName}
        description={
          unitCount > 0
            ? `${unitCount} unit${unitCount === 1 ? "" : "s"} · ${mainTopicCount} topics · ${totalSubtopics} subtopics · ${progress}% complete`
            : `${mainTopicCount} topics · ${progress}% complete`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DeleteSubjectButton slug={slug} subjectName={subject.subjectName} />
            {nextTopic && (
              <Button variant="gradient" asChild>
                <Link
                  href={`/study/${nextTopic.slug}?subject=${slug}&topicId=${nextTopic._id?.toString()}`}
                >
                  Continue Study
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <Card className="glass mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Overall Progress</span>
            <span className="font-bold text-lg">{progress}%</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      {weakTopics.length > 0 && (
        <Card className="glass border-amber-500/30 mb-6">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <p className="text-sm">
              <span className="font-medium text-amber-400">Weak areas: </span>
              {weakTopics.map((t) => t.name).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {unitViews.length > 0 ? (
        <>
          <h2 className="text-lg font-semibold mb-4">Units</h2>
          <div className="space-y-4">
            {unitViews.map((unit) => (
              <ExpandableUnitCard key={unit.slug} unit={unit} subjectSlug={slug} />
            ))}
          </div>
        </>
      ) : subject.topics.length > 0 ? (
        <>
          <h2 className="text-lg font-semibold mb-4">Topics</h2>
          <div className="space-y-3">
            {subject.topics.map((topic) => (
              <Card
                key={topic._id?.toString()}
                className="glass hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{topic.name}</h3>
                      {topic.completed && <Badge variant="success">Done</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{topic.difficulty}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(getTopicEstimatedMinutes(topic))}
                      </span>
                    </div>
                  </div>
                  {!topic.completed && (
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/study/${topic.slug}?subject=${slug}&topicId=${topic._id?.toString()}`}
                      >
                        Study
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No topics yet. Upload a syllabus to get started.</p>
      )}
    </div>
  );
}
