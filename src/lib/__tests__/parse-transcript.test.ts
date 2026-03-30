/**
 * Unit tests for transcript parsing utilities.
 *
 * These functions are currently INLINE in src/app/api/courses/upload/route.ts
 * and NOT exported. Tests import from @/lib/parse-transcript which does NOT
 * exist yet — this causes the module-not-found error that confirms RED state.
 */
import { describe, it, expect } from "vitest";
import { parseVtt, parseSrt, parseTxt, removeExtension } from "@/lib/parse-transcript";

// ---------------------------------------------------------------------------
// parseVtt
// ---------------------------------------------------------------------------
describe("parseVtt", () => {
  it("strips WEBVTT header line", () => {
    const input = "WEBVTT\n\nHello world";
    expect(parseVtt(input)).toBe("Hello world");
  });

  it("strips timestamp lines (HH:MM format)", () => {
    const input = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello world";
    expect(parseVtt(input)).toBe("Hello world");
  });

  it("strips HTML tags from lines", () => {
    const input = "WEBVTT\n\n<b>Bold text</b> and <i>italic</i>";
    expect(parseVtt(input)).toBe("Bold text and italic");
  });

  it("deduplicates consecutive identical lines", () => {
    const input = "WEBVTT\n\nHello\nHello\nWorld";
    expect(parseVtt(input)).toBe("Hello World");
  });

  it("does NOT deduplicate non-consecutive identical lines", () => {
    const input = "WEBVTT\n\nHello\nWorld\nHello";
    expect(parseVtt(input)).toBe("Hello World Hello");
  });

  it("returns null for empty content after stripping", () => {
    const input = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n";
    expect(parseVtt(input)).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(parseVtt("   \n  \n  ")).toBeNull();
  });

  it("handles real-world VTT with multiple cues and timestamps", () => {
    const input = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:03.000",
      "Welcome to this course",
      "",
      "00:00:03.500 --> 00:00:05.000",
      "Today we learn JavaScript",
      "",
      "00:00:05.100 --> 00:00:06.000",
      "Today we learn JavaScript",
    ].join("\n");
    expect(parseVtt(input)).toBe("Welcome to this course Today we learn JavaScript");
  });

  it("strips --> lines that appear without full timestamp prefix", () => {
    const input = "WEBVTT\n\n--> some garbage\nActual content";
    expect(parseVtt(input)).toBe("Actual content");
  });

  it("handles lines that look like partial timestamps (e.g. 00:01)", () => {
    const input = "WEBVTT\n\n00:01 some garbage\nReal content";
    // Lines starting with 00:\d{2} should be filtered
    expect(parseVtt(input)).toBe("Real content");
  });

  it("joins lines with single space", () => {
    const input = "WEBVTT\n\nFirst line\nSecond line\nThird line";
    expect(parseVtt(input)).toBe("First line Second line Third line");
  });
});

// ---------------------------------------------------------------------------
// parseSrt
// ---------------------------------------------------------------------------
describe("parseSrt", () => {
  it("strips sequence number lines (lines that are just digits)", () => {
    const input = "1\n00:00:01,000 --> 00:00:03,000\nHello world\n\n2\n00:00:04,000 --> 00:00:05,000\nNext line";
    expect(parseSrt(input)).toBe("Hello world Next line");
  });

  it("strips SRT timestamp lines with comma format", () => {
    const input = "1\n00:00:01,500 --> 00:00:03,200\nHello";
    expect(parseSrt(input)).toBe("Hello");
  });

  it("strips HTML tags from subtitle lines", () => {
    const input = "1\n00:00:01,000 --> 00:00:02,000\n<b>Bold</b> text";
    expect(parseSrt(input)).toBe("Bold text");
  });

  it("deduplicates consecutive identical lines", () => {
    const input = "1\n00:00:01,000 --> 00:00:02,000\nHello\nHello";
    expect(parseSrt(input)).toBe("Hello");
  });

  it("returns null for empty input after stripping", () => {
    const input = "1\n00:00:01,000 --> 00:00:02,000\n";
    expect(parseSrt(input)).toBeNull();
  });

  it("handles real-world SRT with multiple entries", () => {
    const input = [
      "1",
      "00:00:01,000 --> 00:00:03,000",
      "Welcome to the course",
      "",
      "2",
      "00:00:04,000 --> 00:00:06,000",
      "Let's get started",
    ].join("\n");
    expect(parseSrt(input)).toBe("Welcome to the course Let's get started");
  });

  it("does not strip lines that just contain text starting with a number + text", () => {
    const input = "1\n00:00:01,000 --> 00:00:02,000\n5 things to know";
    // "5 things to know" is NOT purely numeric — should NOT be stripped
    expect(parseSrt(input)).toBe("5 things to know");
  });
});

// ---------------------------------------------------------------------------
// parseTxt
// ---------------------------------------------------------------------------
describe("parseTxt", () => {
  it("returns text as-is when non-empty", () => {
    expect(parseTxt("Hello world")).toBe("Hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(parseTxt("  Hello  ")).toBe("Hello");
  });

  it("returns null for empty string", () => {
    expect(parseTxt("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseTxt("   \n  ")).toBeNull();
  });

  it("preserves internal whitespace and newlines", () => {
    const text = "First paragraph\n\nSecond paragraph";
    expect(parseTxt(text)).toBe("First paragraph\n\nSecond paragraph");
  });
});

// ---------------------------------------------------------------------------
// removeExtension
// ---------------------------------------------------------------------------
describe("removeExtension", () => {
  it("removes .vtt extension", () => {
    expect(removeExtension("lesson1.vtt")).toBe("lesson1");
  });

  it("removes .srt extension", () => {
    expect(removeExtension("lesson1.srt")).toBe("lesson1");
  });

  it("removes .txt extension", () => {
    expect(removeExtension("my lesson.txt")).toBe("my lesson");
  });

  it("handles filename with no extension", () => {
    expect(removeExtension("filename")).toBe("filename");
  });

  it("handles filename with multiple dots — only removes last extension", () => {
    expect(removeExtension("my.lesson.name.vtt")).toBe("my.lesson.name");
  });

  it("handles dot at position 0 (hidden file, no extension)", () => {
    // dot > 0 condition: dot at index 0 → return original
    expect(removeExtension(".gitignore")).toBe(".gitignore");
  });
});
