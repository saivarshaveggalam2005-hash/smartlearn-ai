"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  generateSubtopicQuiz,
  quizPassed,
  scoreQuiz,
  type McqQuestion,
} from "@/lib/subtopic-quiz";

interface SubtopicQuizProps {
  subtopicTitle: string;
  topicName: string;
  keywords: string[];
  learningObjectives: string[];
  allSubtopics: string[];
  onComplete: (score: number, passed: boolean) => void;
  onSkip: () => void;
  saving?: boolean;
}

export function SubtopicQuiz({
  subtopicTitle,
  topicName,
  keywords,
  learningObjectives,
  allSubtopics,
  onComplete,
  onSkip,
  saving,
}: SubtopicQuizProps) {
  const questions = useMemo(
    () =>
      generateSubtopicQuiz({
        subtopicTitle,
        topicName,
        keywords,
        learningObjectives,
        allSubtopics,
      }),
    [subtopicTitle, topicName, keywords, learningObjectives, allSubtopics]
  );

  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null)
  );
  const [submitted, setSubmitted] = useState(false);
  const [quizKey, setQuizKey] = useState(0);

  const score = submitted
    ? scoreQuiz(
        questions,
        answers.map((a) => a ?? -1)
      )
    : 0;
  const passed = quizPassed(score);

  const allAnswered = answers.every((a) => a !== null);

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
    onComplete(score, quizPassed(score));
  };

  const retry = () => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
    setQuizKey((k) => k + 1);
  };

  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>Mini Quiz · {subtopicTitle}</span>
          <Badge variant="outline">3 questions</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" key={quizKey}>
        {questions.map((q, qi) => (
          <QuestionBlock
            key={q.id}
            question={q}
            index={qi}
            selected={answers[qi]}
            submitted={submitted}
            onSelect={(idx) => {
              if (submitted) return;
              setAnswers((prev) => {
                const next = [...prev];
                next[qi] = idx;
                return next;
              });
            }}
          />
        ))}

        {submitted && (
          <div
            className={`rounded-lg p-4 flex items-start gap-3 ${
              passed
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : "bg-amber-500/10 border border-amber-500/30"
            }`}
          >
            {passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">
                {passed ? "Great work!" : "Keep revising"} — Score: {score}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {passed
                  ? "Next subtopic unlocked."
                  : "Review the subtopic and retry, or skip to continue."}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {!submitted ? (
            <>
              <Button
                variant="gradient"
                onClick={handleSubmit}
                disabled={!allAnswered || saving}
              >
                Submit Quiz
              </Button>
              <Button variant="outline" onClick={onSkip} disabled={saving}>
                Skip revision
              </Button>
            </>
          ) : passed ? null : (
            <>
              <Button variant="gradient" onClick={retry} disabled={saving}>
                <RotateCcw className="h-4 w-4" />
                Retry Quiz
              </Button>
              <Button variant="outline" onClick={onSkip} disabled={saving}>
                Skip revision
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionBlock({
  question,
  index,
  selected,
  submitted,
  onSelect,
}: {
  question: McqQuestion;
  index: number;
  selected: number | null;
  submitted: boolean;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {index + 1}. {question.question}
      </p>
      <div className="space-y-2">
        {question.options.map((opt, oi) => {
          const isSelected = selected === oi;
          const isCorrect = oi === question.correctIndex;
          let variant = "border-border/50 hover:border-primary/40";

          if (submitted && isCorrect) {
            variant = "border-emerald-500/50 bg-emerald-500/10";
          } else if (submitted && isSelected && !isCorrect) {
            variant = "border-red-500/50 bg-red-500/10";
          } else if (isSelected) {
            variant = "border-primary/50 bg-primary/10";
          }

          return (
            <button
              key={oi}
              type="button"
              disabled={submitted}
              onClick={() => onSelect(oi)}
              className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${variant}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {submitted && (
        <p className="text-xs text-muted-foreground">{question.explanation}</p>
      )}
    </div>
  );
}
