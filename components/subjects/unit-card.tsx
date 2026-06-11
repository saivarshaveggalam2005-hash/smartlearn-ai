import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import type { UnitViewModel } from "@/lib/unit-helpers";
import { formatDuration } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UnitCardProps {
  unit: UnitViewModel;
  subjectSlug: string;
}

export function UnitCard({ unit, subjectSlug }: UnitCardProps) {
  const studyHref =
    unit.nextTopic &&
    `/study/${unit.nextTopic.slug}?subject=${subjectSlug}&topicId=${unit.nextTopic._id}`;

  return (
    <Card className="glass hover:border-primary/30 transition-colors">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            {unit.unitLabel && (
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {unit.unitLabel}
              </p>
            )}
            <h3 className="text-lg font-semibold">{unit.title}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {unit.subtopicCount} subtopic{unit.subtopicCount === 1 ? "" : "s"}
              {unit.completedCount > 0 && (
                <span> · {unit.completedCount} completed</span>
              )}
            </p>
          </div>
          <Badge variant="outline" className="capitalize shrink-0">
            {unit.difficulty}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatDuration(unit.estimatedMinutes)}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{unit.progress}%</span>
          </div>
          <Progress value={unit.progress} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {studyHref && unit.progress < 100 && (
            <Button size="sm" variant="gradient" asChild>
              <Link href={studyHref}>
                Continue Study
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/subjects/${subjectSlug}/unit/${unit.slug}`}>
              View Details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
