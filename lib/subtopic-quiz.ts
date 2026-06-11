/**
 * Domain-agnostic MCQ generation from structured topic content.
 */

export interface McqQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SubtopicQuizInput {
  subtopicTitle: string;
  topicName: string;
  keywords: string[];
  learningObjectives: string[];
  allSubtopics: string[];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item.trim());
  }
  return result;
}

function pickDistractors(correct: string, pool: string[], count: number): string[] {
  const key = correct.trim().toLowerCase();
  return shuffle(
    pool.filter((item) => item.trim().toLowerCase() !== key && item.trim().length > 2)
  ).slice(0, count);
}

function makeQuestion(
  id: string,
  question: string,
  correct: string,
  distractors: string[],
  explanation: string
): McqQuestion | null {
  const pool = pickDistractors(correct, distractors, 3);
  if (pool.length < 2) return null;
  const options = shuffle(uniqueStrings([correct, ...pool]).slice(0, 4));
  const correctIndex = options.findIndex(
    (o) => o.trim().toLowerCase() === correct.trim().toLowerCase()
  );
  if (correctIndex < 0) return null;
  return { id, question, options, correctIndex, explanation };
}

/** Generate 3 MCQs for a subtopic from structured learning content. */
export function generateSubtopicQuiz(input: SubtopicQuizInput): McqQuestion[] {
  const {
    subtopicTitle,
    topicName,
    keywords,
    learningObjectives,
    allSubtopics,
  } = input;

  const questions: McqQuestion[] = [];
  const siblingPool =
    allSubtopics.length > 1 ? allSubtopics : [...keywords, topicName];

  const q1 = makeQuestion(
    "identify-subtopic",
    `Which item is a subtopic within "${topicName}"?`,
    subtopicTitle,
    siblingPool,
    `"${subtopicTitle}" is part of the "${topicName}" syllabus unit.`
  );
  if (q1) questions.push(q1);

  const relatedKeyword =
    keywords.find((k) =>
      subtopicTitle.toLowerCase().includes(k.toLowerCase())
    ) ??
    keywords.find((k) => k.length >= 4) ??
    keywords[0];

  if (relatedKeyword) {
    const q2 = makeQuestion(
      "keyword-link",
      `Which term is most relevant when studying "${subtopicTitle}"?`,
      relatedKeyword,
      keywords.length > 1 ? keywords : siblingPool,
      `"${relatedKeyword}" connects to the concepts in "${subtopicTitle}".`
    );
    if (q2) questions.push(q2);
  }

  const relatedObjective =
    learningObjectives.find((o) => {
      const firstWord = subtopicTitle.split(/\s+/)[0]?.toLowerCase() ?? "";
      return firstWord.length > 3 && o.toLowerCase().includes(firstWord);
    }) ?? learningObjectives[0];

  if (relatedObjective) {
    const q3 = makeQuestion(
      "objective-match",
      `Which learning objective best matches "${subtopicTitle}"?`,
      relatedObjective,
      learningObjectives.length > 1
        ? learningObjectives
        : [
            `Review fundamentals of ${topicName}`,
            `Compare unrelated topics in ${topicName}`,
            `Skip practice for ${subtopicTitle}`,
          ],
      `This objective reflects what you should achieve after studying "${subtopicTitle}".`
    );
    if (q3) questions.push(q3);
  }

  const fallbackSpecs = [
    {
      id: "scope-fallback",
      question: `"${subtopicTitle}" is primarily studied in the context of:`,
      correct: topicName,
      pool: siblingPool,
      explanation: `"${subtopicTitle}" belongs to ${topicName}.`,
    },
    {
      id: "study-fallback",
      question: `What should you focus on when learning "${subtopicTitle}"?`,
      correct: `Core ideas, definitions, and examples for ${subtopicTitle}`,
      pool: [
        "Administrative syllabus metadata only",
        "Unrelated topics from other units",
        "Skipping practice questions",
      ],
      explanation:
        "Focus on definitions, examples, and how the idea fits the unit.",
    },
    {
      id: "recall-fallback",
      question: `After studying "${subtopicTitle}", you should be able to:`,
      correct: `Explain ${subtopicTitle} in your own words`,
      pool: [
        "Memorize page numbers from the syllabus",
        "Ignore connections to other subtopics",
        "Avoid any practice or recall",
      ],
      explanation: "Being able to explain the subtopic shows real understanding.",
    },
  ];

  for (const spec of fallbackSpecs) {
    if (questions.length >= 3) break;
    const fb = makeQuestion(
      spec.id,
      spec.question,
      spec.correct,
      spec.pool,
      spec.explanation
    );
    if (fb && !questions.some((q) => q.id === fb.id)) {
      questions.push(fb);
    }
  }

  return questions.slice(0, 3).map((q) => {
    const correctAnswer = q.options[q.correctIndex];
    const options = shuffle(q.options);
    return {
      ...q,
      options,
      correctIndex: options.indexOf(correctAnswer),
    };
  });
}

export const QUIZ_PASS_PERCENT = 67;

export function scoreQuiz(questions: McqQuestion[], answers: number[]): number {
  if (!questions.length) return 0;
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correctIndex) correct++;
  }
  return Math.round((correct / questions.length) * 100);
}

export function quizPassed(score: number): boolean {
  return score >= QUIZ_PASS_PERCENT;
}
