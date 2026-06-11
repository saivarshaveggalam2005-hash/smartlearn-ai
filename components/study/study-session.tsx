"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Brain,
  FileText,
  HelpCircle,
  CheckCircle,
  Loader2,
  Send,
  Clock,
  ListChecks,
  Route,
  Tag,
  Target,
  Lock,
  ChevronRight,
  Star,
  Timer,
  Trophy,
} from "lucide-react";
import { DonutProgress } from "@/components/dashboard/donut-progress";
import { toast } from "sonner";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import { AiMarkdown } from "@/components/ai/ai-markdown";
import type { StructuredTopicContent } from "@/lib/structured-learning-content";
import type { ISubtopicProgress } from "@/models/Subject";
import { SubtopicJourney } from "@/components/study/subtopic-journey";
import { MissionCard } from "@/components/study/mission-card";
import { KnowledgeGraphStrip } from "@/components/study/knowledge-graph-strip";
import { StudyCoachPanel } from "@/components/study/study-coach-panel";
import { FocusMusicPlayer } from "@/components/study/focus-music-player";
import { MasteryConfidencePanel } from "@/components/study/mastery-confidence-panel";
import type { NextTopicRef } from "@/lib/study-navigation";
import type { StudySessionContext } from "@/lib/study-session-context";
import { buildTopicMission } from "@/lib/mission-engine";

interface StudySessionProps {
  topicName: string;
  topicSlug: string;
  subjectSlug: string;
  subjectName: string;
  topicId: string;
  subjectId: string;
  difficulty: string;
  unitTitle?: string;
  parentTopicTitle?: string;
  aiContext: string;
  structuredContent: StructuredTopicContent;
  estimatedMinutes: number;
  recommendedPomodoros: number;
  sessionFocusMinutes: number;
  subtopicCount: number;
  practiceCount: number;
  completed?: boolean;
  completionStatus?: string;
  initialSubtopicProgress?: ISubtopicProgress[];
  nextTopic?: NextTopicRef;
  studyContext: StudySessionContext;
}

export function StudySession({
  topicName,
  subjectSlug,
  subjectName,
  topicId,
  subjectId,
  difficulty,
  unitTitle,
  parentTopicTitle,
  aiContext,
  structuredContent,
  estimatedMinutes,
  recommendedPomodoros,
  sessionFocusMinutes,
  subtopicCount,
  practiceCount,
  completed,
  completionStatus,
  initialSubtopicProgress = [],
  nextTopic,
  studyContext,
}: StudySessionProps) {
  const router = useRouter();
  const hasSubtopicJourney = structuredContent.subtopics.length > 0;
  const [studyStarted, setStudyStarted] = useState(
    () =>
      Boolean(completed) ||
      completionStatus === "in_progress" ||
      completionStatus === "completed"
  );
  const [checklistPercent, setChecklistPercent] = useState(() => {
    if (!hasSubtopicJourney) return 100;
    const done = initialSubtopicProgress.filter((p) => p.completed).length;
    return Math.round((done / structuredContent.subtopics.length) * 100);
  });
  const [subtopicSavedProgress, setSubtopicSavedProgress] = useState(
    initialSubtopicProgress
  );
  const pomodoroConfig = useMemo(
    () => ({
      focusMinutes: sessionFocusMinutes,
      breakMinutes: 5,
      totalSessions: recommendedPomodoros,
    }),
    [sessionFocusMinutes, recommendedPomodoros]
  );
  const pomodoro = usePomodoro(pomodoroConfig);
  const [tutorText, setTutorText] = useState("");
  const [tutorLoading, setTutorLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteType, setNoteType] = useState("summary");
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const sessionStartedAt = useRef(new Date().toISOString());

  const subtopicProgress = hasSubtopicJourney
    ? checklistPercent
    : completionStatus === "completed" || completed
      ? 100
      : completionStatus === "in_progress"
        ? 40
        : 0;

  const canMarkComplete = Boolean(completed || (studyStarted && !completed));
  const quizUnlocked = Boolean(completed);

  const liveMission = useMemo(
    () =>
      buildTopicMission({
        topicName,
        subtopics: structuredContent.subtopics.length
          ? structuredContent.subtopics
          : [topicName],
        subtopicProgress: subtopicSavedProgress,
        topicCompleted: completed,
      }),
    [
      topicName,
      structuredContent.subtopics,
      subtopicSavedProgress,
      completed,
    ]
  );

  const handleStartStudy = () => {
    setStudyStarted(true);
    if (!pomodoro.isRunning && !pomodoro.allSessionsDone) {
      pomodoro.toggle();
    }
    fetch("/api/topics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectSlug,
        topicId,
        updates: { revisionStatus: "in_progress" },
      }),
    }).catch(() => {});
    toast.success("Study session started — timer is running");
  };

  const loadTutor = useCallback(async (q?: string) => {
    setTutorLoading(true);
    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicName,
          question: q,
          content: aiContext,
          subjectSlug,
          topicId,
          unitTitle,
          parentTopicTitle,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Tutor request failed");
      }

      const text = data.explanation?.trim();
      if (!text) {
        throw new Error("No tutor response received");
      }

      setTutorText(text);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to load tutor";
      setTutorText(`**Could not load tutor**\n\n${msg}\n\nPlease refresh and try again.`);
      toast.error(msg);
    } finally {
      setTutorLoading(false);
    }
  }, [topicName, aiContext, subjectSlug, topicId, unitTitle, parentTopicTitle]);

  useEffect(() => {
    loadTutor();
  }, [loadTutor]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pomodoro.isRunning) setSessionMinutes((m) => m + 1 / 60);
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoro.isRunning]);

  const generateNotes = async (skipCache = false) => {
    setNotesLoading(true);
    try {
      const res = await fetch("/api/ai/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicName,
          subjectSlug,
          topicId,
          type: noteType,
          content: aiContext,
          skipCache,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate notes");
      }

      const text = data.notes?.trim();
      if (!text) {
        throw new Error("No notes returned");
      }

      setNotes(text);
      if (data.cached) {
        toast.success("Showing saved Gemini notes (from your last generation)");
      } else if (data.source === "gemini") {
        toast.success("Fresh notes generated with Gemini");
      } else if (data.unavailable) {
        toast.warning(
          data.error ??
            "AI notes unavailable — showing syllabus content"
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate notes";
      toast.error(msg);
    } finally {
      setNotesLoading(false);
    }
  };

  const saveProgress = async (markCompleted = false) => {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minutes: Math.round(sessionMinutes) || 1,
        topicCompleted: markCompleted ? topicId : undefined,
      }),
    });

    await fetch("/api/study/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        topicId,
        topicName,
        duration: Math.round(sessionMinutes) || 1,
        completed: markCompleted,
        notesGenerated: notes.slice(0, 500),
        pomodoroSessions: pomodoro.sessions,
        subjectSlug,
        sessionStartedAt: sessionStartedAt.current,
        sessionEndedAt: new Date().toISOString(),
      }),
    });

    if (markCompleted) {
      await fetch("/api/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectSlug,
          topicId,
          updates: { completed: true, revisionStatus: "done" },
        }),
      });
    }
  };

  const handleComplete = async (andContinue = false) => {
    setCompleting(true);
    try {
      await saveProgress(true);
      toast.success(
        nextTopic && andContinue
          ? `Completed! Up next: ${nextTopic.name}`
          : "Topic completed!"
      );
      if (nextTopic && andContinue) {
        router.push(
          `/study/${nextTopic.slug}?subject=${subjectSlug}&topicId=${nextTopic.id}`
        );
      } else {
        router.push(`/subjects/${subjectSlug}`);
      }
      router.refresh();
    } catch {
      toast.error("Failed to save progress");
    } finally {
      setCompleting(false);
    }
  };

  const goToNextTopic = () => {
    if (!nextTopic) return;
    router.push(
      `/study/${nextTopic.slug}?subject=${subjectSlug}&topicId=${nextTopic.id}`
    );
    router.refresh();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFocusMode(true);
    } else {
      document.exitFullscreen();
      setFocusMode(false);
    }
  };

  const quickNotesMarkdown = [
    "## Quick Notes",
    "",
    "### Learning Objectives",
    ...structuredContent.learningObjectives.map((o) => `- ${o}`),
    "",
    "### Key Points",
    ...structuredContent.keywords.map((k) => `- **${k}**`),
    "",
    structuredContent.subtopics.length
      ? "### Subtopics to Master\n" +
        structuredContent.subtopics.map((s) => `- ${s}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const totalSubtopics = structuredContent.subtopics.length || 1;
  const reviewedSubtopics = subtopicSavedProgress.filter(
    (p) => p.completed || p.skipped
  ).length;
  const breadcrumbMiddle = parentTopicTitle || unitTitle;

  const notesTabContent = (
    <div className="space-y-4">
      <div className="rounded-lg bg-secondary/20 p-3 max-h-[180px] overflow-y-auto">
        <AiMarkdown content={quickNotesMarkdown} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {["summary", "keyPoints", "revision", "interview"].map((t) => (
          <Button
            key={t}
            size="sm"
            variant={noteType === t ? "default" : "outline"}
            onClick={() => setNoteType(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="gradient"
          className="flex-1"
          onClick={() => generateNotes(false)}
          disabled={notesLoading}
        >
          {notesLoading ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            "Generate AI Notes"
          )}
        </Button>
        {notes ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => generateNotes(true)}
            disabled={notesLoading}
            title="Call Gemini again for fresh notes"
          >
            Regenerate
          </Button>
        ) : null}
      </div>
      {notes ? (
        <div className="max-h-[320px] overflow-y-auto rounded-lg bg-secondary/30 p-4 border border-border/50">
          <AiMarkdown content={notes} />
        </div>
      ) : (
        <p className="text-xs text-center text-muted-foreground py-4">
          Generate notes from structured topic content.
        </p>
      )}
    </div>
  );

  const quizTabContent = (
    <div className="space-y-4">
      {!quizUnlocked ? (
        <div className="flex flex-col items-center py-8 text-center gap-2">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Complete this topic to unlock practice quizzes, revision questions,
            and interview prep.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {["quiz", "revision", "interview"].map((t) => (
              <Button
                key={t}
                size="sm"
                variant={noteType === t ? "default" : "outline"}
                onClick={() => setNoteType(t)}
              >
                {t === "quiz"
                  ? "Practice Quiz"
                  : t === "revision"
                    ? "Revision Quiz"
                    : "Interview Qs"}
              </Button>
            ))}
          </div>
          <Button
            variant="gradient"
            className="w-full"
            onClick={() => {
              if (noteType === "notes") setNoteType("quiz");
              generateNotes();
            }}
            disabled={notesLoading}
          >
            Generate{" "}
            {noteType === "interview"
              ? "Interview Questions"
              : noteType === "revision"
                ? "Revision Quiz"
                : "Practice Quiz"}
          </Button>
          {notes && ["quiz", "revision", "interview"].includes(noteType) ? (
            <div className="max-h-[320px] overflow-y-auto rounded-lg bg-secondary/30 p-4 border border-border/50">
              <AiMarkdown content={notes} />
            </div>
          ) : (
            <p className="text-xs text-center text-muted-foreground py-4">
              Generate practice material for this completed topic.
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <div
      className={`w-full max-w-[1400px] mx-auto ${focusMode ? "fixed inset-0 z-50 bg-background p-4 overflow-auto" : ""}`}
    >
      {/* Top bar: back + breadcrumbs + actions + compact timer */}
      <div className="flex flex-col gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={`/subjects/${subjectSlug}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to {subjectName}
          </Link>
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link
            href={`/subjects/${subjectSlug}`}
            className="text-primary hover:underline"
          >
            {subjectName}
          </Link>
          {breadcrumbMiddle && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{breadcrumbMiddle}</span>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{topicName}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="warning" className="capitalize">{difficulty}</Badge>
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Est. {formatDuration(estimatedMinutes)}
              </Badge>
              <Badge variant="outline">
                Session {Math.min(pomodoro.sessions + 1, pomodoro.totalSessions)} of {pomodoro.totalSessions}
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{topicName}</h1>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {structuredContent.overview.replace(/\*\*/g, "").slice(0, 140)}
              {structuredContent.overview.length > 140 ? "…" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => saveProgress()}>
              Save Progress
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            {studyStarted && (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5">
                <motion.span
                  key={pomodoro.formatted}
                  className="font-mono font-bold text-lg gradient-text tabular-nums"
                >
                  {pomodoro.formatted}
                </motion.span>
                <Button
                  variant={pomodoro.isRunning ? "default" : "gradient"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={pomodoro.toggle}
                  disabled={pomodoro.allSessionsDone}
                >
                  {pomodoro.isRunning ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={pomodoro.reset}
                  title="Reset timer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {canMarkComplete && !completed && (
              <Button
                variant="gradient"
                size="sm"
                onClick={() => handleComplete(Boolean(nextTopic))}
                disabled={completing}
              >
                {completing ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    {nextTopic ? "Complete & Next Topic" : "Mark Complete"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
            {canMarkComplete && !completed && nextTopic && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleComplete(false)}
                disabled={completing}
              >
                Mark Complete Only
              </Button>
            )}
            {completed && nextTopic && (
              <Button variant="gradient" size="sm" onClick={goToNextTopic}>
                Continue: {nextTopic.name}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pre-study */}
      {!studyStarted && !completed && (
        <SubtopicJourney
          topicName={topicName}
          subjectSlug={subjectSlug}
          topicId={topicId}
          structuredContent={structuredContent}
          initialProgress={initialSubtopicProgress}
          studyStarted={studyStarted}
          topicCompleted={completed}
          onStartStudy={handleStartStudy}
          onProgressChange={(progress, allDone) => {
            setSubtopicSavedProgress(progress);
            if (structuredContent.subtopics.length > 0) {
              const done = progress.filter((p) => p.completed).length;
              setChecklistPercent(
                Math.round((done / structuredContent.subtopics.length) * 100)
              );
            }
            void allDone;
          }}
          nextTopicName={nextTopic?.name}
          onMarkTopicComplete={
            !completed ? () => handleComplete(Boolean(nextTopic)) : undefined
          }
          completing={completing}
        />
      )}

      {studyStarted && (
        <>
          {/* Subtopic progress bar */}
          {hasSubtopicJourney && (
            <div className="mb-4 rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Subtopic Progress
                </span>
                <span className="text-muted-foreground">
                  {reviewedSubtopics} / {totalSubtopics} Completed · {checklistPercent}%
                </span>
              </div>
              <Progress value={checklistPercent} className="h-2" />
            </div>
          )}

          <div className="grid xl:grid-cols-[1fr_300px] gap-5">
            {/* Main content with tabs */}
            <div className="min-w-0 space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-secondary/30 p-1">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="path" className="text-xs sm:text-sm">
                    Learning Path
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs sm:text-sm">
                    <FileText className="h-3 w-3 mr-1" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="keywords" className="text-xs sm:text-sm">
                    Keywords
                  </TabsTrigger>
                  <TabsTrigger
                    value="quiz"
                    className="text-xs sm:text-sm"
                    disabled={!quizUnlocked}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Quiz
                    {!quizUnlocked && <Lock className="h-3 w-3 ml-1 opacity-50" />}
                  </TabsTrigger>
                  <TabsTrigger value="tutor" className="text-xs sm:text-sm">
                    <Brain className="h-3 w-3 mr-1" />
                    AI Tutor
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="glass border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Topic Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <AiMarkdown content={structuredContent.overview} />
                      </CardContent>
                    </Card>
                    <Card className="glass border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          Learning Objectives
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {structuredContent.learningObjectives.map((obj) => (
                            <li key={obj} className="flex gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{obj}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="glass border-amber-500/20 mt-4">
                    <CardContent className="p-4 flex gap-3 items-start">
                      <Star className="h-5 w-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Why Important?</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {subtopicCount} subtopics · {practiceCount} practice items ·
                          appears frequently in exams for {subjectName}.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="path" className="mt-4 space-y-4">
                  <Card className="glass border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Route className="h-4 w-4 text-primary" />
                        Learning Path ({totalSubtopics} Subtopics)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SubtopicJourney
                        topicName={topicName}
                        subjectSlug={subjectSlug}
                        topicId={topicId}
                        structuredContent={structuredContent}
                        initialProgress={subtopicSavedProgress}
                        studyStarted={studyStarted}
                        topicCompleted={completed}
                        onStartStudy={handleStartStudy}
                        onProgressChange={(progress, allDone) => {
                          setSubtopicSavedProgress(progress);
                          if (structuredContent.subtopics.length > 0) {
                            const done = progress.filter((p) => p.completed).length;
                            setChecklistPercent(
                              Math.round(
                                (done / structuredContent.subtopics.length) * 100
                              )
                            );
                          }
                          void allDone;
                        }}
                        variant="embedded"
                        hideCompleteSection
                      />
                    </CardContent>
                  </Card>
                  <Card className="glass border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Study Blocks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {structuredContent.studyBlocks
                        .sort((a, b) => a.order - b.order)
                        .map((block) => (
                          <div
                            key={`${block.order}-${block.title}`}
                            className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
                          >
                            <span>{block.title}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {block.minutes}m
                            </Badge>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <Card className="glass border-border/60">
                    <CardContent className="p-4">{notesTabContent}</CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="keywords" className="mt-4">
                  <Card className="glass border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        Keywords
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {structuredContent.keywords.map((kw) => (
                          <Badge key={kw} variant="secondary">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="quiz" className="mt-4">
                  <Card className="glass border-border/60">
                    <CardContent className="p-4">{quizTabContent}</CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tutor" className="mt-4">
                  <Card className="glass border-border/60">
                    <CardContent className="p-4">
                      {tutorLoading ? (
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                        </div>
                      ) : (
                        <div className="max-h-[240px] overflow-y-auto rounded-lg bg-secondary/20 p-3 mb-4">
                          <AiMarkdown content={tutorText} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Ask the AI tutor..."
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          className="min-h-[56px]"
                        />
                        <Button
                          size="icon"
                          variant="gradient"
                          onClick={() => {
                            loadTutor(question);
                            setQuestion("");
                          }}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Mission + graph — compact */}
              <details className="group rounded-xl border border-border/60 bg-card/30">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center gap-2 list-none">
                  <Target className="h-4 w-4 text-violet-400" />
                  Mission & Learning Graph
                  <ChevronRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <MissionCard mission={liveMission} />
                  <KnowledgeGraphStrip
                    nodes={studyContext.graphNodes}
                    prerequisites={studyContext.prerequisiteNames}
                  />
                </div>
              </details>
            </div>

            {/* Right sidebar */}
            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <Card className="glass border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Progress Tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DonutProgress value={subtopicProgress} size={120} />
                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                    <div>
                      <p className="font-bold text-emerald-400">{reviewedSubtopics}</p>
                      <p className="text-muted-foreground">Done</p>
                    </div>
                    <div>
                      <p className="font-bold text-primary">
                        {Math.max(0, totalSubtopics - reviewedSubtopics - (completed ? 0 : 1))}
                      </p>
                      <p className="text-muted-foreground">Left</p>
                    </div>
                    <div>
                      <p className="font-bold">{totalSubtopics}</p>
                      <p className="text-muted-foreground">Total</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Session: {formatDuration(Math.round(sessionMinutes))}
                  </p>
                </CardContent>
              </Card>

              <FocusMusicPlayer />

              <MasteryConfidencePanel
                topicMastery={studyContext.topicMastery}
                subjectConfidence={studyContext.subjectConfidence}
                readyForExam={studyContext.readyForExam}
                confidenceLabel={studyContext.confidenceLabel}
                subtopicMastery={studyContext.subtopicMastery}
                revisionStatus={studyContext.revisionStatus}
              />

              <StudyCoachPanel
                messages={studyContext.coachMessages}
                subjectName={subjectName}
              />
            </aside>
          </div>

          {/* Bottom session stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            {[
              {
                label: "Session Time",
                value: `${formatDuration(Math.round(sessionMinutes))} / ${formatDuration(estimatedMinutes)}`,
                icon: Timer,
              },
              {
                label: "Pomodoro",
                value: `${pomodoro.sessions} / ${pomodoro.totalSessions} cycles`,
                icon: Trophy,
              },
              {
                label: "Focus Goal",
                value: formatDuration(estimatedMinutes),
                icon: Target,
              },
              {
                label: "Next Break",
                value: pomodoro.isBreak ? "Active" : "5 min",
                icon: Clock,
              },
            ].map((stat) => (
              <Card key={stat.label} className="glass border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <stat.icon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    <p className="text-sm font-semibold truncate">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Completed state without studyStarted edge case */}
      {completed && !studyStarted && (
        <Card className="glass border-emerald-500/30">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="font-medium">Topic completed!</p>
            {nextTopic && (
              <Button variant="gradient" onClick={goToNextTopic}>
                Continue: {nextTopic.name}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
