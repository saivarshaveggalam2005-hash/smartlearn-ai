/**
 * Phase 2 — Prerequisite learning graph (DAG) from syllabus order + NLP overlap.
 */

export interface GraphTopicRef {
  slug: string;
  name: string;
  unitTitle?: string;
  keywords?: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3)
  );
}

function sharesConcept(a: string, b: string): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  return false;
}

function keywordOverlap(keywords: string[] | undefined, title: string): boolean {
  if (!keywords?.length) return false;
  const titleTokens = tokenize(title);
  return keywords.some((k) => {
    const kt = k.toLowerCase();
    return titleTokens.has(kt) || title.toLowerCase().includes(kt);
  });
}

/** Infer prerequisites from unit order and keyword/title overlap. */
export function buildLearningGraph(
  topics: GraphTopicRef[]
): Map<string, { prerequisites: string[]; dependents: string[] }> {
  const graph = new Map<string, { prerequisites: string[]; dependents: string[] }>();

  for (const topic of topics) {
    graph.set(topic.slug, { prerequisites: [], dependents: [] });
  }

  const byUnit = new Map<string, GraphTopicRef[]>();
  for (const topic of topics) {
    const key = topic.unitTitle?.trim() || "__default__";
    const list = byUnit.get(key) ?? [];
    list.push(topic);
    byUnit.set(key, list);
  }

  for (const unitTopics of byUnit.values()) {
    for (let i = 1; i < unitTopics.length; i++) {
      const prev = unitTopics[i - 1];
      const curr = unitTopics[i];
      const prevEntry = graph.get(prev.slug)!;
      const currEntry = graph.get(curr.slug)!;

      if (!currEntry.prerequisites.includes(prev.slug)) {
        currEntry.prerequisites.push(prev.slug);
      }
      if (!prevEntry.dependents.includes(curr.slug)) {
        prevEntry.dependents.push(curr.slug);
      }
    }
  }

  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i];
      const b = topics[j];
      if (a.unitTitle && b.unitTitle && a.unitTitle !== b.unitTitle) continue;

      if (sharesConcept(b.name, a.name) || keywordOverlap(b.keywords, a.name)) {
        const bEntry = graph.get(b.slug)!;
        const aEntry = graph.get(a.slug)!;
        if (!bEntry.prerequisites.includes(a.slug)) {
          bEntry.prerequisites.push(a.slug);
        }
        if (!aEntry.dependents.includes(b.slug)) {
          aEntry.dependents.push(b.slug);
        }
      }
    }
  }

  return graph;
}

export function isTopicUnlocked(
  topicSlug: string,
  graph: Map<string, { prerequisites: string[]; dependents: string[] }>,
  completedSlugs: Set<string>
): boolean {
  const entry = graph.get(topicSlug);
  if (!entry?.prerequisites.length) return true;
  return entry.prerequisites.every((pre) => completedSlugs.has(pre));
}

export function topologicalStudyOrder(
  topics: GraphTopicRef[],
  graph: Map<string, { prerequisites: string[]; dependents: string[] }>
): GraphTopicRef[] {
  const slugToTopic = new Map(topics.map((t) => [t.slug, t]));
  const inDegree = new Map<string, number>();
  for (const t of topics) {
    inDegree.set(t.slug, graph.get(t.slug)?.prerequisites.length ?? 0);
  }

  const queue = topics.filter((t) => (inDegree.get(t.slug) ?? 0) === 0);
  const ordered: GraphTopicRef[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    ordered.push(current);
    const deps = graph.get(current.slug)?.dependents ?? [];
    for (const dep of deps) {
      const deg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) {
        const topic = slugToTopic.get(dep);
        if (topic) queue.push(topic);
      }
    }
  }

  if (ordered.length < topics.length) {
    for (const t of topics) {
      if (!ordered.some((o) => o.slug === t.slug)) ordered.push(t);
    }
  }

  return ordered;
}
