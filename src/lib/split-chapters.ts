/**
 * Heuristic chapter detection orchestrator.
 * Covers B-17: Tự động chia theo heading (Heuristic)
 *
 * Pattern matching logic lives in `split-patterns.ts`.
 * This module handles:
 *   - Pattern priority selection (keyword > lesson > markdown-h1 > roman > numbered > all-caps > dash-separator)
 *   - Keyword guards (monotonic + minimum-content)
 *   - Chapter boundary construction
 *   - Confidence aggregation
 */

import {
  type PatternMatch,
  type PatternType,
  matchPatterns,
  KEYWORD_NUMBER_RE,
  LESSON_NUMBER_RE,
} from "./split-patterns";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DetectedChapter {
  title: string;
  content: string;
  chapterNumber: number;
  wordCount: number;
  /** true if wordCount < 200 */
  short: boolean;
  /** Confidence score 0–1 for the pattern that detected this chapter. */
  confidence: number;
  /** Which pattern family matched this chapter. */
  patternType: PatternType | "fallback";
}

export interface DetectionResult {
  chapters: DetectedChapter[];
  /** Average confidence across all detected chapters. */
  avgConfidence: number;
  /** Detection method: "heuristic" | "fallback" */
  method: "heuristic" | "fallback";
  /** Which pattern family was selected (or "fallback" / "mixed"). */
  patternFamily: PatternType | "fallback" | "mixed";
}

/** Minimum word count before a chapter is flagged as "short". */
const SHORT_CHAPTER_THRESHOLD = 200;

// ── Pattern priority ───────────────────────────────────────────────────────

/** Ordered priority: first family with ≥ 2 matches wins. */
const PATTERN_PRIORITY: PatternType[] = [
  "keyword",
  "lesson",
  "markdown-h1",
  "roman",
  "numbered",
  "all-caps",
  "dash-separator",
];

// ── Keyword & lesson guards ────────────────────────────────────────────────

/**
 * Monotonic guard + minimum-content guard for keyword/lesson headings.
 *
 * Monotonic: discard heading whose number ≤ highest seen so far.
 * Minimum-content: discard heading with zero body lines (unless subtitle-merged).
 */
function applyNumberedGuards(
  headings: PatternMatch[],
  lines: string[],
  numberRe: RegExp
): PatternMatch[] {
  if (headings.length === 0) return headings;

  const result: PatternMatch[] = [];
  let maxNumSeen = 0;

  for (let h = 0; h < headings.length; h++) {
    const heading = headings[h];
    const numMatch = numberRe.exec(heading.title);
    const num = numMatch ? parseInt(numMatch[1], 10) : NaN;

    // Monotonic guard
    if (!isNaN(num) && num <= maxNumSeen) continue;

    // Minimum content guard (exempt subtitle-merged headings)
    if (!heading.hasSubtitle) {
      const contentStart = heading.lastLineIndex + 1;
      const contentEnd =
        h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;
      const bodyLines = lines
        .slice(contentStart, contentEnd)
        .filter((l) => l.trim().length > 0);
      if (bodyLines.length === 0) continue;
    }

    if (!isNaN(num)) maxNumSeen = num;
    result.push(heading);
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// ── Select best pattern family ─────────────────────────────────────────────

function selectHeadings(
  groups: Record<PatternType, PatternMatch[]>,
  lines: string[]
): { headings: PatternMatch[]; family: PatternType | "mixed" } {
  // Apply guards to keyword and lesson groups
  groups.keyword = applyNumberedGuards(groups.keyword, lines, KEYWORD_NUMBER_RE);
  groups.lesson = applyNumberedGuards(groups.lesson, lines, LESSON_NUMBER_RE);

  // First family with ≥ 2 matches wins
  for (const family of PATTERN_PRIORITY) {
    if (groups[family].length >= 2) {
      return { headings: groups[family], family };
    }
  }

  // Combine all found (may be 0 or 1)
  const combined: PatternMatch[] = [];
  for (const family of PATTERN_PRIORITY) {
    combined.push(...groups[family]);
  }
  combined.sort((a, b) => a.lineIndex - b.lineIndex);

  return {
    headings: combined,
    family: combined.length > 0 ? "mixed" : "mixed",
  };
}

// ── Build chapters from headings ───────────────────────────────────────────

function buildChapters(
  headings: PatternMatch[],
  lines: string[],
  fullText: string,
  family: PatternType | "mixed"
): DetectedChapter[] {
  const chapters: DetectedChapter[] = [];

  // Preamble: text before the first heading
  if (headings[0].lineIndex > 0) {
    const preambleLines = lines.slice(0, headings[0].lineIndex);
    const preambleContent = preambleLines.join("\n").trim();
    if (preambleContent.length > 0) {
      const wc = countWords(preambleContent);
      chapters.push({
        title: "Preamble",
        content: preambleContent,
        chapterNumber: 1,
        wordCount: wc,
        short: wc < SHORT_CHAPTER_THRESHOLD,
        confidence: family === "mixed" ? 0.5 : headings[0].confidence,
        patternType: family === "mixed" ? "fallback" : headings[0].patternType,
      });
    }
  }

  for (let h = 0; h < headings.length; h++) {
    const heading = headings[h];
    const startLine = heading.lastLineIndex + 1;
    const endLine =
      h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;

    const content = lines.slice(startLine, endLine).join("\n").trim();
    const wc = countWords(content);

    chapters.push({
      title: heading.title,
      content,
      chapterNumber: chapters.length + 1,
      wordCount: wc,
      short: wc < SHORT_CHAPTER_THRESHOLD,
      confidence: heading.confidence,
      patternType: heading.patternType,
    });
  }

  return chapters;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect chapters in plain text using heuristic heading patterns.
 *
 * Returns a `DetectionResult` with chapters, average confidence,
 * detection method, and the winning pattern family.
 */
export function detectChapters(text: string): DetectionResult {
  const lines = text.split("\n");
  const groups = matchPatterns(lines);
  const { headings, family } = selectHeadings(groups, lines);

  // ── Fallback: no headings found ────────────────────────────────────────
  if (headings.length === 0) {
    const wc = countWords(text);
    return {
      chapters: [
        {
          title: "Untitled",
          content: text,
          chapterNumber: 1,
          wordCount: wc,
          short: wc < SHORT_CHAPTER_THRESHOLD,
          confidence: 0,
          patternType: "fallback",
        },
      ],
      avgConfidence: 0,
      method: "fallback",
      patternFamily: "fallback",
    };
  }

  // ── Build chapters ─────────────────────────────────────────────────────
  const chapters = buildChapters(headings, lines, text, family);

  const avgConfidence =
    chapters.length > 0
      ? chapters.reduce((sum, ch) => sum + ch.confidence, 0) / chapters.length
      : 0;

  return {
    chapters,
    avgConfidence,
    method: "heuristic",
    patternFamily: family,
  };
}
