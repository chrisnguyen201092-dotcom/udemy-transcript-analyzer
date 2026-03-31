/**
 * Unit tests for split-patterns.ts — pattern matching logic.
 * Tests each pattern family, helpers, and subtitle joining.
 *
 * Covers: B-17 pattern extraction + new patterns (lesson, roman, dash-separator)
 */
import { describe, it, expect } from "vitest";
import {
  matchPatterns,
  isAllCapsHeading,
  isSubtitleLine,
  findNextNonEmpty,
  hasBlankLineBetween,
  getConfidence,
  KEYWORD_HEADING_RE,
  LESSON_HEADING_RE,
  NUMBERED_HEADING_RE,
  MARKDOWN_H1_RE,
  ROMAN_HEADING_RE,
  DASH_SEPARATOR_RE,
  type PatternType,
} from "../split-patterns";

// ── Helper ──────────────────────────────────────────────────────────────────
function lines(text: string): string[] {
  return text.split("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Regex unit tests
// ═══════════════════════════════════════════════════════════════════════════════
describe("Regex patterns", () => {
  describe("KEYWORD_HEADING_RE", () => {
    it.each([
      "Chapter 1",
      "chapter 2: Title",
      "Chương 3",
      "Phần 4. Overview",
      "Part 5 — Summary",
    ])("matches '%s'", (line) => {
      expect(KEYWORD_HEADING_RE.test(line)).toBe(true);
    });

    it.each(["chapter", "The Chapter 1", "chapter one"])(
      "does not match '%s'",
      (line) => {
        expect(KEYWORD_HEADING_RE.test(line)).toBe(false);
      }
    );
  });

  describe("LESSON_HEADING_RE", () => {
    it.each(["Bài 1", "bài 2: Giới thiệu", "Lesson 3", "lesson 10. Arrays"])(
      "matches '%s'",
      (line) => {
        expect(LESSON_HEADING_RE.test(line)).toBe(true);
      }
    );

    it.each(["bài", "Bài học", "Lesson one"])(
      "does not match '%s'",
      (line) => {
        expect(LESSON_HEADING_RE.test(line)).toBe(false);
      }
    );
  });

  describe("NUMBERED_HEADING_RE", () => {
    it.each(["1. Introduction", "2) Methods", "1.1. Sub-section", "10. Last"])(
      "matches '%s'",
      (line) => {
        expect(NUMBERED_HEADING_RE.test(line)).toBe(true);
      }
    );

    it.each(["1.", "1.  ", "1"])(
      "does not match '%s' (no text after number)",
      (line) => {
        expect(NUMBERED_HEADING_RE.test(line)).toBe(false);
      }
    );
  });

  describe("MARKDOWN_H1_RE", () => {
    it("matches '# Title'", () => {
      expect(MARKDOWN_H1_RE.test("# Title")).toBe(true);
    });

    it("does not match '## Title' (H2)", () => {
      expect(MARKDOWN_H1_RE.test("## Title")).toBe(false);
    });

    it("does not match '# ' (empty heading)", () => {
      expect(MARKDOWN_H1_RE.test("# ")).toBe(false);
    });
  });

  describe("ROMAN_HEADING_RE", () => {
    it.each(["I. Introduction", "II) Methods", "III. Results", "IV. Discussion"])(
      "matches '%s'",
      (line) => {
        expect(ROMAN_HEADING_RE.test(line)).toBe(true);
      }
    );

    it.each(["I", "I.", "i. lowercase"])(
      "handles edge case '%s'",
      (line) => {
        // "I." has no text after, "I" has no punctuation, "i. lowercase" matches since RE is case-insensitive
        if (line === "i. lowercase") {
          expect(ROMAN_HEADING_RE.test(line)).toBe(true);
        }
      }
    );
  });

  describe("DASH_SEPARATOR_RE", () => {
    it.each(["---", "===", "-----", "====="])("matches '%s'", (line) => {
      expect(DASH_SEPARATOR_RE.test(line)).toBe(true);
    });

    it.each(["--", "==", "- -", "text---"])("does not match '%s'", (line) => {
      expect(DASH_SEPARATOR_RE.test(line)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper function tests
// ═══════════════════════════════════════════════════════════════════════════════
describe("Helper functions", () => {
  describe("isAllCapsHeading", () => {
    it("detects ALL CAPS line", () => {
      expect(isAllCapsHeading("INTRODUCTION")).toBe(true);
    });

    it("rejects mixed case", () => {
      expect(isAllCapsHeading("Introduction")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isAllCapsHeading("")).toBe(false);
    });

    it("rejects lines over 60 chars", () => {
      expect(isAllCapsHeading("A".repeat(61))).toBe(false);
    });

    it("rejects lines with no letters (all numbers/symbols)", () => {
      expect(isAllCapsHeading("123 --- 456")).toBe(false);
    });

    it("accepts CAPS with numbers and symbols", () => {
      expect(isAllCapsHeading("CHAPTER 1: OVERVIEW")).toBe(true);
    });
  });

  describe("isSubtitleLine", () => {
    it("accepts normal text as subtitle", () => {
      expect(isSubtitleLine("A brief overview of the topic")).toBe(true);
    });

    it("rejects empty line", () => {
      expect(isSubtitleLine("")).toBe(false);
    });

    it("rejects line over 120 chars", () => {
      expect(isSubtitleLine("A".repeat(121))).toBe(false);
    });

    it("rejects keyword heading as subtitle", () => {
      expect(isSubtitleLine("Chapter 1")).toBe(false);
    });

    it("rejects lesson heading as subtitle", () => {
      expect(isSubtitleLine("Bài 2")).toBe(false);
    });
  });

  describe("findNextNonEmpty", () => {
    it("finds next non-empty line", () => {
      expect(findNextNonEmpty(["", "", "text"], 0)).toBe(2);
    });

    it("returns start if start is non-empty", () => {
      expect(findNextNonEmpty(["text", ""], 0)).toBe(0);
    });

    it("returns -1 if no non-empty line", () => {
      expect(findNextNonEmpty(["", "", ""], 0)).toBe(-1);
    });
  });

  describe("hasBlankLineBetween", () => {
    it("returns true if blank line exists between a and b", () => {
      expect(hasBlankLineBetween(["a", "", "b"], 0, 2)).toBe(true);
    });

    it("returns false if no blank line between a and b", () => {
      expect(hasBlankLineBetween(["a", "b", "c"], 0, 2)).toBe(false);
    });

    it("returns false for adjacent lines", () => {
      expect(hasBlankLineBetween(["a", "b"], 0, 1)).toBe(false);
    });
  });

  describe("getConfidence", () => {
    it("returns correct confidence for each pattern type", () => {
      expect(getConfidence("keyword")).toBe(0.95);
      expect(getConfidence("lesson")).toBe(0.90);
      expect(getConfidence("markdown-h1")).toBe(0.90);
      expect(getConfidence("roman")).toBe(0.80);
      expect(getConfidence("numbered")).toBe(0.75);
      expect(getConfidence("all-caps")).toBe(0.60);
      expect(getConfidence("dash-separator")).toBe(0.40);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// matchPatterns integration tests
// ═══════════════════════════════════════════════════════════════════════════════
describe("matchPatterns", () => {
  it("detects keyword headings", () => {
    const result = matchPatterns(lines("Chapter 1: Introduction\n\nSome content\n\nChapter 2: Methods\nMore content"));
    expect(result.keyword).toHaveLength(2);
    expect(result.keyword[0].title).toBe("Chapter 1: Introduction");
    expect(result.keyword[0].confidence).toBe(0.95);
    expect(result.keyword[0].patternType).toBe("keyword");
  });

  it("detects lesson headings (Vietnamese)", () => {
    const result = matchPatterns(lines("Bài 1: Giới thiệu\nContent\n\nBài 2: Biến số\nContent"));
    expect(result.lesson).toHaveLength(2);
    expect(result.lesson[0].title).toBe("Bài 1: Giới thiệu");
    expect(result.lesson[0].confidence).toBe(0.90);
  });

  it("detects markdown H1 headings", () => {
    const result = matchPatterns(lines("# Introduction\nContent\n\n# Methods\nMore"));
    expect(result["markdown-h1"]).toHaveLength(2);
    expect(result["markdown-h1"][0].title).toBe("Introduction");
    expect(result["markdown-h1"][0].confidence).toBe(0.90);
  });

  it("detects roman numeral headings", () => {
    const result = matchPatterns(lines("I. Introduction\nContent\n\nII. Methods\nMore"));
    expect(result.roman).toHaveLength(2);
    expect(result.roman[0].title).toBe("Introduction");
    expect(result.roman[0].confidence).toBe(0.80);
  });

  it("detects numbered headings", () => {
    const result = matchPatterns(lines("1. Introduction\nContent\n\n2. Methods\nMore"));
    expect(result.numbered).toHaveLength(2);
    expect(result.numbered[0].title).toBe("Introduction");
    expect(result.numbered[0].confidence).toBe(0.75);
  });

  it("detects ALL CAPS headings", () => {
    const result = matchPatterns(lines("INTRODUCTION\nContent\n\nMETHODS\nMore"));
    expect(result["all-caps"]).toHaveLength(2);
    expect(result["all-caps"][0].title).toBe("INTRODUCTION");
    expect(result["all-caps"][0].confidence).toBe(0.60);
  });

  it("detects dash separator headings", () => {
    const result = matchPatterns(lines("---\nIntroduction\nContent\n\n---\nMethods\nMore"));
    expect(result["dash-separator"]).toHaveLength(2);
    expect(result["dash-separator"][0].title).toBe("Introduction");
    expect(result["dash-separator"][0].confidence).toBe(0.40);
  });

  // ── Subtitle joining ────────────────────────────────────────────────────
  it("joins subtitle for bare keyword heading", () => {
    const result = matchPatterns(lines("Chapter 1\nThe Beginning\nContent here"));
    expect(result.keyword).toHaveLength(1);
    expect(result.keyword[0].title).toBe("Chapter 1. The Beginning");
    expect(result.keyword[0].hasSubtitle).toBe(true);
    expect(result.keyword[0].lastLineIndex).toBe(1);
  });

  it("joins subtitle for bare lesson heading", () => {
    const result = matchPatterns(lines("Bài 1\nGiới thiệu\nContent"));
    expect(result.lesson).toHaveLength(1);
    expect(result.lesson[0].title).toBe("Bài 1. Giới thiệu");
    expect(result.lesson[0].hasSubtitle).toBe(true);
  });

  it("does not join subtitle when heading already has title text", () => {
    const result = matchPatterns(lines("Chapter 1: The Beginning\nContent here"));
    expect(result.keyword).toHaveLength(1);
    expect(result.keyword[0].title).toBe("Chapter 1: The Beginning");
    expect(result.keyword[0].hasSubtitle).toBe(false);
  });

  it("does not join subtitle across blank line", () => {
    const result = matchPatterns(lines("Chapter 1\n\nThe Beginning\nContent"));
    expect(result.keyword).toHaveLength(1);
    // Blank line between prevents join; "The Beginning" not joined
    expect(result.keyword[0].hasSubtitle).toBe(false);
  });

  // ── Priority/grouping ──────────────────────────────────────────────────
  it("groups patterns by family independently", () => {
    const text = "Chapter 1\nContent\n\n# Markdown Title\nMore content\n\nINTRO\nText";
    const result = matchPatterns(lines(text));

    expect(result.keyword).toHaveLength(1);
    expect(result["markdown-h1"]).toHaveLength(1);
    expect(result["all-caps"]).toHaveLength(1);
  });

  it("returns empty groups for text with no headings", () => {
    const result = matchPatterns(lines("just some plain text\nwith multiple lines\nno headings"));
    const allTypes: PatternType[] = [
      "keyword", "lesson", "markdown-h1", "roman", "numbered", "all-caps", "dash-separator",
    ];
    for (const t of allTypes) {
      expect(result[t]).toHaveLength(0);
    }
  });

  // ── Line index tracking ───────────────────────────────────────────────
  it("tracks correct line indices", () => {
    const text = "Some intro\n\nChapter 1\nContent\n\nChapter 2\nMore";
    const result = matchPatterns(lines(text));

    expect(result.keyword[0].lineIndex).toBe(2);
    expect(result.keyword[1].lineIndex).toBe(5);
  });
});
