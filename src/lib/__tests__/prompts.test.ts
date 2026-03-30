/**
 * Unit tests for AI prompt utilities in @/lib/ai/prompts.
 *
 * These functions ARE exported — tests will pass import but may fail on
 * content assertions if the exported values change.
 */
import { describe, it, expect } from "vitest";
import {
  getSystemPrompt,
  SUMMARY_SYSTEM_PROMPT,
  EXPLAIN_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  ROADMAP_SYSTEM_PROMPT,
  QUIZ_SYSTEM_PROMPT,
  FLASHCARD_SYSTEM_PROMPT,
  EXERCISE_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import type { PromptType, ContentType } from "@/lib/ai/prompts";

describe("getSystemPrompt", () => {
  it('returns SUMMARY_SYSTEM_PROMPT for type "summary"', () => {
    expect(getSystemPrompt("summary")).toBe(SUMMARY_SYSTEM_PROMPT);
  });

  it('returns EXPLAIN_SYSTEM_PROMPT for type "explain"', () => {
    expect(getSystemPrompt("explain")).toBe(EXPLAIN_SYSTEM_PROMPT);
  });

  it('returns CHAT_SYSTEM_PROMPT for type "chat"', () => {
    expect(getSystemPrompt("chat")).toBe(CHAT_SYSTEM_PROMPT);
  });

  it('returns ROADMAP_SYSTEM_PROMPT for type "roadmap"', () => {
    expect(getSystemPrompt("roadmap")).toBe(ROADMAP_SYSTEM_PROMPT);
  });

  it('returns QUIZ_SYSTEM_PROMPT for type "quiz"', () => {
    expect(getSystemPrompt("quiz")).toBe(QUIZ_SYSTEM_PROMPT);
  });

  it('returns FLASHCARD_SYSTEM_PROMPT for type "flashcards"', () => {
    expect(getSystemPrompt("flashcards")).toBe(FLASHCARD_SYSTEM_PROMPT);
  });

  it('returns EXERCISE_SYSTEM_PROMPT for type "exercises"', () => {
    expect(getSystemPrompt("exercises")).toBe(EXERCISE_SYSTEM_PROMPT);
  });

  it("returns a non-empty string for all valid prompt types", () => {
    const types: PromptType[] = ["summary", "explain", "chat", "roadmap", "quiz", "flashcards", "exercises"];
    for (const type of types) {
      const prompt = getSystemPrompt(type);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it("all prompts contain Vietnamese language instruction", () => {
    const types: PromptType[] = ["summary", "explain", "chat", "roadmap", "quiz", "flashcards", "exercises"];
    for (const type of types) {
      const prompt = getSystemPrompt(type);
      // All prompts should instruct to respond in Vietnamese
      expect(prompt).toMatch(/tiếng Việt/i);
    }
  });

  it("all prompts contain think-tag suppression instruction", () => {
    const types: PromptType[] = ["summary", "explain", "chat", "roadmap", "quiz", "flashcards", "exercises"];
    for (const type of types) {
      const prompt = getSystemPrompt(type);
      expect(prompt).toMatch(/<think>/);
    }
  });

  it("each prompt type returns a DISTINCT string", () => {
    const types: PromptType[] = ["summary", "explain", "chat", "roadmap", "quiz", "flashcards", "exercises"];
    const prompts = types.map((type) => getSystemPrompt(type));
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(types.length);
  });
});

describe("SUMMARY_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof SUMMARY_SYSTEM_PROMPT).toBe("string");
    expect(SUMMARY_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("contains ASR handling instructions", () => {
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/ASR/);
  });
});

describe("CHAT_SYSTEM_PROMPT", () => {
  it("contains multi-turn conversation instructions", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/MULTI-TURN|multi-turn/i);
  });
});

describe("ROADMAP_SYSTEM_PROMPT", () => {
  it("mentions analyzing entire course content", () => {
    expect(ROADMAP_SYSTEM_PROMPT).toMatch(/TOÀN BỘ|toàn bộ/i);
  });
});

describe("getSystemPrompt with contentType (B-09 to B-12)", () => {
  const allTypes: PromptType[] = ["summary", "summary-quick", "explain", "chat", "roadmap", "quiz", "flashcards", "exercises"];

  it('backward compatible: getSystemPrompt("summary") without contentType still works', () => {
    expect(getSystemPrompt("summary")).toBe(SUMMARY_SYSTEM_PROMPT);
  });

  it('backward compatible: getSystemPrompt("summary", "course") returns course prompt', () => {
    expect(getSystemPrompt("summary", "course")).toBe(SUMMARY_SYSTEM_PROMPT);
  });

  it('getSystemPrompt("summary", "book") returns book-specific prompt', () => {
    const bookPrompt = getSystemPrompt("summary", "book");
    expect(bookPrompt).not.toBe(SUMMARY_SYSTEM_PROMPT);
  });

  it("book summary prompt does NOT contain ASR rules", () => {
    const bookPrompt = getSystemPrompt("summary", "book");
    expect(bookPrompt).not.toMatch(/ASR/);
  });

  it('book summary prompt uses "chương sách" terminology', () => {
    const bookPrompt = getSystemPrompt("summary", "book");
    expect(bookPrompt).toMatch(/chương sách/);
  });

  it("book explain prompt removes video references", () => {
    const bookPrompt = getSystemPrompt("explain", "book");
    expect(bookPrompt).not.toMatch(/video/i);
  });

  it('book roadmap becomes "Kế hoạch đọc"', () => {
    const bookPrompt = getSystemPrompt("roadmap", "book");
    expect(bookPrompt).toMatch(/Kế hoạch đọc/);
  });

  it("book prompts still contain Vietnamese language instructions", () => {
    for (const type of allTypes) {
      const prompt = getSystemPrompt(type, "book");
      expect(prompt).toMatch(/tiếng Việt/i);
    }
  });

  it("book prompts still contain think-tag suppression", () => {
    for (const type of allTypes) {
      const prompt = getSystemPrompt(type, "book");
      expect(prompt).toMatch(/<think>/);
    }
  });

  it("book prompts use buildLanguageRules", () => {
    for (const type of allTypes) {
      const prompt = getSystemPrompt(type, "book");
      expect(prompt).toMatch(/QUY TẮC NGÔN NGỮ/);
    }
  });

  it("each book prompt type returns a DISTINCT string", () => {
    const prompts = allTypes.map((type) => getSystemPrompt(type, "book"));
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(allTypes.length);
  });

  it('all valid PromptTypes work with contentType "book"', () => {
    for (const type of allTypes) {
      expect(() => getSystemPrompt(type, "book")).not.toThrow();
      const prompt = getSystemPrompt(type, "book");
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});
