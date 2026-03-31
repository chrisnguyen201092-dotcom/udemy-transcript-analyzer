/**
 * Pattern matching logic for chapter detection.
 * Extracted from split-chapters.ts for modularity + confidence scoring.
 *
 * Each pattern has a confidence score (0–1) indicating reliability:
 * - 0.95: Keyword (Chapter/Chương/Phần/Part)
 * - 0.90: Bài/Lesson + number
 * - 0.90: Markdown H1
 * - 0.80: Roman numeral (I. II. III.)
 * - 0.75: Numbered heading (1. Title)
 * - 0.60: ALL CAPS
 * - 0.40: Dash separator (---, ===)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type PatternType =
  | "keyword"
  | "lesson"
  | "markdown-h1"
  | "roman"
  | "numbered"
  | "all-caps"
  | "dash-separator";

export interface PatternMatch {
  /** Line index of the heading line. */
  lineIndex: number;
  /** Last line consumed (> lineIndex when subtitle joined). */
  lastLineIndex: number;
  title: string;
  /** True when a subtitle line was merged. */
  hasSubtitle: boolean;
  /** Confidence score 0–1 for this pattern type. */
  confidence: number;
  /** Which pattern family matched. */
  patternType: PatternType;
}

/** Confidence scores per pattern family. */
const CONFIDENCE: Record<PatternType, number> = {
  keyword: 0.95,
  lesson: 0.90,
  "markdown-h1": 0.90,
  roman: 0.80,
  numbered: 0.75,
  "all-caps": 0.60,
  "dash-separator": 0.40,
};

// ── Regexes ────────────────────────────────────────────────────────────────

/** Chapter/Chương/Phần/Part followed by a number. */
export const KEYWORD_HEADING_RE =
  /^(chapter|chương|phần|part)\s+\d+/i;

/** Bare keyword heading: keyword + number + optional trailing punctuation only. */
export const BARE_KEYWORD_RE =
  /^(chapter|chương|phần|part)\s+\d+[.):]?\s*$/i;

/** Extract chapter number from keyword heading. */
export const KEYWORD_NUMBER_RE =
  /^(?:chapter|chương|phần|part)\s+(\d+)/i;

/** Bài/Lesson + number (Vietnamese lesson format). */
export const LESSON_HEADING_RE =
  /^(bài|lesson)\s+\d+/i;

/** Bare lesson heading for subtitle joining. */
export const BARE_LESSON_RE =
  /^(bài|lesson)\s+\d+[.):]?\s*$/i;

/** Extract lesson number. */
export const LESSON_NUMBER_RE =
  /^(?:bài|lesson)\s+(\d+)/i;

/** Numbered heading: "1. Title", "1.1 Title", "1) Title" */
export const NUMBERED_HEADING_RE = /^\d+(?:\.\d+)*[.)]\s+\S/;

/** Markdown H1 only (not H2+). */
export const MARKDOWN_H1_RE = /^# (.+)$/;

/**
 * Roman numeral heading: I. / II. / III. / IV. etc. followed by text.
 * Requires punctuation (. or )) after the numeral to reduce false positives.
 */
export const ROMAN_HEADING_RE =
  /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})[.)]\s+\S/i;

/** Validate that a roman numeral string is non-empty. */
function isValidRoman(line: string): boolean {
  const m = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})[.)]/i.exec(
    line.trim()
  );
  if (!m) return false;
  // At least one capture group must be non-empty (avoid matching empty string)
  return (m[1] + m[2] + m[3] + m[4]).length > 0;
}

/** Dash/equal separator lines (3+ consecutive dashes or equals). */
export const DASH_SEPARATOR_RE = /^[-=]{3,}\s*$/;

// ── Helpers ────────────────────────────────────────────────────────────────

/** ALL CAPS line shorter than 60 characters (trimmed). */
export function isAllCapsHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;
  const hasLetter = /[A-Z]/.test(trimmed);
  if (!hasLetter) return false;
  return !/[a-z]/.test(trimmed);
}

/**
 * Return true if a line looks like a subtitle for a bare heading.
 * Non-empty, ≤ 120 chars, not itself a heading pattern.
 */
export function isSubtitleLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 120) return false;
  if (KEYWORD_HEADING_RE.test(t)) return false;
  if (LESSON_HEADING_RE.test(t)) return false;
  if (NUMBERED_HEADING_RE.test(t)) return false;
  if (MARKDOWN_H1_RE.test(t)) return false;
  return true;
}

/** Return index of next non-empty line at or after `start`, or -1. */
export function findNextNonEmpty(lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim().length > 0) return i;
  }
  return -1;
}

/** Return true if there is at least one blank line strictly between a and b. */
export function hasBlankLineBetween(
  lines: string[],
  a: number,
  b: number
): boolean {
  for (let i = a + 1; i < b; i++) {
    if (lines[i].trim().length === 0) return true;
  }
  return false;
}

// ── Subtitle join helper ───────────────────────────────────────────────────

interface SubtitleJoinResult {
  title: string;
  lastLineIndex: number;
  hasSubtitle: boolean;
  /** How many lines the caller should skip (0 if no subtitle joined). */
  skipLines: number;
}

function trySubtitleJoin(
  lines: string[],
  lineIndex: number,
  baseLine: string,
  bareRe: RegExp
): SubtitleJoinResult {
  if (!bareRe.test(baseLine)) {
    return { title: baseLine, lastLineIndex: lineIndex, hasSubtitle: false, skipLines: 0 };
  }

  const nextIdx = findNextNonEmpty(lines, lineIndex + 1);
  if (
    nextIdx !== -1 &&
    !hasBlankLineBetween(lines, lineIndex, nextIdx) &&
    isSubtitleLine(lines[nextIdx])
  ) {
    const cleaned = baseLine.replace(/[.:]?\s*$/, "");
    return {
      title: `${cleaned}. ${lines[nextIdx].trim()}`,
      lastLineIndex: nextIdx,
      hasSubtitle: true,
      skipLines: nextIdx - lineIndex,
    };
  }

  return { title: baseLine, lastLineIndex: lineIndex, hasSubtitle: false, skipLines: 0 };
}

// ── Core: matchPatterns ────────────────────────────────────────────────────

/**
 * Scan lines and collect heading matches grouped by pattern family.
 * Returns ALL matches across all pattern types, grouped by family.
 * The caller (split-chapters.ts) decides priority/selection.
 */
export function matchPatterns(lines: string[]): Record<PatternType, PatternMatch[]> {
  const groups: Record<PatternType, PatternMatch[]> = {
    keyword: [],
    lesson: [],
    "markdown-h1": [],
    roman: [],
    numbered: [],
    "all-caps": [],
    "dash-separator": [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    // ── Keyword heading ──────────────────────────────────────────────────
    if (KEYWORD_HEADING_RE.test(line)) {
      const join = trySubtitleJoin(lines, i, line, BARE_KEYWORD_RE);
      groups.keyword.push({
        lineIndex: i,
        lastLineIndex: join.lastLineIndex,
        title: join.title,
        hasSubtitle: join.hasSubtitle,
        confidence: CONFIDENCE.keyword,
        patternType: "keyword",
      });
      if (join.skipLines > 0) i += join.skipLines;
      continue;
    }

    // ── Lesson heading (Bài/Lesson) ──────────────────────────────────────
    if (LESSON_HEADING_RE.test(line)) {
      const join = trySubtitleJoin(lines, i, line, BARE_LESSON_RE);
      groups.lesson.push({
        lineIndex: i,
        lastLineIndex: join.lastLineIndex,
        title: join.title,
        hasSubtitle: join.hasSubtitle,
        confidence: CONFIDENCE.lesson,
        patternType: "lesson",
      });
      if (join.skipLines > 0) i += join.skipLines;
      continue;
    }

    // ── Markdown H1 ──────────────────────────────────────────────────────
    const h1Match = MARKDOWN_H1_RE.exec(line);
    if (h1Match) {
      groups["markdown-h1"].push({
        lineIndex: i,
        lastLineIndex: i,
        title: h1Match[1],
        hasSubtitle: false,
        confidence: CONFIDENCE["markdown-h1"],
        patternType: "markdown-h1",
      });
      continue;
    }

    // ── Roman numeral heading ────────────────────────────────────────────
    if (ROMAN_HEADING_RE.test(line) && isValidRoman(line)) {
      const title = line.replace(
        /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})[.)]\s+/i,
        ""
      );
      groups.roman.push({
        lineIndex: i,
        lastLineIndex: i,
        title,
        hasSubtitle: false,
        confidence: CONFIDENCE.roman,
        patternType: "roman",
      });
      continue;
    }

    // ── Numbered heading ─────────────────────────────────────────────────
    if (NUMBERED_HEADING_RE.test(line)) {
      const title = line.replace(/^\d+(?:\.\d+)*[.)]\s+/, "");
      groups.numbered.push({
        lineIndex: i,
        lastLineIndex: i,
        title,
        hasSubtitle: false,
        confidence: CONFIDENCE.numbered,
        patternType: "numbered",
      });
      continue;
    }

    // ── ALL CAPS ─────────────────────────────────────────────────────────
    if (isAllCapsHeading(line)) {
      groups["all-caps"].push({
        lineIndex: i,
        lastLineIndex: i,
        title: line,
        hasSubtitle: false,
        confidence: CONFIDENCE["all-caps"],
        patternType: "all-caps",
      });
      continue;
    }

    // ── Dash separator ───────────────────────────────────────────────────
    if (DASH_SEPARATOR_RE.test(line)) {
      // Use the next non-empty line as the title (if exists)
      const nextIdx = findNextNonEmpty(lines, i + 1);
      const title =
        nextIdx !== -1 ? lines[nextIdx].trim() : `Section at line ${i + 1}`;
      groups["dash-separator"].push({
        lineIndex: i,
        lastLineIndex: i,
        title,
        hasSubtitle: false,
        confidence: CONFIDENCE["dash-separator"],
        patternType: "dash-separator",
      });
    }
  }

  return groups;
}

/**
 * Utility: get confidence score for a pattern type.
 */
export function getConfidence(patternType: PatternType): number {
  return CONFIDENCE[patternType];
}
