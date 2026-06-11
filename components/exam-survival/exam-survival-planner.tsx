"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Flame, ArrowRight } from "lucide-react";
import {
  buildExamSurvivalPlan,
  type SurvivalTopicInput,
} from "@/lib/exam-survival";
import { formatDuration } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ExamSurvivalPlannerProps {
  topics: SurvivalTopicInput[];
}

const REASON_LABEL = {
  weak: "Weak area",
  revision: "Revision due",
  unfinished: "Unfinished",
  review: "Review",
} as const;

export function ExamSurvivalPlanner({ topics }: ExamSurvivalPlannerProps) {
  const [hours, setHours] = useState(2);

  const plan = useMemo(
    () => buildExamSurvivalPlan({ hoursAvailable: hours, topics }),
    [hours, topics]
  );

  return (
    <div className="space-y-6">
      <Card className="glass border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-400" />
            Exam Tomorrow — Crash Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Prioritizes weak areas, unfinished topics, and revision due items.
            Works for any subject dynamically.
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 6].map((h) => (
              <Button
                key={h}
                size="sm"
                variant={hours === h ? "default" : "outline"}
                onClick={() => setHours(h)}
              >
                {h}h
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Time budget</p>
              <p className="text-xl font-bold">{formatDuration(plan.totalMinutes)}</p>
            </div>
            <div className="rounded-lg bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Coverage</p>
              <p className="text-xl font-bold">{plan.estimatedCoverage}%</p>
              <Progress value={plan.estimatedCoverage} className="mt-2 h-1.5" />
            </div>
            <div className="rounded-lg bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Sessions</p>
              <p className="text-xl font-bold">{plan.blocks.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {plan.weakAreasIncluded.length > 0 && (
        <Card className="glass border-rose-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Weak areas in this plan</p>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.weakAreasIncluded.join(" · ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Your Crash Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Upload syllabi and study some topics to generate a crash plan.
            </p>
          ) : (
            plan.blocks.map((block, i) => (
              <div
                key={`${block.topicId}-${i}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/50 p-4"
              >
                <div>
                  <p className="font-medium">{block.topicName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {block.subjectName} · {formatDuration(block.minutes)}
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {REASON_LABEL[block.reason]}
                  </Badge>
                </div>
                <Button size="sm" variant="gradient" asChild>
                  <Link href={block.studyHref}>
                    Study
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Tip: After each block, mark topics complete and run a quick quiz to boost mastery.
      </p>
    </div>
  );
}
