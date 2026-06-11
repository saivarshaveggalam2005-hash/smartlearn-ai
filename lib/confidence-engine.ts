/**
 * Phase 4 — Subject exam readiness / confidence meter.
 */

export interface TopicConfidenceInput {
  name: string;
  completed: boolean;
  masteryScore?: number;
  quizScore?: number;
  isWeakTopic?: boolean;
  revisionsCount?: number;
}

export interface SubjectConfidence {
  score: number;
  readyForExam: boolean;
  label: string;
  needsImprovement: string[];
  strongAreas: string[];
}

export function calculateSubjectConfidence(
  subjectName: string,
  topics: TopicConfidenceInput[]
): SubjectConfidence {
  if (!topics.length) {
    return {
      score: 0,
      readyForExam: false,
      label: "Getting Started",
      needsImprovement: [],
      strongAreas: [],
    };
  }

  let total = 0;
  const needsImprovement: string[] = [];
  const strongAreas: string[] = [];

  for (const topic of topics) {
    let topicScore = topic.masteryScore ?? 0;

    if (topic.completed && topicScore === 0) {
      topicScore = topic.quizScore ?? 55;
    }
    if (!topic.completed) {
      topicScore = Math.min(topicScore, 25);
    }
    if (topic.isWeakTopic || (topic.quizScore ?? 100) < 60) {
      needsImprovement.push(topic.name);
      topicScore = Math.min(topicScore, 50);
    }
    if ((topic.revisionsCount ?? 0) > 2 && topicScore < 70) {
      if (!needsImprovement.includes(topic.name)) {
        needsImprovement.push(topic.name);
      }
    }
    if (topicScore >= 75 && topic.completed) {
      strongAreas.push(topic.name);
    }

    total += topicScore;
  }

  const score = Math.round(total / topics.length);
  const readyForExam = score >= 70 && needsImprovement.length <= topics.length * 0.25;

  let label = "Needs Work";
  if (score >= 85) label = "Exam Ready";
  else if (score >= 70) label = "Almost Ready";
  else if (score >= 50) label = "Building Confidence";

  void subjectName;

  return {
    score,
    readyForExam,
    label,
    needsImprovement: needsImprovement.slice(0, 8),
    strongAreas: strongAreas.slice(0, 5),
  };
}
