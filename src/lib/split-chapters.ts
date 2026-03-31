/**
 * Heuristic chapter detection for plain text content.
 * Covers B-17: Tự động chia theo heading (Heuristic)
 *
 * Detects chapter boundaries using multiple patterns:
 * 1. Keyword regex: chapter/chương/phần/part + number (+ optional subtitle join)
 * 2. Numbered headings: "1. Title"
 * 3. Markdown H1: "# Title"
 * 4. ALL CAPS short lines (< 60 chars)
 * 5. Fallback: single chapter with all content
 *
 * Vietnamese PDF fixes:
 * - Multi-line subtitle join: when a keyword heading line is BARE (just
 *   "CHƯƠNG 5." with nothing after the number), and the very next line
 *   (no blank between) looks like a subtitle, the two lines are merged into
 *   one title. Only bare keyword lines trigger subtitle join to avoid
 *   accidentally consuming body text from full-title headings like
 *   "CHƯƠNG 1. TỔNG QUAN VỀ...".
 * - Monotonic guard: keyword headings with chapter number ≤ last accepted
 *   number are discarded as TOC entries or back-references.
 * - Minimum content guard: keyword headings with zero body lines are discarded
 *   as TOC stubs, unless they had a subtitle line merged in.
 */

export interface DetectedChapter {
  title: string;
  content: string;
  chapterNumber: number;
  wordCount: number;
  /** true if wordCount < 200 */
  short: boolean;
}

/** Minimum word count before a chapter is flagged as "short" */
const SHORT_CHAPTER_THRESHOLD = 200;

// ── Pattern matchers ────────────────────────────────────────────────────────

/** Chapter/Chương/Phần/Part followed by a number (same as original, intentionally loose). */
const KEYWORD_HEADING_RE =
  /^(chapter|chương|phần|part)\s+\d+/i;

/**
 * A bare keyword heading: keyword + number + optional trailing punctuation,
 * with nothing else on the line (e.g. "CHƯƠNG 5." or "Chương 5").
 * These are candidates for subtitle joining on the next line.
 */
const BARE_KEYWORD_RE =
  /^(chapter|chương|phần|part)\s+\d+[.):]?\s*$/i;

/**
 * Extract the chapter number from a keyword heading line for the monotonic
 * guard.
 */
const KEYWORD_NUMBER_RE = /^(?:chapter|chương|phần|part)\s+(\d+)/i;

/** Numbered heading: "1. Title", "1.1 Title", "1) Title" */
const NUMBERED_HEADING_RE = /^\d+(?:\.\d+)*[.)]\s+\S/;

/** Markdown H1 only (not H2+) */
const MARKDOWN_H1_RE = /^# (.+)$/;

/** ALL CAPS line shorter than 60 characters (trimmed) */
function isAllCapsHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;
  // Must have at least one letter and all letters must be uppercase
  const hasLetter = /[A-Z]/.test(trimmed);
  if (!hasLetter) return false;
  // No lowercase letters allowed
  return !/[a-z]/.test(trimmed);
}

/**
 * Return true if a line looks like a subtitle for a bare keyword heading.
 * Heuristic: non-empty, ≤ 120 chars, not itself a heading pattern.
 */
function isSubtitleLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 120) return false;
  if (KEYWORD_HEADING_RE.test(t)) return false;
  if (NUMBERED_HEADING_RE.test(t)) return false;
  if (MARKDOWN_H1_RE.test(t)) return false;
  return true;
}

// ── Heading detection ───────────────────────────────────────────────────────

interface HeadingMatch {
  /** Line index of the keyword/heading line itself. */
  lineIndex: number;
  /** Index of the last line consumed by this heading (> lineIndex when subtitle joined). */
  lastLineIndex: number;
  title: string;
  /** True when a subtitle line was merged into this heading's title. */
  hasSubtitle: boolean;
}

/**
 * Scan all lines and return heading positions + extracted titles.
 * Priority: keyword > numbered > markdown H1 > ALL CAPS
 * We use the FIRST pattern family that yields ≥ 2 headings.
 * If none yield ≥ 2 we combine everything found.
 */
function findHeadings(lines: string[]): HeadingMatch[] {
  const keyword: HeadingMatch[] = [];
  const numbered: HeadingMatch[] = [];
  const markdownH1: HeadingMatch[] = [];
  const allCaps: HeadingMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    // ── Keyword heading ────────────────────────────────────────────────────
    if (KEYWORD_HEADING_RE.test(line)) {
      const headingLineIndex = i; // capture before any i mutation
      let title = line;
      let lastLineIndex = i;
      let hasSubtitle = false;

      // Subtitle join: only for BARE keyword lines (e.g. "CHƯƠNG 5.").
      // A full-title line like "CHƯƠNG 1. TỔNG QUAN..." is already complete
      // and must NOT consume the next line as a subtitle.
      if (BARE_KEYWORD_RE.test(line)) {
        const nextIdx = findNextNonEmpty(lines, i + 1);
        if (
          nextIdx !== -1 &&
          !hasBlankLineBetween(lines, i, nextIdx) &&
          isSubtitleLine(lines[nextIdx])
        ) {
          // Strip trailing punctuation from bare line before joining
          const baseLine = line.replace(/[.:]?\s*$/, "");
          title = `${baseLine}. ${lines[nextIdx].trim()}`;
          lastLineIndex = nextIdx;
          hasSubtitle = true;
          i = nextIdx; // advance past the consumed subtitle line
        }
      }

      keyword.push({ lineIndex: headingLineIndex, lastLineIndex, title, hasSubtitle });
      continue;
    }

    // ── Markdown H1 ────────────────────────────────────────────────────────
    const h1Match = MARKDOWN_H1_RE.exec(line);
    if (h1Match) {
      markdownH1.push({ lineIndex: i, lastLineIndex: i, title: h1Match[1], hasSubtitle: false });
      continue;
    }

    // ── Numbered heading ───────────────────────────────────────────────────
    if (NUMBERED_HEADING_RE.test(line)) {
      const title = line.replace(/^\d+\.\s+/, "");
      numbered.push({ lineIndex: i, lastLineIndex: i, title, hasSubtitle: false });
      continue;
    }

    // ── ALL CAPS ───────────────────────────────────────────────────────────
    if (isAllCapsHeading(line)) {
      allCaps.push({ lineIndex: i, lastLineIndex: i, title: line, hasSubtitle: false });
    }
  }

  // Apply monotonic + minimum-content guard to keyword headings
  const filteredKeyword = applyKeywordGuards(keyword, lines);

  // Return the first family that has ≥ 2 headings
  if (filteredKeyword.length >= 2) return filteredKeyword;
  if (markdownH1.length >= 2) return markdownH1;
  if (numbered.length >= 2) return numbered;
  if (allCaps.length >= 2) return allCaps;

  // Combine all found (may be 0 or 1)
  const combined = [...filteredKeyword, ...markdownH1, ...numbered, ...allCaps];
  combined.sort((a, b) => a.lineIndex - b.lineIndex);
  return combined;
}

/**
 * Apply monotonic guard and minimum content guard to keyword headings.
 *
 * Monotonic guard: discard any heading whose chapter number ≤ the highest
 * chapter number seen so far.  This removes TOC entries that repeat earlier
 * chapter numbers after the real chapter has already been seen.
 *
 * Minimum content guard: discard headings that have zero non-empty body
 * lines before the next heading — pure TOC stubs.  Exception: headings
 * that had a subtitle line merged in are exempt (they already consumed a
 * content-like line).
 */
function applyKeywordGuards(
  headings: HeadingMatch[],
  lines: string[]
): HeadingMatch[] {
  if (headings.length === 0) return headings;

  const result: HeadingMatch[] = [];
  let maxChapterNumSeen = 0;

  for (let h = 0; h < headings.length; h++) {
    const heading = headings[h];

    const numMatch = KEYWORD_NUMBER_RE.exec(heading.title);
    const chNum = numMatch ? parseInt(numMatch[1], 10) : NaN;

    // Monotonic guard
    if (!isNaN(chNum) && chNum <= maxChapterNumSeen) {
      continue;
    }

    // Minimum content guard (exempt subtitle-merged headings)
    if (!heading.hasSubtitle) {
      const contentStart = heading.lastLineIndex + 1;
      const contentEnd =
        h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;
      const bodyLines = lines
        .slice(contentStart, contentEnd)
        .filter((l) => l.trim().length > 0);

      if (bodyLines.length === 0) {
        continue;
      }
    }

    if (!isNaN(chNum)) maxChapterNumSeen = chNum;
    result.push(heading);
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Return the index of the next non-empty line at or after `start`, or -1. */
function findNextNonEmpty(lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim().length > 0) return i;
  }
  return -1;
}

/** Return true if there is at least one blank line strictly between indices a and b. */
function hasBlankLineBetween(lines: string[], a: number, b: number): boolean {
  for (let i = a + 1; i < b; i++) {
    if (lines[i].trim().length === 0) return true;
  }
  return false;
}

// ── Word counting ───────────────────────────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect chapters in plain text using heuristic heading patterns.
 *
 * Returns an array of `DetectedChapter` objects with sequential numbering.
 * If no headings are found, returns a single chapter containing all text.
 */
export function detectChapters(text: string): DetectedChapter[] {
  const lines = text.split("\n");
  const headings = findHeadings(lines);

  // ── Fallback: no headings found ─────────────────────────────────────────
  if (headings.length === 0) {
    const wc = countWords(text);
    return [
      {
        title: "Untitled",
        content: text,
        chapterNumber: 1,
        wordCount: wc,
        short: wc < SHORT_CHAPTER_THRESHOLD,
      },
    ];
  }

  // ── Build chapters from heading boundaries ──────────────────────────────
  const chapters: DetectedChapter[] = [];

  // If there's text before the first heading, include it as a preamble chapter
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
      });
    }
  }

  for (let h = 0; h < headings.length; h++) {
    const heading = headings[h];
    // Content starts after the last line consumed by this heading
    const startLine = heading.lastLineIndex + 1;
    const endLine =
      h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;

    const contentLines = lines.slice(startLine, endLine);
    const content = contentLines.join("\n").trim();
    const wc = countWords(content);

    chapters.push({
      title: heading.title,
      content,
      chapterNumber: chapters.length + 1,
      wordCount: wc,
      short: wc < SHORT_CHAPTER_THRESHOLD,
    });
  }

  return chapters;
}
