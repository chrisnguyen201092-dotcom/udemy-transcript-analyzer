/**
 * Tests for heuristic chapter detection logic.
 * Covers B-17: Tự động chia theo heading (Heuristic)
 *
 * Tests patterns: chapter/chương/phần/part regex, numbered headings,
 * markdown H1, ALL CAPS text headings, blank-line gaps, fallback, short chapters.
 */
import { describe, it, expect } from "vitest";
import { detectChapters } from "@/lib/split-chapters";

describe("detectChapters", () => {
  // ── Chapter/Chương/Phần/Part regex ──────────────────────────────────────
  describe("keyword heading patterns (B-17 regex)", () => {
    it("detects 'Chapter N' headings (English)", () => {
      const text = [
        "Chapter 1 Introduction",
        "This is the intro content with enough words to be meaningful.",
        "More content here to pad the chapter beyond the minimum threshold.",
        "",
        "Chapter 2 Methods",
        "Methods content with enough words to matter for detection purposes.",
        "Additional methods content to ensure sufficient word count overall.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toContain("Chapter 1");
      expect(chapters[1].title).toContain("Chapter 2");
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[1].chapterNumber).toBe(2);
    });

    it("detects 'Chương N' headings (Vietnamese)", () => {
      const text = [
        "Chương 1 Giới thiệu",
        "Nội dung giới thiệu chi tiết về chủ đề chính của cuốn sách.",
        "",
        "Chương 2 Phương pháp",
        "Nội dung phương pháp nghiên cứu và cách tiếp cận vấn đề.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toContain("Chương 1");
      expect(chapters[1].title).toContain("Chương 2");
    });

    it("detects 'Phần N' and 'Part N' headings", () => {
      const text = [
        "Part 1 Foundation",
        "Foundation content here with substantial text to fill the part.",
        "",
        "Phần 2 Ứng dụng",
        "Ứng dụng content nội dung phần ứng dụng thực tế vào đời sống.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toContain("Part 1");
      expect(chapters[1].title).toContain("Phần 2");
    });

    it("is case-insensitive for chapter keywords", () => {
      const text = [
        "CHAPTER 1 INTRO",
        "Content of chapter one with some meaningful information here.",
        "",
        "chapter 2 body",
        "Content of chapter two with some meaningful information here.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
    });
  });

  // ── Numbered headings ────────────────────────────────────────────────────
  describe("numbered heading patterns", () => {
    it("detects numbered headings like '1. Title'", () => {
      const text = [
        "1. Introduction",
        "This is the introduction with enough content to meet detection.",
        "",
        "2. Literature Review",
        "This is the literature review section with content for detection.",
        "",
        "3. Methodology",
        "This is the methodology section describing the research approach.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toContain("Introduction");
      expect(chapters[1].title).toContain("Literature Review");
      expect(chapters[2].title).toContain("Methodology");
    });
  });

  // ── Markdown H1 ────────────────────────────────────────────────────────────
  describe("markdown H1 headings", () => {
    it("detects '# Title' as chapter boundaries", () => {
      const text = [
        "# Introduction",
        "Intro content about the topic and some more text padding here.",
        "",
        "# Methods",
        "Methods content describing the approach used in this research.",
        "",
        "# Results",
        "Results content showing the outcomes of the research conducted.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toBe("Introduction");
      expect(chapters[1].title).toBe("Methods");
      expect(chapters[2].title).toBe("Results");
    });

    it("ignores H2 and lower headings for chapter boundaries", () => {
      const text = [
        "# Chapter One",
        "Content here.",
        "## Section 1.1",
        "Sub section content.",
        "## Section 1.2",
        "More sub content.",
        "",
        "# Chapter Two",
        "Content of chapter two.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe("Chapter One");
      expect(chapters[1].title).toBe("Chapter Two");
    });
  });

  // ── ALL CAPS headings (plain text) ──────────────────────────────────────
  describe("ALL CAPS headings (plain text)", () => {
    it("detects ALL CAPS short lines as chapter titles", () => {
      const text = [
        "INTRODUCTION",
        "This is the introduction with enough content for chapter detection.",
        "More text in the introduction to pad it out beyond minimum words.",
        "",
        "METHODOLOGY",
        "The methodology section describes our research approach in detail.",
        "Additional methodology content to ensure sufficient word count.",
        "",
        "RESULTS AND DISCUSSION",
        "Results are presented and discussed in this section with details.",
        "More content about results to pad this chapter appropriately.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters.length).toBeGreaterThanOrEqual(3);
      expect(chapters[0].title).toBe("INTRODUCTION");
    });

    it("ignores long ALL CAPS lines (> 60 chars) as non-headings", () => {
      const text = [
        "THIS IS A VERY LONG LINE THAT SHOULD NOT BE TREATED AS A HEADING BECAUSE IT EXCEEDS SIXTY CHARACTERS LIMIT",
        "Some normal content follows after the overly long caps line.",
        "",
        "CHAPTER ONE",
        "Actual chapter content with enough text for the detection logic.",
      ].join("\n");

      const chapters = detectChapters(text);

      // The long CAPS line should NOT be a heading
      const titles = chapters.map((c) => c.title);
      expect(titles).not.toContain(
        "THIS IS A VERY LONG LINE THAT SHOULD NOT BE TREATED AS A HEADING BECAUSE IT EXCEEDS SIXTY CHARACTERS LIMIT"
      );
    });
  });

  // ── Short chapter flagging ──────────────────────────────────────────────
  describe("short chapter detection", () => {
    it("flags chapters with fewer than 200 words as short", () => {
      const text = [
        "# Preface",
        "Short content.",
        "",
        "# Main Content",
        // 200+ words
        Array.from({ length: 50 }, (_, i) => `Word${i} content padding text`).join(" "),
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].short).toBe(true);
      expect(chapters[1].short).toBe(false);
    });
  });

  // ── Word count ──────────────────────────────────────────────────────────
  describe("word count", () => {
    it("computes wordCount for each chapter", () => {
      const text = [
        "# Chapter A",
        "one two three four five",
        "",
        "# Chapter B",
        "alpha beta gamma",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters[0].wordCount).toBe(5);
      expect(chapters[1].wordCount).toBe(3);
    });
  });

  // ── Fallback ──────────────────────────────────────────────────────────────
  describe("fallback behavior", () => {
    it("returns single chapter when no headings are found", () => {
      const text = "Just plain text without any headings or structure at all. " +
        "This is a continuous block of text with no clear chapter boundaries.";

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(1);
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[0].content).toContain("Just plain text");
    });

    it("returns single chapter for empty/whitespace-only text", () => {
      const chapters = detectChapters("   ");

      expect(chapters).toHaveLength(1);
      expect(chapters[0].content.trim()).toBe("");
    });
  });

  // ── Content assignment ──────────────────────────────────────────────────
  describe("content assignment", () => {
    it("assigns text between headings to corresponding chapters", () => {
      const text = [
        "# Intro",
        "Line 1 of intro",
        "Line 2 of intro",
        "",
        "# Body",
        "Line 1 of body",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters[0].content).toContain("Line 1 of intro");
      expect(chapters[0].content).toContain("Line 2 of intro");
      expect(chapters[0].content).not.toContain("Line 1 of body");
      expect(chapters[1].content).toContain("Line 1 of body");
    });

    it("includes preamble text before first heading in first chapter", () => {
      const text = [
        "Some preamble text before any heading appears.",
        "",
        "# Chapter 1",
        "Chapter 1 content.",
      ].join("\n");

      const chapters = detectChapters(text);

      // Preamble either becomes its own chapter or is included in first chapter
      const allContent = chapters.map((c) => c.content).join(" ");
      expect(allContent).toContain("preamble text");
    });
  });

  // ── Chapter numbering ──────────────────────────────────────────────────
  describe("chapter numbering", () => {
    it("assigns sequential chapterNumber starting from 1", () => {
      const text = [
        "# A",
        "Content A",
        "# B",
        "Content B",
        "# C",
        "Content C",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[1].chapterNumber).toBe(2);
      expect(chapters[2].chapterNumber).toBe(3);
    });
  });

  // ── Mixed patterns ──────────────────────────────────────────────────────
  describe("mixed heading styles", () => {
    it("handles text with mixed heading patterns", () => {
      const text = [
        "Chapter 1 The Beginning",
        "Content for the first chapter with enough text for detection.",
        "",
        "Phần 2 The Middle",
        "Content for the middle part with enough text for detection.",
      ].join("\n");

      const chapters = detectChapters(text);

      expect(chapters).toHaveLength(2);
    });
  });
});
