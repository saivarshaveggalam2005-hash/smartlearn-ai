import {
  isGenericUnitTitle,
  isMainSectionHeading,
  looksLikeSubtopicLine,
  segmentSyllabusLine,
} from "@/lib/syllabus-nlp";
import {
  isStructuralSyllabusNoise,
  splitSyllabusListItems,
  stripUnitMarkers,
} from "@/lib/syllabus-structure";

export interface ParsedTopicNode {
  title: string;
  subtopics: string[];
}

export interface ParsedUnit {
  title: string;
  unitLabel?: string;
  topics: ParsedTopicNode[];
}

export interface ParsedSyllabus {
  units: ParsedUnit[];
}

/** Stop parsing when syllabus content ends */
const STOP_SECTION_REGEX =
  /^(text\s*books?|reference\s*books?|bibliography|suggested\s*reading|recommended\s*books?|appendix|note\s*:|notes\s*:|course\s+outcomes?|program\s+outcomes?|contact\s+hours?|faculty\s+information)/i;

const PAGE_NUMBER_REGEX = /^\s*(?:page\s*)?\d+\s*(?:of\s+\d+)?\s*$/i;
const LEADING_ENUM_REGEX = /^[\d.)]+[\s.:)\-]+/;

const REPEATED_HEADER_REGEX =
  /^(?:scheme\s+of\s+instruction|course\s+(?:code|title)|department|faculty|university|college|branch|semester|regulation)/i;

/** Admin / metadata lines — NOT study topics */
const JUNK_LINE_PATTERNS: RegExp[] = [
  /batch(es)?\s+(admitted|from)/i,
  /scheme\s+of\s+instruction/i,
  /course\s+code/i,
  /course\s+title/i,
  /core\s*\/?\s*elective/i,
  /^\s*l\s+t\s+p\s+c\s*$/i,
  /^\s*c\s+p\s*$/i,
  /mvsrec/i,
  /mv\s*sr/i,
  /for\s+the\s+batch/i,
  /admitted\s+in/i,
  /regulation/i,
  /\(r-?\d+\)/i,
  /^\(?r-?\d+\)?$/i,
  /^u\d{2}[a-z]{2}\d{3}/i,
  /^\d{4}\s*[-–]\s*\d{2,4}$/,
  /hours\s+per\s+week/i,
  /total\s+(credits?|hours?)/i,
  /instruction\s+hours/i,
  /credits?\s+$/i,
  /course\s+outcomes?/i,
  /program\s+outcomes?/i,
  /contact\s+hours?/i,
  /faculty\s+information/i,
  /semester\s*$/i,
  /^elective\s*[-–]/i,
  /^program\s*:?\s*$/i,
  /^department/i,
  /^faculty/i,
  /^university/i,
  /^college/i,
  /^branch/i,
  /^name\s+of\s+the/i,
];

const UNIT_LINE_REGEX =
  /^(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*([IVXLC\d]+)\s*(.*)$/i;

const INLINE_UNIT_SPLIT_REGEX =
  /(?:^|\s)((?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+\s*:)/gi;

/** Remove noise from raw syllabus text */
export function cleanSyllabusText(text: string): string {
  const withUnitBreaks = text.replace(INLINE_UNIT_SPLIT_REGEX, "\n$1");

  const normalized = withUnitBreaks
    .replace(/\f/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/Page\s+\d+\s*(?:of\s+\d+)?/gi, "")
    .replace(/\[\s*\d+\s*\]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[^\w\s,;\-:().&/'\n]/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const lines = normalized
    .split("\n")
    .map((line) =>
      line
        .replace(/\s+\d{1,3}\s*$/, "")
        .replace(/\s+(mvsrec|information technology)\s*$/i, "")
        .trim()
    )
    .filter((line) => line.length > 0 && !PAGE_NUMBER_REGEX.test(line));

  const deduped: string[] = [];
  let prevKey = "";

  for (const line of lines) {
    const key = line.toLowerCase();
    if (key === prevKey) continue;
    if (
      REPEATED_HEADER_REGEX.test(line) &&
      deduped.some((l) => l.toLowerCase() === key)
    ) {
      continue;
    }
    deduped.push(line);
    prevKey = key;
  }

  return deduped.join("\n");
}

function normalizeTitle(text: string): string {
  return text
    .replace(LEADING_ENUM_REGEX, "")
    .replace(/^[-–—•·▪●]\s*/, "")
    .replace(/\.\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(text: string): string {
  const small = new Set(["and", "the", "for", "of", "on", "in", "to", "a", "an"]);
  return text
    .split(/\s+/)
    .map((word, i) => {
      if (/^[A-Z]{2,4}$/.test(word)) return word;
      if (i > 0 && small.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function dedupePreserveCase(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function isJunkLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (/\b(?:UNIT|CHAPTER|MODULE|PART|SECTION)\s*[-–—]?\s*[IVXLC\d]+/i.test(trimmed)) {
    return false;
  }
  if (JUNK_LINE_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (/^[\d()\s\-–—.]+$/.test(trimmed)) return true;
  if (/^[a-z]?\d{2}[a-z]{2,4}\d{3}[a-z]*$/i.test(trimmed.replace(/\s/g, "")))
    return true;

  const words = trimmed.split(/\s+/);
  if (
    words.length >= 4 &&
    words.filter((w) => w === w.toUpperCase() && w.length > 2).length >=
      words.length * 0.7
  ) {
    if (/scheme|instruction|course|batch|admitted|elective|code|title/i.test(trimmed))
      return true;
  }
  return false;
}

export function isValidTopic(topic: string): boolean {
  const t = normalizeTitle(topic);
  if (!t || t.length < 2 || t.length > 100) return false;
  if (isStructuralSyllabusNoise(t)) return false;
  if (isJunkLine(t)) return false;
  if (!/[a-zA-Z]{2,}/.test(t)) return false;
  if (STOP_SECTION_REGEX.test(t)) return false;
  if (/^u\d{2}[a-z]/i.test(t.replace(/\s/g, ""))) return false;
  if (/^[A-Z0-9]{2,6}$/.test(t.replace(/\s/g, ""))) {
    return !isStructuralSyllabusNoise(t);
  }
  if (t.length < 3) return false;
  return true;
}

function isUnitHeader(line: string): boolean {
  return UNIT_LINE_REGEX.test(line.trim());
}

function parseUnitHeader(line: string): { title: string; hasExplicitTitle: boolean } {
  const parsed = parseUnitLine(line);
  if (!parsed) return { title: "GENERAL", hasExplicitTitle: false };
  return {
    title: parsed.unitTitle,
    hasExplicitTitle: Boolean(parsed.unitTitle && !isGenericUnitTitle(parsed.unitTitle)),
  };
}

interface ParsedUnitLine {
  unitNum: string;
  unitTitle: string;
  unitLabel: string;
  body: string;
}

/** Split "UNIT-I: Title: nested topics..." into unit title + topic body */
function parseUnitLine(line: string): ParsedUnitLine | null {
  const match = line.trim().match(UNIT_LINE_REGEX);
  if (!match) return null;

  const unitNum = match[1];
  let rawRest = (match[2] ?? "").replace(/^:\s*/, "").trim();

  if (!rawRest) {
    return {
      unitNum,
      unitTitle: `UNIT ${unitNum.toUpperCase()}`,
      unitLabel: `UNIT ${unitNum.toUpperCase()}`,
      body: "",
    };
  }

  const firstColon = rawRest.indexOf(":");
  if (firstColon === -1) {
    const unitTitle = stripUnitMarkers(normalizeTitle(rawRest));
    return {
      unitNum,
      unitTitle: isValidTopic(unitTitle)
        ? titleCase(unitTitle)
        : `UNIT ${unitNum.toUpperCase()}`,
      unitLabel: `UNIT ${unitNum.toUpperCase()}`,
      body: "",
    };
  }

  let unitTitle = stripUnitMarkers(normalizeTitle(rawRest.slice(0, firstColon)));
  let body = stripUnitMarkers(rawRest.slice(firstColon + 1).trim());

  // Drop repeated unit title at the start of the body (common in UNIT-I style syllabi)
  const titleLower = unitTitle.toLowerCase();
  if (body.toLowerCase().startsWith(`${titleLower}:`)) {
    body = body.slice(unitTitle.length + 1).trim();
  } else if (body.toLowerCase().startsWith(`${titleLower},`)) {
    body = body.slice(unitTitle.length + 1).trim();
  }

  return {
    unitNum,
    unitTitle: isValidTopic(unitTitle)
      ? titleCase(unitTitle)
      : `UNIT ${unitNum.toUpperCase()}`,
    unitLabel: `UNIT ${unitNum.toUpperCase()}`,
    body,
  };
}

function parseTopicNodesFromUnitBody(body: string): ParsedTopicNode[] {
  const content = stripUnitMarkers(normalizeTitle(body));
  if (!content) return [];

  const colonBlocks = extractColonTopicBlocks(content);
  if (colonBlocks.length > 0) {
    return dedupeSubtopicsAcrossTopics(colonBlocks);
  }

  const multiColon = splitMultiColonSegments(content);
  if (multiColon.length > 0) {
    return dedupeSubtopicsAcrossTopics(multiColon);
  }

  const nodes = parseLineToTopicNodes(content);
  if (nodes.length) {
    return dedupeSubtopicsAcrossTopics(nodes);
  }

  const commaTopics = splitByDelimiters(content);
  if (commaTopics.length >= 2) {
    return dedupeSubtopicsAcrossTopics([
      { title: commaTopics[0], subtopics: commaTopics.slice(1) },
    ]);
  }

  if (commaTopics.length === 1 && isValidTopic(commaTopics[0])) {
    return [{ title: commaTopics[0], subtopics: [] }];
  }

  if (isValidTopic(content)) {
    return [{ title: titleCase(content), subtopics: [] }];
  }

  return [];
}

/** Split comma/semicolon/hyphen lists into subtopics */
function splitByDelimiters(text: string): string[] {
  const cleaned = stripUnitMarkers(text);
  return splitSyllabusListItems(cleaned)
    .map((part) => normalizeTitle(part))
    .filter(isValidTopic)
    .map((part) => titleCase(part));
}

/**
 * Join multiline "Topic:\nitem1,\nitem2" blocks into single-line "Topic: item1, item2".
 */
function preprocessMultilineTopicBlocks(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return text;

  const merged: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const headingOnly = line.match(/^(.+?):\s*$/);
    const headingWithStart = line.match(/^(.+?):\s*(.+)$/);

    if (headingOnly && i + 1 < lines.length) {
      const parts: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (isUnitHeader(next) || STOP_SECTION_REGEX.test(next)) break;
        if (/^[A-Za-z][^:]{1,80}:\s*(\S|$)/.test(next) && !/^[^:]*,\s*$/.test(next)) {
          break;
        }
        if (isMainSectionHeading(next) && !/[,;]/.test(next)) break;
        parts.push(next.replace(/,\s*$/, "").trim());
        j++;
        if (!next.trim().endsWith(",") && j < lines.length) {
          const peek = lines[j];
          if (/^[A-Za-z][^:]{1,80}:\s*/.test(peek)) break;
        }
      }
      if (parts.length > 0) {
        merged.push(`${headingOnly[1]}: ${parts.join(", ")}`);
        i = j;
        continue;
      }
    }

    if (headingWithStart && headingWithStart[2].trim().endsWith(",")) {
      const parts = [headingWithStart[2].replace(/,\s*$/, "").trim()];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (isUnitHeader(next) || /^[A-Za-z][^:]{1,80}:\s*/.test(next)) break;
        parts.push(next.replace(/,\s*$/, "").trim());
        j++;
      }
      merged.push(`${headingWithStart[1]}: ${parts.join(", ")}`);
      i = j;
      continue;
    }

    merged.push(line);
    i++;
  }

  return merged.join("\n");
}

/** Extract all "Topic: sub1, sub2, ..." blocks from unit text */
function extractColonTopicBlocks(text: string): ParsedTopicNode[] {
  const preprocessed = preprocessMultilineTopicBlocks(stripUnitMarkers(text));
  const results: ParsedTopicNode[] = [];

  const blocks = preprocessed.split(/\n+/).flatMap((line) => {
    if (!line.includes(":")) return [line];
    return line.split(/,\s*(?=[A-Za-z][^,]{2,80}:\s*)/);
  });

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed.includes(":")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) continue;

    const heading = normalizeTitle(trimmed.slice(0, colonIdx));
    const body = trimmed.slice(colonIdx + 1).trim();
    const subs = dedupePreserveCase(splitByDelimiters(body).filter(isValidTopic));

    if (!isValidTopic(heading)) continue;
    if (subs.length === 0 && !body.includes(",")) continue;

    results.push({
      title: titleCase(heading),
      subtopics: subs,
    });
  }

  return results;
}

/** Remove duplicate subtopics across topics within one unit */
function dedupeSubtopicsAcrossTopics(topics: ParsedTopicNode[]): ParsedTopicNode[] {
  const seenSubs = new Set<string>();
  const seenTopics = new Set<string>();

  return topics
    .map((node) => {
      const topicKey = node.title.toLowerCase();
      if (seenTopics.has(topicKey)) return null;
      seenTopics.add(topicKey);

      const uniqueSubs = node.subtopics.filter((sub) => {
        const subKey = sub.toLowerCase();
        if (subKey === topicKey) return false;
        if (seenSubs.has(subKey)) return false;
        seenSubs.add(subKey);
        return isValidTopic(sub);
      });

      return {
        title: node.title,
        subtopics: uniqueSubs,
      };
    })
    .filter((n): n is ParsedTopicNode => n !== null && isValidTopic(n.title));
}

/** Handle lines with one or more "Heading: sub1, sub2, ..." segments */
function splitMultiColonSegments(line: string): ParsedTopicNode[] {
  const segments = line.split(/,\s*(?=[A-Za-z][^,]{2,80}:\s*)/);
  const results: ParsedTopicNode[] = [];

  for (const segment of segments) {
    const colonIdx = segment.indexOf(":");
    if (colonIdx === -1) continue;

    const heading = normalizeTitle(segment.slice(0, colonIdx));
    const body = segment.slice(colonIdx + 1).trim();
    const subs = dedupePreserveCase(
      splitByDelimiters(body).filter(isValidTopic)
    );

    if (isValidTopic(heading)) {
      results.push({ title: titleCase(heading), subtopics: subs });
    }
  }

  return results;
}

/** Expand one raw line into multiple syllabus lines (PDF collapse recovery) */
function expandRawLines(lines: string[]): string[] {
  const expanded: string[] = [];

  for (const line of lines) {
    if (isUnitHeader(line) || isJunkLine(line) || isMainSectionHeading(line)) {
      expanded.push(line);
      continue;
    }

    const wordCount = line.split(/\s+/).length;
    const hasStructuredDelimiters = /[,;:]/.test(line);
    const hasHyphenList = /[-–—]/.test(line) && hasStructuredDelimiters;

    if (hasStructuredDelimiters || hasHyphenList) {
      expanded.push(line);
      continue;
    }

    if (line.length > 55 || wordCount > 8) {
      const segments = segmentSyllabusLine(line);
      if (segments.length > 1) {
        expanded.push(...segments);
        continue;
      }
    }

    expanded.push(line);
  }

  return expanded;
}

/** Parse one line into topic + subtopic hierarchy */
export function parseLineToTopicNodes(line: string): ParsedTopicNode[] {
  const content = normalizeTitle(line);
  if (!content || isUnitHeader(content) || isJunkLine(content)) return [];
  if (STOP_SECTION_REGEX.test(content)) return [];

  const colonBlocks = extractColonTopicBlocks(content);
  if (colonBlocks.length > 0) {
    return dedupeSubtopicsAcrossTopics(colonBlocks);
  }

  const singleColon = content.match(/^(.+?):\s+(.+)$/);
  if (singleColon) {
    const parent = normalizeTitle(singleColon[1]);
    const subs = dedupePreserveCase(
      splitByDelimiters(singleColon[2]).filter(isValidTopic)
    );
    if (isValidTopic(parent) && subs.length > 0) {
      return [{ title: titleCase(parent), subtopics: subs }];
    }
    if (isValidTopic(parent) && subs.length === 0) {
      const bodyTopics = splitByDelimiters(singleColon[2]);
      if (bodyTopics.length) {
        return [{ title: titleCase(parent), subtopics: bodyTopics }];
      }
      return [{ title: titleCase(parent), subtopics: [] }];
    }
  }

  const colonTopics = splitMultiColonSegments(content);
  if (colonTopics.length) {
    return colonTopics;
  }

  const nestedColonParts = content.split(/:\s*/).map((part) => normalizeTitle(part)).filter(Boolean);
  if (nestedColonParts.length === 2 && nestedColonParts[1].includes(",")) {
    const parent = nestedColonParts[0];
    const subs = dedupePreserveCase(
      splitByDelimiters(nestedColonParts[1]).filter(isValidTopic)
    );
    if (isValidTopic(parent) && subs.length > 0) {
      return [{ title: titleCase(parent), subtopics: subs }];
    }
  }

  if (nestedColonParts.length > 1) {
    const nodes: ParsedTopicNode[] = [];
    for (let i = 0; i < nestedColonParts.length; i++) {
      const part = nestedColonParts[i];
      if (part.includes(",")) {
        const subs = splitByDelimiters(part).filter(isValidTopic);
        if (nodes.length > 0 && subs.length >= 2) {
          const last = nodes[nodes.length - 1];
          last.subtopics = dedupePreserveCase([...last.subtopics, ...subs]);
        } else {
          nodes.push(
            ...subs.map((title) => ({
              title,
              subtopics: [] as string[],
            }))
          );
        }
        continue;
      }
      const next = nestedColonParts[i + 1];
      if (next && next.includes(",")) {
        nodes.push({
          title: titleCase(part),
          subtopics: dedupePreserveCase(splitByDelimiters(next).filter(isValidTopic)),
        });
        i++;
        continue;
      }
      if (isValidTopic(part)) {
        nodes.push({ title: titleCase(part), subtopics: [] });
      }
    }
    if (nodes.length) return nodes;
  }

  const hyphenMatch = content.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (hyphenMatch) {
    const parent = normalizeTitle(hyphenMatch[1]);
    const subs = dedupePreserveCase(
      splitByDelimiters(hyphenMatch[2]).filter(isValidTopic)
    );
    if (isValidTopic(parent) && subs.length > 0) {
      return [{ title: titleCase(parent), subtopics: subs }];
    }
    if (isValidTopic(parent) && subs.length === 0) {
      const bodyTopics = splitByDelimiters(hyphenMatch[2]);
      if (bodyTopics.length >= 2) {
        return [{ title: titleCase(parent), subtopics: bodyTopics }];
      }
    }
  }

  if (/[,;]/.test(content)) {
    const flat = splitByDelimiters(content);
    if (flat.length >= 2) {
      return [{ title: titleCase(flat[0]), subtopics: flat.slice(1) }];
    }
  }

  if (!content.includes(",") && /[-–—]/.test(content)) {
    const hyphenParts = content
      .split(/\s*[-–—]\s+/)
      .map((part) => normalizeTitle(part))
      .filter(isValidTopic);
    if (hyphenParts.length >= 2) {
      return hyphenParts.map((part) => ({
        title: titleCase(part),
        subtopics: [] as string[],
      }));
    }
  }

  if (isValidTopic(content)) {
    return [{ title: titleCase(content), subtopics: [] }];
  }

  return [];
}

/** Split a syllabus content line into individual study subtopics (flat) */
export function splitTopicLine(line: string): string[] {
  return parseLineToTopicNodes(line).flatMap((node) =>
    node.subtopics.length > 0 ? node.subtopics : [node.title]
  );
}

function finalizeUnit(unit: ParsedUnit | null): ParsedUnit | null {
  if (!unit) return null;

  const unitTitleKey = unit.title.toLowerCase();
  const seenTopic = new Set<string>();
  const seenSubtopic = new Set<string>();

  unit.topics = unit.topics
    .map((node) => ({
      title: titleCase(node.title),
      subtopics: dedupePreserveCase(
        node.subtopics
          .filter(isValidTopic)
          .map((s) => titleCase(s))
          .filter((sub) => {
            const subKey = sub.toLowerCase();
            if (subKey === node.title.toLowerCase()) return false;
            if (seenSubtopic.has(subKey)) return false;
            seenSubtopic.add(subKey);
            return true;
          })
      ),
    }))
    .filter((node) => {
      if (
        node.subtopics.length === 0 &&
        node.title.toLowerCase() === unitTitleKey
      ) {
        return false;
      }
      const key = node.title.toLowerCase();
      if (seenTopic.has(key)) return false;
      seenTopic.add(key);
      return isValidTopic(node.title);
    });

  if (unit.topics.length > 0) return unit;
  if (unit.title && !isGenericUnitTitle(unit.title)) {
    return unit;
  }
  return null;
}

function mergeUnits(units: ParsedUnit[]): ParsedUnit[] {
  const dedupedUnits: ParsedUnit[] = [];
  const seenUnitTitles = new Set<string>();

  for (const unit of units) {
    const key = unit.title.toLowerCase();
    if (seenUnitTitles.has(key)) {
      const existing = dedupedUnits.find((u) => u.title.toLowerCase() === key);
      if (existing) {
        for (const node of unit.topics) {
          const match = existing.topics.find(
            (t) => t.title.toLowerCase() === node.title.toLowerCase()
          );
          if (match) {
            match.subtopics = dedupePreserveCase([
              ...match.subtopics,
              ...node.subtopics,
            ]);
          } else {
            existing.topics.push(node);
          }
        }
        const seen = new Set<string>();
        existing.topics = existing.topics.filter((n) => {
          const topicKey = n.title.toLowerCase();
          if (seen.has(topicKey)) return false;
          seen.add(topicKey);
          return true;
        });
      }
      continue;
    }
    seenUnitTitles.add(key);
    dedupedUnits.push(unit);
  }

  return dedupedUnits;
}

/**
 * Parse syllabus text into hierarchical units and subtopics.
 * Uses section-heading detection so detailed lines under UNIT headers
 * become study topics instead of only major headings.
 */
export function parseHierarchicalSyllabus(text: string): ParsedSyllabus {
  const cleaned = cleanSyllabusText(text);
  const rawLines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines = expandRawLines(rawLines);

  const units: ParsedUnit[] = [];
  let currentUnit: ParsedUnit | null = null;
  let foundFirstUnit = false;
  let awaitingUnitTitle = false;

  const pushCurrentUnit = () => {
    const finalized = finalizeUnit(currentUnit);
    if (finalized) units.push(finalized);
    currentUnit = null;
    awaitingUnitTitle = false;
  };

  const ensureUnit = () => {
    if (!currentUnit) {
      currentUnit = { title: "SYLLABUS TOPICS", topics: [] };
    }
  };

  const addTopicNodes = (nodes: ParsedTopicNode[]) => {
    if (!nodes.length) return;
    ensureUnit();
    currentUnit!.topics.push(...nodes);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (STOP_SECTION_REGEX.test(line)) break;
    if (isJunkLine(line) && !isUnitHeader(line)) continue;

    if (isUnitHeader(line)) {
      foundFirstUnit = true;
      pushCurrentUnit();

      const parsedUnit = parseUnitLine(line);
      if (parsedUnit) {
        currentUnit = {
          title: parsedUnit.unitTitle,
          unitLabel: parsedUnit.unitLabel,
          topics: [],
        };
        awaitingUnitTitle =
          !parsedUnit.unitTitle || isGenericUnitTitle(parsedUnit.unitTitle);
        if (parsedUnit.body) {
          addTopicNodes(parseTopicNodesFromUnitBody(parsedUnit.body));
        }
      } else {
        const parsedHeader = parseUnitLine(line);
        const { title, hasExplicitTitle } = parseUnitHeader(line);
        currentUnit = {
          title,
          unitLabel: parsedHeader?.unitLabel,
          topics: [],
        };
        awaitingUnitTitle = !hasExplicitTitle && isGenericUnitTitle(title);
      }
      continue;
    }

    if (!foundFirstUnit) continue;

    if (awaitingUnitTitle && currentUnit) {
      const unitTitleLine = titleCase(normalizeTitle(line));
      if (isValidTopic(unitTitleLine) && !isUnitHeader(line)) {
        currentUnit.title = unitTitleLine;
        awaitingUnitTitle = false;
        continue;
      }
    }

    if (isMainSectionHeading(line)) {
      const sectionTitle = titleCase(normalizeTitle(line));

      if (awaitingUnitTitle || (currentUnit && isGenericUnitTitle(currentUnit.title))) {
        currentUnit!.title = sectionTitle;
        awaitingUnitTitle = false;
        continue;
      }

      const pendingLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (
          STOP_SECTION_REGEX.test(next) ||
          isUnitHeader(next) ||
          isMainSectionHeading(next)
        ) {
          break;
        }
        if (isJunkLine(next)) {
          j++;
          continue;
        }
        if (looksLikeSubtopicLine(next)) {
          pendingLines.push(next);
          j++;
          continue;
        }
        break;
      }

      if (pendingLines.length > 0) {
        const subtopics = dedupePreserveCase(
          pendingLines.flatMap((pl) =>
            parseLineToTopicNodes(pl).flatMap((node) =>
              node.subtopics.length > 0 ? node.subtopics : [node.title]
            )
          )
        );
        addTopicNodes([
          {
            title: sectionTitle,
            subtopics,
          },
        ]);
        i = j - 1;
      } else {
        addTopicNodes([{ title: sectionTitle, subtopics: [] }]);
      }
      continue;
    }

    ensureUnit();

    const colonHeading = line.match(/^(.+?):\s*$/);
    if (colonHeading && i + 1 < lines.length) {
      const listParts: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (
          isUnitHeader(next) ||
          STOP_SECTION_REGEX.test(next) ||
          isMainSectionHeading(next)
        ) {
          break;
        }
        if (/^[A-Za-z][^:]{1,80}:\s*(\S|$)/.test(next) && !/^[^:]*,\s*$/.test(next)) {
          break;
        }
        if (isJunkLine(next)) {
          j++;
          continue;
        }
        listParts.push(next.replace(/,\s*$/, "").trim());
        j++;
      }
      if (listParts.length > 0) {
        const blockText = `${colonHeading[1]}: ${listParts.join(", ")}`;
        const nodes = extractColonTopicBlocks(blockText);
        if (nodes.length > 0) {
          addTopicNodes(nodes);
          i = j - 1;
          continue;
        }
      }
    }

    const inlineColon = line.match(/^(.+?):\s*(.+)$/);
    if (inlineColon && /[,;]/.test(inlineColon[2])) {
      let listText = inlineColon[2].trim();
      let j = i + 1;
      while (j < lines.length && lines[j].trim().endsWith(",")) {
        listText += ", " + lines[j].replace(/,\s*$/, "").trim();
        j++;
      }
      const blockText = `${inlineColon[1]}: ${listText}`;
      const nodes = extractColonTopicBlocks(blockText);
      if (nodes.length > 0) {
        addTopicNodes(nodes);
        i = j - 1;
        continue;
      }
    }

    const topicNodes = parseLineToTopicNodes(line);
    if (topicNodes.length) {
      addTopicNodes(topicNodes);
      continue;
    }

    if (looksLikeSubtopicLine(line) && isValidTopic(line) && currentUnit!.topics.length > 0) {
      const lastTopic = currentUnit!.topics[currentUnit!.topics.length - 1];
      const sub = titleCase(normalizeTitle(line));
      if (
        !lastTopic.subtopics.some((s) => s.toLowerCase() === sub.toLowerCase()) &&
        sub.toLowerCase() !== lastTopic.title.toLowerCase()
      ) {
        lastTopic.subtopics.push(sub);
      }
      continue;
    }

    if (looksLikeSubtopicLine(line) && isValidTopic(line)) {
      addTopicNodes([{ title: titleCase(normalizeTitle(line)), subtopics: [] }]);
    }
  }

  pushCurrentUnit();

  return { units: mergeUnits(units) };
}

export function parseSyllabusWithFallback(text: string): ParsedSyllabus {
  const parsed = parseHierarchicalSyllabus(text);
  const totalMainTopics = parsed.units.reduce((sum, u) => sum + u.topics.length, 0);
  const totalItems = parsed.units.reduce(
    (sum, u) =>
      sum +
      u.topics.reduce(
        (t, n) => t + (n.subtopics.length > 0 ? n.subtopics.length : 1),
        0
      ),
    0
  );

  if (totalMainTopics >= 2 || totalItems >= 3) return parsed;

  const cleaned = cleanSyllabusText(text);
  const rawLines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines = expandRawLines(rawLines);
  const uniqueNodes: ParsedTopicNode[] = [];
  const seen = new Set<string>();
  let inUnit = false;
  let unitTitle = "SYLLABUS TOPICS";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (STOP_SECTION_REGEX.test(line)) break;

    if (isUnitHeader(line)) {
      inUnit = true;
      const parsedUnit = parseUnitLine(line);
      if (parsedUnit) {
        unitTitle = parsedUnit.unitTitle;
        if (parsedUnit.body) {
          for (const node of parseTopicNodesFromUnitBody(parsedUnit.body)) {
            const key = node.title.toLowerCase();
            if (seen.has(key)) {
              const existing = uniqueNodes.find(
                (n) => n.title.toLowerCase() === key
              );
              if (existing) {
                existing.subtopics = dedupePreserveCase([
                  ...existing.subtopics,
                  ...node.subtopics,
                ]);
              }
              continue;
            }
            seen.add(key);
            uniqueNodes.push(node);
          }
        }
      } else {
        const { title, hasExplicitTitle } = parseUnitHeader(line);
        unitTitle = title;
        if (
          !hasExplicitTitle &&
          i + 1 < lines.length &&
          isMainSectionHeading(lines[i + 1])
        ) {
          unitTitle = titleCase(normalizeTitle(lines[i + 1]));
          i++;
        }
      }
      continue;
    }

    if (!inUnit || isJunkLine(line)) continue;

    if (isMainSectionHeading(line)) {
      const sectionTitle = titleCase(normalizeTitle(line));
      const pending: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (
          STOP_SECTION_REGEX.test(next) ||
          isUnitHeader(next) ||
          isMainSectionHeading(next)
        ) {
          break;
        }
        if (!isJunkLine(next) && looksLikeSubtopicLine(next)) {
          pending.push(next);
        }
        j++;
      }

      for (const pl of pending) {
        for (const node of parseLineToTopicNodes(pl)) {
          const key = node.title.toLowerCase();
          if (seen.has(key)) {
            const existing = uniqueNodes.find(
              (n) => n.title.toLowerCase() === key
            );
            if (existing) {
              existing.subtopics = dedupePreserveCase([
                ...existing.subtopics,
                ...node.subtopics,
              ]);
            }
            continue;
          }
          seen.add(key);
          uniqueNodes.push(node);
        }
      }

      if (pending.length === 0) {
        const key = sectionTitle.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueNodes.push({ title: sectionTitle, subtopics: [] });
        }
      }

      i = j - 1;
      continue;
    }

    if (
      line.includes(":") ||
      line.includes(",") ||
      line.includes("-") ||
      line.includes(";")
    ) {
      for (const node of parseLineToTopicNodes(line)) {
        const key = node.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueNodes.push(node);
      }
    } else if (isValidTopic(line)) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNodes.push({
          title: titleCase(normalizeTitle(line)),
          subtopics: [],
        });
      }
    }
  }

  if (uniqueNodes.length >= 3) {
    return { units: [{ title: unitTitle, topics: uniqueNodes }] };
  }

  return parsed;
}
