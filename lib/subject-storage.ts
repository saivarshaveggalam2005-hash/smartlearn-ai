import { slugify, calculateCompletion } from "@/lib/utils";

import { analyzeTopic, type AnalyzedTopic } from "@/lib/topic-analyzer";

import type { ParsedSyllabus, ParsedTopicNode } from "@/lib/syllabus-parser";

import {
  buildStructuredLearningContent,
  formatStructuredContentForAi,
} from "@/lib/structured-learning-content";
import { buildLearningGraph } from "@/lib/learning-graph";
import { calculateStudyTimeBreakdown } from "@/lib/study-time-breakdown";



export interface StoredUnitTopic {

  title: string;

  slug: string;

  difficulty: "easy" | "medium" | "hard";

  estimatedHours: number;

  estimatedMinutes: number;

  baselineEstimatedMinutes: number;

  subtopicCount: number;

  hierarchyDepth: number;

  parentTopicTitle?: string;

  practiceCount: number;

  learningOutcomeCount: number;

  recommendedPomodoros: number;

  actualMinutesSpent: number;

  revisionsCount: number;

  difficultyScore: number;

  complexityScore: number;

  learningFactor: number;

  weakTopicScore: number;

  markedDifficult: boolean;

  revisionPriority: number;

  inRevisionQueue: boolean;

  initialDifficultyLevel?: "easy" | "medium" | "hard" | "very_hard";

  completed: boolean;

  completionStatus: "not_started" | "in_progress" | "completed";

  isWeakTopic: boolean;

  revisionStatus: "not_started" | "in_progress" | "done";

  studyMinutes: number;

  prerequisites?: string[];

  dependentTopics?: string[];

  masteryScore?: number;

  studyTimeBreakdown?: {
    readingMinutes: number;
    understandingMinutes: number;
    practiceMinutes: number;
    quizMinutes: number;
    revisionMinutes: number;
    totalMinutes: number;
  };

  subtopics?: Array<{
    title: string;
    slug: string;
    completed?: boolean;
    masteryScore?: number;
  }>;

}



export interface StoredUnit {

  title: string;

  slug: string;

  unitLabel?: string;

  estimatedMinutes?: number;

  difficulty?: "easy" | "medium" | "hard";

  progress?: number;

  topics: StoredUnitTopic[];

}



export interface StoredSubjectContent {

  units: StoredUnit[];

  topics: Array<

    StoredUnitTopic & {

      name: string;

      unitTitle: string;

      content?: string;

      overview?: string;

      subtopicsList?: string[];

      keywords?: string[];

      learningObjectives?: string[];

      studyBlocks?: {

        title: string;

        description: string;

        minutes: number;

        order: number;

      }[];

    }

  >;

}



interface BuildOptions {

  subjectName: string;

  weakSubjects?: string[];

  syllabusSnippet?: string;

  learningFactor?: number;

}



function toStoredUnitTopic(analyzed: AnalyzedTopic, slug: string): StoredUnitTopic {
  const studyTimeBreakdown = calculateStudyTimeBreakdown({
    totalMinutes: analyzed.estimatedMinutes,
    subtopicCount: analyzed.subtopicCount,
    complexityScore: analyzed.complexityScore,
    difficultyLevel: analyzed.initialDifficultyLevel,
    practiceCount: analyzed.practiceCount,
  });

  return {
    title: analyzed.name,
    slug,
    difficulty: analyzed.difficulty,
    estimatedHours: analyzed.estimatedHours,
    estimatedMinutes: analyzed.estimatedMinutes,
    baselineEstimatedMinutes: analyzed.baselineEstimatedMinutes,
    subtopicCount: analyzed.subtopicCount,
    hierarchyDepth: analyzed.hierarchyDepth,
    practiceCount: analyzed.practiceCount,
    learningOutcomeCount: analyzed.learningOutcomeCount,
    recommendedPomodoros: analyzed.recommendedPomodoros,
    actualMinutesSpent: 0,
    revisionsCount: 0,
    difficultyScore: analyzed.difficultyScore,
    complexityScore: analyzed.complexityScore,
    learningFactor: 1,
    weakTopicScore: analyzed.weakTopicScore,
    markedDifficult: false,
    revisionPriority: analyzed.isWeakTopic ? 55 : 0,
    inRevisionQueue: analyzed.isWeakTopic,
    initialDifficultyLevel: analyzed.initialDifficultyLevel,
    completed: false,
    completionStatus: analyzed.completionStatus,
    isWeakTopic: analyzed.isWeakTopic,
    revisionStatus: "not_started",
    studyMinutes: 0,
    masteryScore: 0,
    studyTimeBreakdown,
  };
}



function buildMainTopicFromNode(
  node: ParsedTopicNode,
  unitTitle: string,
  unitTopicCount: number,
  options: BuildOptions
): {
  analyzed: AnalyzedTopic;
  syllabusSubtopics: string[];
} {
  const syllabusSubtopics = node.subtopics
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);

  const analyzed = analyzeTopic(node.title, {
    subjectName: options.subjectName,
    weakSubjects: options.weakSubjects,
    unitTitle,
    unitTopicCount,
    subtopics: syllabusSubtopics.length > 0 ? syllabusSubtopics : undefined,
    hierarchyDepth: syllabusSubtopics.length > 0 ? 3 : 2,
    learningFactor: options.learningFactor ?? 1,
  });

  return { analyzed, syllabusSubtopics };
}



export function buildSubjectContentFromSyllabus(

  parsed: ParsedSyllabus,

  options: BuildOptions

): StoredSubjectContent {

  const units: StoredUnit[] = [];

  const topics: StoredSubjectContent["topics"] = [];

  const seenSlugs = new Set<string>();



  for (const unit of parsed.units) {

    const unitTitle = unit.title.trim();

    const unitSlug = slugify(unitTitle);

    const unitTopicCount = unit.topics.length;

    const unitTopics: StoredUnitTopic[] = [];

    let unitLabel = unit.unitLabel;



    for (const node of unit.topics) {
      const { analyzed, syllabusSubtopics } = buildMainTopicFromNode(
        node,
        unitTitle,
        unitTopicCount,
        options
      );

      if (analyzed.name.toLowerCase() === unitTitle.toLowerCase()) {
        continue;
      }

      const slug = slugify(analyzed.name);
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const stored = toStoredUnitTopic(analyzed, slug);
      const nestedSubtopics = syllabusSubtopics.map((st) => ({
        title: st,
        slug: slugify(st),
        completed: false,
        masteryScore: 0,
      }));
      if (nestedSubtopics.length > 0) {
        stored.subtopics = nestedSubtopics;
      }

      unitTopics.push(stored);

      const topicExcerpt =
        syllabusSubtopics.length > 0
          ? `${node.title}: ${syllabusSubtopics.join(", ")}`
          : node.title;

      const structured = buildStructuredLearningContent({
        topicName: analyzed.name,
        unitTitle,
        siblingSubtopics: syllabusSubtopics,
        subjectName: options.subjectName,
        syllabusExcerpt: topicExcerpt,
        estimatedMinutes: analyzed.estimatedMinutes,
      });

      topics.push({
        ...stored,
        name: analyzed.name,
        unitTitle,
        overview: structured.overview,
        subtopicsList:
          syllabusSubtopics.length > 0 ? syllabusSubtopics : structured.subtopics,
        keywords: structured.keywords,
        learningObjectives: structured.learningObjectives,
        studyBlocks: structured.studyBlocks,
        content: formatStructuredContentForAi(structured, analyzed.name),
      });
    }



    if (unitTopics.length) {
      const progress = calculateCompletion(unitTopics);
      const estimatedMinutes = unitTopics.reduce(
        (sum, t) => sum + t.estimatedMinutes,
        0
      );
      const hardCount = unitTopics.filter((t) => t.difficulty === "hard").length;
      const easyCount = unitTopics.filter((t) => t.difficulty === "easy").length;
      const difficulty: "easy" | "medium" | "hard" =
        hardCount >= easyCount && hardCount > 0
          ? "hard"
          : easyCount > unitTopics.length / 2
            ? "easy"
            : "medium";

      units.push({
        title: unitTitle,
        slug: unitSlug,
        unitLabel,
        progress,
        estimatedMinutes,
        difficulty,
        topics: unitTopics,
      });
    }
  }



  const graph = buildLearningGraph(
    topics.map((t) => ({
      slug: t.slug,
      name: t.name,
      unitTitle: t.unitTitle,
      keywords: t.keywords,
    }))
  );

  for (const topic of topics) {
    const entry = graph.get(topic.slug);
    if (entry) {
      topic.prerequisites = entry.prerequisites;
      topic.dependentTopics = entry.dependents;
    }
    for (const unit of units) {
      const nested = unit.topics.find((u) => u.slug === topic.slug);
      if (nested && entry) {
        nested.prerequisites = entry.prerequisites;
        nested.dependentTopics = entry.dependents;
      }
    }
  }

  return { units, topics };
}



export function syncNestedTopicBySlug(

  units: StoredUnit[],

  topicSlug: string,

  updater: (topic: StoredUnitTopic) => void

): void {

  for (const unit of units) {

    const nested = unit.topics.find((t) => t.slug === topicSlug);

    if (nested) updater(nested);

  }

}


