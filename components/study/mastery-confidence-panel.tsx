"use client";

import { Gauge, Shield } from "lucide-react";
import { masteryLabel } from "@/lib/mastery-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export interface SubtopicMasteryView {
  title: string;
  score: number;
}

interface MasteryConfidencePanelProps {
  topicMastery: number;
  subjectConfidence: number;
  readyForExam: boolean;
  confidenceLabel: string;
  subtopicMastery: SubtopicMasteryView[];
  revisionStatus?: string;
}

export function MasteryConfidencePanel({
  topicMastery,
  subjectConfidence,
  readyForExam,
  confidenceLabel,
  subtopicMastery,
  revisionStatus,
}: MasteryConfidencePanelProps) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          Mastery & Confidence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Topic Mastery</span>
            <span className="font-semibold">
              {topicMastery}% · {masteryLabel(topicMastery)}
            </span>
          </div>
          <Progress value={topicMastery} />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Exam Confidence
            </span>
            <span className="font-semibold">{subjectConfidence}%</span>
          </div>
          <Progress value={subjectConfidence} />
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={readyForExam ? "success" : "warning"}>
              {readyForExam ? "Ready for Exam" : "Not Exam Ready"}
            </Badge>
            <Badge variant="outline">{confidenceLabel}</Badge>
          </div>
        </div>

        {subtopicMastery.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/40">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Subtopic Mastery
            </p>
            {subtopicMastery.slice(0, 6).map((s) => (
              <div key={s.title} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate text-muted-foreground">{s.title}</span>
                <span
                  className={
                    s.score >= 75
                      ? "text-emerald-400"
                      : s.score >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                  }
                >
                  {s.score}%
                </span>
              </div>
            ))}
          </div>
        )}

        {revisionStatus && (
          <p className="text-xs text-muted-foreground">{revisionStatus}</p>
        )}
      </CardContent>
    </Card>
  );
}
