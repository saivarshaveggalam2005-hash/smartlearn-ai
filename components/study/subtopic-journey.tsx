"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AiMarkdown } from "@/components/ai/ai-markdown";
import type { StructuredTopicContent } from "@/lib/structured-learning-content";
import type { ISubtopicProgress } from "@/models/Subject";

export interface SubtopicJourneyProps {
  topicName: string;
  subjectSlug: string;
  topicId: string;
  structuredContent: StructuredTopicContent;
  initialProgress?: ISubtopicProgress[];
  studyStarted: boolean;
  topicCompleted?: boolean;
  onStartStudy: () => void;
  onProgressChange?: (progress: ISubtopicProgress[], allReviewed: boolean) => void;
  nextTopicName?: string;
  onMarkTopicComplete?: () => void;
  completing?: boolean;
  /** embedded = list only for tabs; card = default standalone */
  variant?: "card" | "embedded";
  hideCompleteSection?: boolean;
}

function progressMap(list: ISubtopicProgress[] = []) {
  const map = new Map<string, ISubtopicProgress>();
  for (const item of list) {
    map.set(item.title.toLowerCase(), item);
  }
  return map;
}

function isReviewed(title: string, map: Map<string, ISubtopicProgress>): boolean {
  const p = map.get(title.toLowerCase());
  return Boolean(p?.completed || p?.skipped);
}

export function SubtopicJourney({
  topicName,
  subjectSlug,
  topicId,
  structuredContent,
  initialProgress = [],
  studyStarted,
  topicCompleted,
  onStartStudy,
  onProgressChange,
  nextTopicName,
  onMarkTopicComplete,
  completing,
  variant = "card",
  hideCompleteSection = false,
}: SubtopicJourneyProps) {
  const subtopics =
    structuredContent.subtopics.length > 0
      ? structuredContent.subtopics
      : [topicName];

  const [savedProgress, setSavedProgress] =
    useState<ISubtopicProgress[]>(initialProgress);
  const [saving, setSaving] = useState(false);

  const progressByTitle = useMemo(
    () => progressMap(savedProgress),
    [savedProgress]
  );

  const reviewedCount = subtopics.filter((s) =>
    isReviewed(s, progressByTitle)
  ).length;
  const checklistPercent =
    subtopics.length > 0
      ? Math.round((reviewedCount / subtopics.length) * 100)
      : 100;
  const allReviewed = reviewedCount >= subtopics.length;

  const persistChecklist = useCallback(
    async (subtopicTitle: string, completed: boolean) => {
      setSaving(true);
      try {
        const res = await fetch("/api/study/subtopic-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectSlug,
            topicId,
            subtopicTitle,
            checklistOnly: true,
            completed,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Save failed");

        const updated = data.subtopicProgress as ISubtopicProgress[];
        setSavedProgress(updated);
        onProgressChange?.(updated, Boolean(data.allSubtopicsDone));
        return data;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save checklist"
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [subjectSlug, topicId, onProgressChange]
  );

  const toggleSubtopic = async (title: string) => {
    if (!studyStarted || topicCompleted) return;
    const reviewed = isReviewed(title, progressByTitle);
    await persistChecklist(title, !reviewed);
  };

  if (!studyStarted && !topicCompleted) {
    if (variant === "embedded") return null;
    return (
      <Card className="glass border-primary/20 mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Ready to Study
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Review the learning objectives and subtopics below, then start your
            adaptive study timer. Quizzes unlock after you mark this topic
            complete.
          </p>
          {structuredContent.learningObjectives.length > 0 && (
            <ul className="text-sm space-y-1.5 list-disc pl-5 text-muted-foreground">
              {structuredContent.learningObjectives.slice(0, 4).map((obj) => (
                <li key={obj}>{obj}</li>
              ))}
            </ul>
          )}
          {subtopics.length > 0 && (
            <div className="rounded-lg bg-secondary/20 p-3">
              <p className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">
                Subtopics ({subtopics.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {subtopics.map((sub) => (
                  <Badge key={sub} variant="secondary" className="text-xs">
                    {sub}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <Button variant="gradient" size="lg" onClick={onStartStudy} className="w-full sm:w-auto">
            Start Study
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const checklistItems = (
    <div className="space-y-1.5">
      {subtopics.map((sub, index) => {
        const done = isReviewed(sub, progressByTitle) || topicCompleted;
        const block = structuredContent.studyBlocks.find(
          (b) => b.title.toLowerCase() === sub.toLowerCase()
        );
        const isCurrent =
          !done &&
          subtopics.findIndex(
            (s) => !isReviewed(s, progressByTitle) && !topicCompleted
          ) === index;

        return (
          <button
            key={sub}
            type="button"
            disabled={saving || topicCompleted}
            onClick={() => toggleSubtopic(sub)}
            className={`w-full text-left flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              isCurrent
                ? "border-primary/50 bg-primary/10"
                : done
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border/50 hover:border-primary/30"
            }`}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : isCurrent ? (
              <div className="h-4 w-4 rounded-full border-2 border-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
              <div>
                <p
                  className={`text-sm font-medium ${done ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}
                >
                  {index + 1}. {sub}
                </p>
                {block && variant === "card" && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {block.description}
                  </p>
                )}
              </div>
              {block && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {block.minutes}m
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  if (variant === "embedded") {
    return (
      <div className="space-y-3">
        {checklistItems}
        {!hideCompleteSection && !topicCompleted && onMarkTopicComplete && (
          <Button
            variant="gradient"
            size="sm"
            className="w-full"
            onClick={onMarkTopicComplete}
            disabled={completing || !studyStarted}
          >
            {completing ? "Saving..." : "Mark Topic Complete"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="glass border-primary/20 mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Study Checklist
          </CardTitle>
          <Badge variant={allReviewed || topicCompleted ? "success" : "secondary"}>
            {reviewedCount}/{subtopics.length} reviewed
          </Badge>
        </div>
        <Progress value={checklistPercent} className="mt-3" />
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Work through each subtopic while your timer runs. Check items off as
          you finish reading and understanding them.
        </p>

        <div className="space-y-2">
          {checklistItems}
        </div>

        {structuredContent.keywords.length > 0 && (
          <div className="rounded-lg bg-secondary/20 p-3 text-sm">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Key concepts</p>
            <div className="flex flex-wrap gap-2">
              {structuredContent.keywords.slice(0, 8).map((kw) => (
                <Badge key={kw} variant="outline" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!hideCompleteSection && !topicCompleted && onMarkTopicComplete && (
          <div className="rounded-lg border border-border/50 p-4 space-y-3">
            <AiMarkdown
              content={`When you have studied **${topicName}**, mark it complete to save progress and unlock practice quizzes.`}
            />
            <Button
              variant="gradient"
              onClick={onMarkTopicComplete}
              disabled={completing || !studyStarted}
            >
              {completing ? (
                "Saving..."
              ) : (
                <>
                  {nextTopicName ? "Mark Complete & Next Topic" : "Mark Topic Complete"}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
