"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Clock } from "lucide-react";
import type { SerializableUnitView } from "@/lib/unit-helpers";
import { formatDuration } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ExpandableUnitCardProps {
  unit: SerializableUnitView;
  subjectSlug: string;
}

export function ExpandableUnitCard({ unit, subjectSlug }: ExpandableUnitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const studyHref =
    unit.nextTopic &&
    `/study/${unit.nextTopic.slug}?subject=${subjectSlug}&topicId=${unit.nextTopic.id}`;

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
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-2 text-left group"
            >
              <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                {unit.title}
              </h3>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {unit.mainTopicCount} main topic{unit.mainTopicCount === 1 ? "" : "s"}
              </span>
              <span>
                {unit.subtopicCount} subtopic{unit.subtopicCount === 1 ? "" : "s"}
              </span>
              {unit.completedCount > 0 && (
                <span>· {unit.completedCount} completed</span>
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

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {unit.topics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-lg border border-border/40 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{topic.name}</p>
                  {topic.completed && (
                    <Badge variant="success" className="text-[10px]">
                      Done
                    </Badge>
                  )}
                </div>
                {(topic.subtopicsList?.length ?? 0) > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 pl-3 list-disc">
                    {topic.subtopicsList!.map((sub) => (
                      <li key={sub}>{sub}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {studyHref && unit.progress < 100 && (
            <Button size="sm" variant="gradient" asChild>
              <Link href={studyHref}>
                Continue Learning
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/subjects/${subjectSlug}/unit/${unit.slug}`}>
              View Unit
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
