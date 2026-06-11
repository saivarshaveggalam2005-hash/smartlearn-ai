/** Find the next incomplete study topic in syllabus order. */
export interface NextTopicRef {
  id: string;
  slug: string;
  name: string;
}

export function findNextStudyTopic(
  topics: { _id?: { toString(): string }; slug: string; name: string; completed?: boolean }[],
  currentTopicId: string
): NextTopicRef | undefined {
  const currentIndex = topics.findIndex(
    (t) => t._id?.toString() === currentTopicId
  );

  if (currentIndex >= 0) {
    for (let i = currentIndex + 1; i < topics.length; i++) {
      if (!topics[i].completed) {
        return {
          id: topics[i]._id!.toString(),
          slug: topics[i].slug,
          name: topics[i].name,
        };
      }
    }
  }

  for (const topic of topics) {
    const id = topic._id?.toString();
    if (id && id !== currentTopicId && !topic.completed) {
      return { id, slug: topic.slug, name: topic.name };
    }
  }

  return undefined;
}
