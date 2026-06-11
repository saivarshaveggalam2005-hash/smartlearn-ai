"use client";

import { Brain, Sparkles } from "lucide-react";
import type { CoachMessage } from "@/lib/study-coach";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TYPE_STYLES: Record<CoachMessage["type"], string> = {
  tip: "border-border/50 bg-secondary/20",
  warning: "border-amber-500/30 bg-amber-500/5",
  success: "border-emerald-500/30 bg-emerald-500/5",
  revision: "border-violet-500/30 bg-violet-500/5",
  prerequisite: "border-blue-500/30 bg-blue-500/5",
};

interface StudyCoachPanelProps {
  messages: CoachMessage[];
  subjectName: string;
}

export function StudyCoachPanel({ messages, subjectName }: StudyCoachPanelProps) {
  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          AI Study Coach
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subjectName}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 text-sm ${TYPE_STYLES[msg.type]}`}
          >
            {msg.text}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
