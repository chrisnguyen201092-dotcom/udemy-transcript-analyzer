/**
 * Heuristic chapter detection for plain text content.
 * Covers B-17: Tự động chia theo heading (Heuristic)
 *
 * Detects chapter boundaries using multiple patterns:
 * 1. Keyword regex: chapter/chương/phần/part + number
 * 2. Numbered headings: "1. Title"
 * 3. Markdown H1: "# Title"
 * 4. ALL CAPS short lines (< 60 chars)
 * 5. Fallback: single chapter with all content
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

/** Chapter/Chương/Phần/Part followed by a number */
const KEYWORD_HEADING_RE =
  /^(chapter|chương|phần|part)\s+\d+/i;

/** Numbered heading: "1. Title", "1.1 Title", "1) Title" (digit(s) with optional sub-numbers) */
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

// ── Heading detection ───────────────────────────────────────────────────────

interface HeadingMatch {
  lineIndex: number;
  title: string;
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

    // Keyword pattern: "Chapter 1 Introduction" → title = full line
    if (KEYWORD_HEADING_RE.test(line)) {
      keyword.push({ lineIndex: i, title: line });
      continue; // keyword takes precedence, don't double-count
    }

    // Markdown H1
    const h1Match = MARKDOWN_H1_RE.exec(line);
    if (h1Match) {
      markdownH1.push({ lineIndex: i, title: h1Match[1] });
      continue;
    }

    // Numbered heading
    if (NUMBERED_HEADING_RE.test(line)) {
      // title = everything after "N. "
      const title = line.replace(/^\d+\.\s+/, "");
      numbered.push({ lineIndex: i, title });
      continue;
    }

    // ALL CAPS
    if (isAllCapsHeading(line)) {
      allCaps.push({ lineIndex: i, title: line });
    }
  }

  // Return the first family that has ≥ 2 headings
  if (keyword.length >= 2) return keyword;
  if (markdownH1.length >= 2) return markdownH1;
  if (numbered.length >= 2) return numbered;
  if (allCaps.length >= 2) return allCaps;

  // Combine all found (may be 0 or 1)
  const combined = [...keyword, ...markdownH1, ...numbered, ...allCaps];
  combined.sort((a, b) => a.lineIndex - b.lineIndex);
  return combined;
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
    const startLine = heading.lineIndex + 1; // content starts after heading line
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
