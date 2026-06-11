import Link from "next/link";
import { BookOpen, Clock, Upload } from "lucide-react";
import { getOrCreateUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";
import { calculateCompletion, formatDuration } from "@/lib/utils";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteSubjectButton } from "@/components/subjects/delete-subject-button";

export default async function SubjectsPage() {
  const user = await getOrCreateUser();
  if (!user) return null;

  await connectDB();
  const subjects = await Subject.find({ userId: user.clerkId })
    .sort({ updatedAt: -1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="Subjects"
        description="All your uploaded syllabi and extracted topics"
        action={
          <Button variant="gradient" asChild>
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Upload Syllabus
            </Link>
          </Button>
        }
      />

      {subjects.length === 0 ? (
        <Card className="glass text-center py-16">
          <CardContent>
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No subjects yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              Upload your syllabus PDF and we&apos;ll automatically extract topics
              for you.
            </p>
            <Button variant="gradient" asChild>
              <Link href="/upload">Upload Your First Syllabus</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => {
            const progress = calculateCompletion(subject.topics);
            const pending = subject.topics.filter((t) => !t.completed);
            const estMinutes = pending.reduce(
              (s, t) => s + getTopicEstimatedMinutes(t),
              0
            );

            return (
              <Card
                key={subject._id.toString()}
                className="glass h-full hover:border-primary/40 hover:glow transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={progress === 100 ? "success" : "secondary"}>
                        {progress}%
                      </Badge>
                      <DeleteSubjectButton
                        compact
                        slug={subject.slug}
                        subjectName={subject.subjectName}
                      />
                    </div>
                  </div>
                  <Link href={`/subjects/${subject.slug}`} className="block">
                    <h3 className="font-semibold text-lg mb-1">
                      {subject.subjectName}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {subject.topics.length} topics · {pending.length} pending
                    </p>
                    <Progress value={progress} className="mb-3" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      ~{formatDuration(estMinutes)} remaining
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
