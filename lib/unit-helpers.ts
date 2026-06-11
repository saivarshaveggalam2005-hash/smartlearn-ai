import type { ITopic, IUnit } from "@/models/Subject";
import { slugify, calculateCompletion } from "@/lib/utils";
import { getTopicEstimatedMinutes } from "@/lib/adaptive-study-time";

type TopicLike = Pick<
  ITopic,
  | "name"
  | "slug"
  | "unitTitle"
  | "subtopicsList"
  | "difficulty"
  | "estimatedHours"
  | "estimatedMinutes"
  | "baselineEstimatedMinutes"
  | "completed"
  | "completionStatus"
  | "isWeakTopic"
  | "revisionStatus"
  | "studyMinutes"
  | "subtopicCount"
  | "hierarchyDepth"
  | "parentTopicTitle"
  | "practiceCount"
  | "learningOutcomeCount"
  | "recommendedPomodoros"
  | "actualMinutesSpent"
  | "revisionsCount"
  | "difficultyScore"
  | "complexityScore"
  | "learningFactor"
  | "weakTopicScore"
  | "markedDifficult"
  | "revisionPriority"
  | "inRevisionQueue"
  | "initialDifficultyLevel"
>;

function dominantDifficulty(
  topics: { difficulty: "easy" | "medium" | "hard" }[]
): "easy" | "medium" | "hard" {
  if (!topics.length) return "medium";
  const scores = { easy: 0, medium: 0, hard: 0 };
  for (const t of topics) scores[t.difficulty]++;
  if (scores.hard >= scores.medium && scores.hard >= scores.easy) return "hard";
  if (scores.easy > scores.medium) return "easy";
  return "medium";
}

function unitKey(topic: TopicLike): string {
  return topic.unitTitle?.trim() || "Syllabus Topics";
}

function toUnitTopic(topic: TopicLike) {
  const nestedSubtopics = (topic.subtopicsList ?? []).map((title) => ({
    title,
    slug: slugify(title),
    completed: false,
    masteryScore: 0,
  }));

  return {
    title: topic.name,
    slug: topic.slug,
    difficulty: topic.difficulty,
    estimatedHours: topic.estimatedHours,
    estimatedMinutes: topic.estimatedMinutes,
    baselineEstimatedMinutes: topic.baselineEstimatedMinutes,
    subtopicCount: topic.subtopicCount,
    hierarchyDepth: topic.hierarchyDepth,
    parentTopicTitle: topic.parentTopicTitle,
    practiceCount: topic.practiceCount,
    learningOutcomeCount: topic.learningOutcomeCount,
    recommendedPomodoros: topic.recommendedPomodoros,
    actualMinutesSpent: topic.actualMinutesSpent,
    revisionsCount: topic.revisionsCount,
    difficultyScore: topic.difficultyScore,
    complexityScore: topic.complexityScore,
    learningFactor: topic.learningFactor,
    weakTopicScore: topic.weakTopicScore,
    markedDifficult: topic.markedDifficult,
    revisionPriority: topic.revisionPriority,
    inRevisionQueue: topic.inRevisionQueue,
    initialDifficultyLevel: topic.initialDifficultyLevel,
    completed: topic.completed,
    completionStatus: topic.completionStatus,
    isWeakTopic: topic.isWeakTopic,
    revisionStatus: topic.revisionStatus,
    studyMinutes: topic.studyMinutes,
    ...(nestedSubtopics.length > 0 ? { subtopics: nestedSubtopics } : {}),
  };
}

function countNestedSubtopics(topics: TopicLike[]): number {
  return topics.reduce(
    (sum, t) => sum + (t.subtopicsList?.length ?? Math.max(1, t.subtopicCount ?? 1)),
    0
  );
}

/** Group this subject's topics into ordered unit buckets (single source of truth). */
export function groupTopicsByUnit<T extends TopicLike>(
  topics: T[]
): { title: string; slug: string; topics: T[] }[] {
  const order: string[] = [];
  const grouped = new Map<string, T[]>();

  for (const topic of topics) {
    const title = unitKey(topic);
    if (!grouped.has(title)) {
      grouped.set(title, []);
      order.push(title);
    }
    grouped.get(title)!.push(topic);
  }

  return order.map((title) => ({
    title,
    slug: slugify(title) || "syllabus-topics",
    topics: grouped.get(title)!,
  }));
}

/** Rebuild nested units[] from this subject's flat topics only — never cross subjects. */
export function buildUnitsDocumentFromTopics(
  topics: TopicLike[],
  existingUnits?: IUnit[]
): IUnit[] {
  const labelBySlug = new Map<string, string>();
  for (const unit of existingUnits ?? []) {
    if (unit.unitLabel) {
      labelBySlug.set(unit.slug, unit.unitLabel);
    }
  }

  return groupTopicsByUnit(topics).map((group, index) => {
    const studyTopics = group.topics.filter(
      (t) => t.name.toLowerCase() !== group.title.toLowerCase()
    );
    const effective = studyTopics.length ? studyTopics : group.topics;
    const progress = calculateCompletion(effective);
    const estimatedMinutes = effective.reduce(
      (sum, t) => sum + getTopicEstimatedMinutes(t),
      0
    );

    return {
      title: group.title,
      slug: group.slug,
      unitLabel:
        labelBySlug.get(group.slug) ??
        (group.title !== "Syllabus Topics"
          ? `UNIT ${toRoman(index + 1)}`
          : undefined),
      progress,
      estimatedMinutes,
      difficulty: dominantDifficulty(effective),
      topics: effective.map(toUnitTopic),
    };
  });
}

function toRoman(n: number): string {
  const numerals = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  return numerals[n - 1] ?? String(n);
}

/** Detect stale units[] that no longer match this subject's topics. */
export function unitsAreInSync(units: IUnit[] | undefined, topics: ITopic[]): boolean {
  if (!topics.length) return !units?.length;
  if (!units?.length) return false;

  const expected = new Set(
    groupTopicsByUnit(topics).map((g) => g.slug)
  );
  const actual = new Set(units.map((u) => u.slug));

  if (expected.size !== actual.size) return false;
  for (const slug of expected) {
    if (!actual.has(slug)) return false;
  }

  for (const unit of units) {
    const unitTopics = topics.filter(
      (t) => slugify(unitKey(t)) === unit.slug
    );
    if (!unitTopics.length) return false;
    if (unit.title !== unitKey(unitTopics[0])) return false;
  }

  return true;
}

export interface UnitViewModel {
  title: string;
  slug: string;
  unitLabel?: string;
  mainTopicCount: number;
  subtopicCount: number;
  completedCount: number;
  progress: number;
  estimatedMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  topics: ITopic[];
  nextTopic?: ITopic;
}

/** Plain JSON-safe shape for Client Components (no Mongo ObjectIds). */
export interface SerializableUnitTopic {
  id: string;
  name: string;
  slug: string;
  completed: boolean;
  subtopicsList?: string[];
}

export interface SerializableUnitView {
  title: string;
  slug: string;
  unitLabel?: string;
  mainTopicCount: number;
  subtopicCount: number;
  completedCount: number;
  progress: number;
  estimatedMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  topics: SerializableUnitTopic[];
  nextTopic?: {
    id: string;
    slug: string;
    name: string;
  };
}

export function serializeUnitViews(views: UnitViewModel[]): SerializableUnitView[] {
  return views.map((unit) => ({
    title: unit.title,
    slug: unit.slug,
    unitLabel: unit.unitLabel,
    mainTopicCount: unit.mainTopicCount,
    subtopicCount: unit.subtopicCount,
    completedCount: unit.completedCount,
    progress: unit.progress,
    estimatedMinutes: unit.estimatedMinutes,
    difficulty: unit.difficulty,
    topics: unit.topics.map((t) => ({
      id: t._id?.toString() ?? t.slug,
      name: t.name,
      slug: t.slug,
      completed: t.completed,
      subtopicsList: t.subtopicsList,
    })),
    nextTopic: unit.nextTopic
      ? {
          id: unit.nextTopic._id?.toString() ?? unit.nextTopic.slug,
          slug: unit.nextTopic.slug,
          name: unit.nextTopic.name,
        }
      : undefined,
  }));
}

/** UI unit cards — always from this subject's topics[], not stale units[] titles. */
export function buildUnitViews(
  units: IUnit[] | undefined,
  flatTopics: ITopic[]
): UnitViewModel[] {
  if (!flatTopics.length) return [];

  const labelBySlug = new Map<string, string>();
  for (const unit of units ?? []) {
    if (unit.unitLabel) {
      labelBySlug.set(unit.slug, unit.unitLabel);
    }
  }

  return groupTopicsByUnit(flatTopics).map((group, index) => {
    const studyTopics = group.topics.filter(
      (t) => t.name.toLowerCase() !== group.title.toLowerCase()
    );
    const effective = studyTopics.length ? studyTopics : group.topics;
    const progress = calculateCompletion(effective);
    const nextTopic =
      effective.find((t) => !t.completed && t.revisionStatus === "in_progress") ??
      effective.find((t) => !t.completed);

    return {
      title: group.title,
      slug: group.slug,
      unitLabel:
        labelBySlug.get(group.slug) ??
        (group.title !== "Syllabus Topics"
          ? `UNIT ${toRoman(index + 1)}`
          : undefined),
      mainTopicCount: effective.length,
      subtopicCount: countNestedSubtopics(effective),
      completedCount: effective.filter((t) => t.completed).length,
      progress,
      estimatedMinutes: effective.reduce(
        (sum, t) => sum + getTopicEstimatedMinutes(t),
        0
      ),
      difficulty: dominantDifficulty(effective),
      topics: effective,
      nextTopic,
    };
  });
}

export function findUnitView(
  unitViews: UnitViewModel[],
  unitSlug: string
): UnitViewModel | undefined {
  return unitViews.find((u) => u.slug === unitSlug);
}
