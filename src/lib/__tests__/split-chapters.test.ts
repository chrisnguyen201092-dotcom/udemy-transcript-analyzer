/**
 * Tests for heuristic chapter detection logic.
 * Covers B-17: Tự động chia theo heading (Heuristic)
 *
 * Tests patterns: chapter/chương/phần/part regex, numbered headings,
 * markdown H1, ALL CAPS text headings, blank-line gaps, fallback, short chapters.
 *
 * detectChapters() returns DetectionResult { chapters, avgConfidence, method, patternFamily }.
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

      const result = detectChapters(text);
      const { chapters } = result;

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toContain("Chapter 1");
      expect(chapters[1].title).toContain("Chapter 2");
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[1].chapterNumber).toBe(2);
      expect(result.method).toBe("heuristic");
      expect(result.patternFamily).toBe("keyword");
    });

    it("detects 'Chương N' headings (Vietnamese)", () => {
      const text = [
        "Chương 1 Giới thiệu",
        "Nội dung giới thiệu chi tiết về chủ đề chính của cuốn sách.",
        "",
        "Chương 2 Phương pháp",
        "Nội dung phương pháp nghiên cứu và cách tiếp cận vấn đề.",
      ].join("\n");

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const result = detectChapters(text);
      const { chapters } = result;

      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toContain("Introduction");
      expect(chapters[1].title).toContain("Literature Review");
      expect(chapters[2].title).toContain("Methodology");
      expect(result.patternFamily).toBe("numbered");
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

      const result = detectChapters(text);
      const { chapters } = result;

      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toBe("Introduction");
      expect(chapters[1].title).toBe("Methods");
      expect(chapters[2].title).toBe("Results");
      expect(result.patternFamily).toBe("markdown-h1");
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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

      expect(chapters[0].wordCount).toBe(5);
      expect(chapters[1].wordCount).toBe(3);
    });
  });

  // ── Fallback ──────────────────────────────────────────────────────────────
  describe("fallback behavior", () => {
    it("returns single chapter when no headings are found", () => {
      const text = "Just plain text without any headings or structure at all. " +
        "This is a continuous block of text with no clear chapter boundaries.";

      const result = detectChapters(text);
      const { chapters } = result;

      expect(chapters).toHaveLength(1);
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[0].content).toContain("Just plain text");
      expect(result.method).toBe("fallback");
      expect(result.avgConfidence).toBe(0);
    });

    it("returns single chapter for empty/whitespace-only text", () => {
      const { chapters } = detectChapters("   ");

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

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

      const { chapters } = detectChapters(text);

      expect(chapters).toHaveLength(2);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("handles content with no detectable chapter markers", () => {
      const text = "This is just a plain paragraph of text without any headings, markers, or structure whatsoever. " +
        "It continues for a while to ensure there is enough content for the detection algorithm to analyze.";

      const { chapters } = detectChapters(text);

      // Should fallback to single chapter
      expect(chapters).toHaveLength(1);
      expect(chapters[0].content).toContain("plain paragraph");
    });

    it("handles mixed heading formats in same content", () => {
      const text = [
        "# Markdown Heading",
        "Content under markdown heading with enough words for detection.",
        "",
        "Chapter 2 Keyword Heading",
        "Content under keyword heading with enough words for detection.",
        "",
        "NUMBERED SECTION",
        "Content under caps heading with enough words for proper detection.",
      ].join("\n");

      const { chapters } = detectChapters(text);

      expect(chapters.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves content between chapters completely", () => {
      const text = [
        "# Chapter One",
        "Line 1 of chapter one.",
        "Line 2 of chapter one.",
        "Line 3 of chapter one.",
        "",
        "# Chapter Two",
        "Line 1 of chapter two.",
        "Line 2 of chapter two.",
      ].join("\n");

      const { chapters } = detectChapters(text);

      // All content lines must appear somewhere in the chapters
      const allContent = chapters.map((c) => c.content).join("\n");
      expect(allContent).toContain("Line 1 of chapter one");
      expect(allContent).toContain("Line 2 of chapter one");
      expect(allContent).toContain("Line 3 of chapter one");
      expect(allContent).toContain("Line 1 of chapter two");
      expect(allContent).toContain("Line 2 of chapter two");
    });
  });

  // ── Vietnamese PDF fixes ─────────────────────────────────────────────────
  describe("Vietnamese PDF chapter detection (regression)", () => {
    it("rejects bare 'Chương N.' TOC stubs with no body content", () => {
      // Simulates a Table of Contents block followed by real chapters
      const text = [
        "Chương 1. Giới thiệu",         // TOC stub (no body between it and next)
        "Chương 2. Phương pháp",         // TOC stub
        "Chương 3. Kết quả",             // TOC stub
        "",
        "CHƯƠNG 1. GIỚI THIỆU VỀ DỰ ÁN",
        "Nội dung chương 1 chi tiết và đầy đủ với nhiều từ để vượt qua ngưỡng.",
        "Thêm nội dung để đảm bảo đủ số lượng từ cho chương đầu tiên.",
        "",
        "CHƯƠNG 2. PHƯƠNG PHÁP NGHIÊN CỨU",
        "Nội dung chương 2 chi tiết về phương pháp và cách tiếp cận vấn đề.",
        "Thêm nội dung để đảm bảo đủ số lượng từ cho chương thứ hai này.",
        "",
        "CHƯƠNG 3. KẾT QUẢ VÀ PHÂN TÍCH",
        "Nội dung chương 3 về kết quả nghiên cứu và phân tích số liệu thực tế.",
        "Thêm nội dung để đảm bảo đủ số lượng từ cho chương thứ ba cuối cùng.",
      ].join("\n");

      const { chapters } = detectChapters(text);

      // Should detect the 3 real chapters. The discarded TOC stubs become
      // a Preamble chapter since they appear before the first real heading.
      // Total = 1 preamble + 3 real = 4 chapters.
      expect(chapters).toHaveLength(4);
      const realChapters = chapters.filter((c) => c.title !== "Preamble");
      expect(realChapters).toHaveLength(3);
      expect(realChapters[0].title).toContain("CHƯƠNG 1");
      expect(realChapters[1].title).toContain("CHƯƠNG 2");
      expect(realChapters[2].title).toContain("CHƯƠNG 3");
    });

    it("joins multi-line titles: 'CHƯƠNG 5.' on one line, subtitle on next", () => {
      // Simulates PDF text extraction where a long chapter title wraps
      const text = [
        "CHƯƠNG 4. PHẦN MỞ ĐẦU ĐƠN GIẢN",
        "Nội dung chương 4 đây là nội dung đầy đủ cho chương này đủ từ.",
        "Thêm dòng nội dung để đảm bảo số lượng từ đủ nhiều cho chương.",
        "",
        // Title wraps: keyword line + subtitle on next line (no blank between)
        "CHƯƠNG 5.",
        "TẤT CẢ DỰ ÁN ĐỀU GIỐNG NHAU – BÍ MẬT THÀNH CÔNG",
        "Nội dung chương 5 chi tiết về bí mật thành công của các dự án.",
        "Thêm nội dung để đảm bảo đủ số lượng từ cho chương thứ năm này.",
        "",
        "CHƯƠNG 6. CHỦ ĐẦU TƯ VÀ CÁC BÊN LIÊN QUAN",
        "Nội dung chương 6 về các bên liên quan trong dự án xây dựng thực tế.",
        "Thêm nội dung để đảm bảo đủ số lượng từ cho chương thứ sáu cuối.",
      ].join("\n");

      const { chapters } = detectChapters(text);

      expect(chapters).toHaveLength(3);
      // Ch.2 should have the full joined title, not just "CHƯƠNG 5."
      const ch5 = chapters.find((c) => c.title.includes("CHƯƠNG 5"));
      expect(ch5).toBeDefined();
      expect(ch5!.title).toContain("TẤT CẢ DỰ ÁN");
    });

    it("ignores back-references like 'Chương 2.' appearing after CHƯƠNG 5", () => {
      // Body text contains a reference to an earlier chapter
      const text = [
        "CHƯƠNG 4. GIỚI THIỆU ĐẦY ĐỦ VỀ DỰ ÁN",
        "Nội dung chương 4 chi tiết đầy đủ về giới thiệu dự án thực tế.",
        "Thêm nội dung để đảm bảo số lượng từ đủ nhiều cho chương này.",
        "",
        "CHƯƠNG 5. PHÂN TÍCH CHI TIẾT DỰ ÁN",
        "Như đã nói trong Chương 2, phương pháp này rất hiệu quả trong thực tế.",
        "Nội dung thêm để đảm bảo số lượng từ đủ nhiều cho chương thứ năm này.",
        "Thêm nhiều nội dung hơn để chương đủ dài và vượt qua ngưỡng tối thiểu.",
        "",
        "CHƯƠNG 6. KẾT LUẬN VÀ ĐỀ XUẤT",
        "Kết luận và đề xuất cuối cùng cho toàn bộ nghiên cứu dự án xây dựng.",
        "Thêm nội dung để đảm bảo số lượng từ đủ nhiều cho chương kết luận.",
      ].join("\n");

      const { chapters } = detectChapters(text);

      expect(chapters).toHaveLength(3);
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[1].chapterNumber).toBe(2);
      expect(chapters[2].chapterNumber).toBe(3);
      // Titles should be monotonically increasing (4, 5, 6)
      expect(chapters[0].title).toContain("CHƯƠNG 4");
      expect(chapters[1].title).toContain("CHƯƠNG 5");
      expect(chapters[2].title).toContain("CHƯƠNG 6");
    });

    it("handles Vietnamese chapter with dot separator: 'CHƯƠNG 5. Title'", () => {
      const text = [
        "CHƯƠNG 1. TỔNG QUAN VỀ QUẢN LÝ DỰ ÁN",
        "Nội dung chương 1 về tổng quan quản lý dự án xây dựng hiện đại.",
        "Thêm nội dung chi tiết để đảm bảo số lượng từ đủ nhiều cho chương.",
        "",
        "CHƯƠNG 2. CÁC PHƯƠNG PHÁP TIẾP CẬN",
        "Nội dung chương 2 về các phương pháp tiếp cận khác nhau trong thực tế.",
        "Thêm nội dung để đảm bảo số lượng từ đủ nhiều cho chương thứ hai này.",
      ].join("\n");

      const { chapters } = detectChapters(text);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe("CHƯƠNG 1. TỔNG QUAN VỀ QUẢN LÝ DỰ ÁN");
      expect(chapters[1].title).toBe("CHƯƠNG 2. CÁC PHƯƠNG PHÁP TIẾP CẬN");
    });
  });

  // ── Confidence scoring ──────────────────────────────────────────────────
  describe("confidence scoring", () => {
    it("returns high confidence for keyword patterns", () => {
      const text = [
        "Chapter 1 Introduction",
        "Substantial content for chapter one with many words.",
        "",
        "Chapter 2 Methods",
        "Substantial content for chapter two with many words.",
      ].join("\n");

      const result = detectChapters(text);

      expect(result.avgConfidence).toBeGreaterThanOrEqual(0.9);
      expect(result.chapters[0].confidence).toBe(0.95);
      expect(result.chapters[0].patternType).toBe("keyword");
    });

    it("returns zero confidence for fallback", () => {
      const result = detectChapters("No headings here at all.");

      expect(result.avgConfidence).toBe(0);
      expect(result.chapters[0].patternType).toBe("fallback");
    });

    it("returns medium confidence for ALL CAPS patterns", () => {
      const text = [
        "INTRODUCTION",
        "Content for introduction with enough words for detection.",
        "More content to pad it out beyond minimum threshold.",
        "",
        "METHODOLOGY",
        "Content for methodology with enough words for detection.",
        "More content to pad it out beyond minimum threshold.",
      ].join("\n");

      const result = detectChapters(text);

      expect(result.avgConfidence).toBeGreaterThanOrEqual(0.5);
      expect(result.avgConfidence).toBeLessThanOrEqual(0.7);
    });
  });
});
