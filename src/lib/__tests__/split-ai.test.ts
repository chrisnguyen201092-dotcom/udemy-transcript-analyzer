/**
 * Unit tests for split-ai.ts — AI-assisted chapter detection.
 * Tests slice sampling, prompt building, LLM response parsing,
 * pattern application, and the public API.
 *
 * Covers: B-18 AI fallback for chapter detection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

vi.mock("@/lib/security/validateBaseUrl", () => ({
  validateBaseUrl: vi.fn((url: string) => url),
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────
import { detectChaptersWithAI, _testExports } from "../split-ai";
const { sampleSlices, buildPrompt, parseLLMResponse, applyPatternsToFullText, inferGeneralPattern } =
  _testExports;

// ═══════════════════════════════════════════════════════════════════════════════
// sampleSlices
// ═══════════════════════════════════════════════════════════════════════════════
describe("sampleSlices", () => {
  it("returns single 'full' slice for short text", () => {
    const shortLines = Array.from({ length: 10 }, (_, i) => `Line ${i}`);
    const slices = sampleSlices(shortLines);
    expect(slices).toHaveLength(1);
    expect(slices[0].label).toBe("full");
    expect(slices[0].startLine).toBe(0);
  });

  it("returns 3 slices (beginning, middle, end) for long text", () => {
    // Create text longer than 3 * 3000 chars
    const longLines = Array.from({ length: 500 }, (_, i) => `This is line number ${i} with some padding text to make it longer.`);
    const slices = sampleSlices(longLines);
    expect(slices).toHaveLength(3);
    expect(slices.map((s) => s.label)).toEqual(["beginning", "middle", "end"]);
  });

  it("returns empty array for empty input", () => {
    expect(sampleSlices([])).toHaveLength(0);
  });

  it("beginning slice starts at line 0", () => {
    const longLines = Array.from({ length: 500 }, (_, i) => `Line ${i} ${"x".repeat(50)}`);
    const slices = sampleSlices(longLines);
    expect(slices[0].startLine).toBe(0);
  });

  it("end slice covers the last lines", () => {
    const longLines = Array.from({ length: 500 }, (_, i) => `Line ${i} ${"x".repeat(50)}`);
    const slices = sampleSlices(longLines);
    const endSlice = slices[2];
    expect(endSlice.text).toContain("Line 499");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildPrompt
// ═══════════════════════════════════════════════════════════════════════════════
describe("buildPrompt", () => {
  it("includes slice labels and line offsets in prompt", () => {
    const slices = [
      { text: "Chapter 1\nContent", startLine: 0, label: "beginning" },
      { text: "Chapter 5\nMiddle content", startLine: 100, label: "middle" },
    ];
    const prompt = buildPrompt(slices);

    expect(prompt).toContain('SLICE "beginning" (starts at line 0)');
    expect(prompt).toContain('SLICE "middle" (starts at line 100)');
    expect(prompt).toContain("Chapter 1");
    expect(prompt).toContain("Chapter 5");
  });

  it("includes JSON format instructions", () => {
    const prompt = buildPrompt([{ text: "text", startLine: 0, label: "full" }]);
    expect(prompt).toContain('"chapters"');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('"linePattern"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseLLMResponse
// ═══════════════════════════════════════════════════════════════════════════════
describe("parseLLMResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      chapters: [{ title: "Ch 1", linePattern: "Chapter 1" }],
      patternDescription: "keyword chapters",
      confidence: 0.85,
    });
    const result = parseLLMResponse(raw);
    expect(result.chapters).toHaveLength(1);
    expect(result.confidence).toBe(0.85);
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      chapters: [{ title: "Ch 1", linePattern: "Chapter 1" }],
      patternDescription: "test",
      confidence: 0.9,
    }) + "\n```";
    const result = parseLLMResponse(raw);
    expect(result.chapters).toHaveLength(1);
  });

  it("clamps confidence to 0-1 range", () => {
    const over = JSON.stringify({ chapters: [], patternDescription: "none", confidence: 1.5 });
    expect(parseLLMResponse(over).confidence).toBe(1);

    const under = JSON.stringify({ chapters: [], patternDescription: "none", confidence: -0.5 });
    expect(parseLLMResponse(under).confidence).toBe(0);
  });

  it("returns empty chapters for invalid shape", () => {
    const noArray = JSON.stringify({ chapters: "not array", patternDescription: "x", confidence: 0.5 });
    const result = parseLLMResponse(noArray);
    expect(result.chapters).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLLMResponse("not json at all")).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// applyPatternsToFullText
// ═══════════════════════════════════════════════════════════════════════════════
describe("applyPatternsToFullText", () => {
  it("finds exact matches for LLM-identified heading lines", () => {
    const textLines = [
      "Some intro text",
      "Chapter 1: Introduction",
      "Content of chapter 1",
      "",
      "Chapter 2: Methods",
      "Content of chapter 2",
    ];
    const llmChapters = [
      { title: "Ch 1", linePattern: "Chapter 1: Introduction" },
      { title: "Ch 2", linePattern: "Chapter 2: Methods" },
    ];
    const result = applyPatternsToFullText(textLines, llmChapters);
    expect(result).toHaveLength(2);
    expect(result[0].startLine).toBe(1);
    expect(result[1].startLine).toBe(4);
  });

  it("returns empty array for empty LLM chapters", () => {
    expect(applyPatternsToFullText(["text"], [])).toHaveLength(0);
  });

  it("applies generalized pattern for headings not in slices", () => {
    const textLines = [
      "Chapter 1: Known",
      "Content",
      "Chapter 2: Also known",
      "Content",
      "Chapter 3: Not in LLM output",
      "More content",
    ];
    // LLM only found chapters 1 and 2
    const llmChapters = [
      { title: "Ch 1", linePattern: "Chapter 1: Known" },
      { title: "Ch 2", linePattern: "Chapter 2: Also known" },
    ];
    const result = applyPatternsToFullText(textLines, llmChapters);
    // Generalized pattern from "Chapter N:" should also catch Chapter 3
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("results are sorted by line position", () => {
    const textLines = [
      "Chapter 2: Second",
      "Content",
      "Chapter 1: First",
      "Content",
    ];
    const llmChapters = [
      { title: "Second", linePattern: "Chapter 2: Second" },
      { title: "First", linePattern: "Chapter 1: First" },
    ];
    const result = applyPatternsToFullText(textLines, llmChapters);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startLine).toBeGreaterThan(result[i - 1].startLine);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// inferGeneralPattern
// ═══════════════════════════════════════════════════════════════════════════════
describe("inferGeneralPattern", () => {
  it("infers keyword pattern from Chapter headings", () => {
    const chapters = [
      { title: "Ch 1", linePattern: "Chapter 1: Introduction" },
      { title: "Ch 2", linePattern: "Chapter 2: Methods" },
    ];
    const pattern = inferGeneralPattern(chapters);
    expect(pattern).not.toBeNull();
    expect(pattern!.test("Chapter 3: Results")).toBe(true);
  });

  it("infers numbered pattern from '1. Title' headings", () => {
    const chapters = [
      { title: "Intro", linePattern: "1. Introduction" },
      { title: "Methods", linePattern: "2. Methods" },
    ];
    const pattern = inferGeneralPattern(chapters);
    expect(pattern).not.toBeNull();
    expect(pattern!.test("3. Results")).toBe(true);
  });

  it("returns null for < 2 chapters", () => {
    expect(inferGeneralPattern([{ title: "Ch 1", linePattern: "Chapter 1" }])).toBeNull();
  });

  it("returns null when no common pattern", () => {
    const chapters = [
      { title: "A", linePattern: "Random heading text" },
      { title: "B", linePattern: "Another unique line" },
    ];
    expect(inferGeneralPattern(chapters)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectChaptersWithAI (public API)
// ═══════════════════════════════════════════════════════════════════════════════
describe("detectChaptersWithAI", () => {
  const config = {
    apiKey: "test-key",
    baseUrl: "https://api.openai.com/v1/",
    model: "gpt-4o-mini",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when LLM finds no chapters", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"chapters":[],"patternDescription":"none","confidence":0}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    });

    const result = await detectChaptersWithAI("just some plain text", config);
    expect(result.chapters).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(result.tokensUsed).toBe(70);
  });

  it("calls LLM and returns detected chapters", async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            chapters: [
              { title: "Chapter 1", linePattern: "Chapter 1: Introduction" },
              { title: "Chapter 2", linePattern: "Chapter 2: Methods" },
            ],
            patternDescription: "keyword chapters",
            confidence: 0.90,
          }),
        },
      }],
      usage: { prompt_tokens: 500, completion_tokens: 100 },
    });

    const text = "Some intro\nChapter 1: Introduction\nContent here\n\nChapter 2: Methods\nMore content";
    const result = await detectChaptersWithAI(text, config);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.chapters.length).toBeGreaterThanOrEqual(2);
    expect(result.confidence).toBe(0.90);
    expect(result.tokensUsed).toBe(600);
  });

  it("passes correct model and temperature to LLM", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"chapters":[],"patternDescription":"none","confidence":0}' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    await detectChaptersWithAI("some text", config);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        temperature: 0.1,
      })
    );
  });

  it("propagates LLM errors", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit"));

    await expect(
      detectChaptersWithAI("some text", config)
    ).rejects.toThrow("API rate limit");
  });

  it("handles missing usage data gracefully", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"chapters":[],"patternDescription":"none","confidence":0}' } }],
      usage: undefined,
    });

    const result = await detectChaptersWithAI("some text", config);
    expect(result.tokensUsed).toBe(0);
  });

  it("handles empty LLM response content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
      usage: { prompt_tokens: 50, completion_tokens: 0 },
    });

    // Empty string will fail JSON.parse — should propagate error
    await expect(
      detectChaptersWithAI("some text", config)
    ).rejects.toThrow();
  });
});
