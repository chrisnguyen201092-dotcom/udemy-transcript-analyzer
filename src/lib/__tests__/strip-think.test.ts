/**
 * Unit tests for think-tag stripping utility.
 *
 * The regex `raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim()` is currently
 * INLINE in every AI route. Tests import from @/lib/strip-think which does NOT
 * exist yet — confirms RED state.
 */
import { describe, it, expect } from "vitest";
import { stripThinkTags } from "@/lib/strip-think";

describe("stripThinkTags", () => {
  it("removes a single <think>...</think> block", () => {
    const input = "<think>internal reasoning</think>Final answer";
    expect(stripThinkTags(input)).toBe("Final answer");
  });

  it("removes multiple <think> blocks in one string", () => {
    const input = "<think>first</think>Answer<think>second</think> here";
    expect(stripThinkTags(input)).toBe("Answer here");
  });

  it("removes <think> block with newlines inside (multiline)", () => {
    const input = "<think>\nline1\nline2\n</think>Result";
    expect(stripThinkTags(input)).toBe("Result");
  });

  it("trims leading/trailing whitespace after stripping", () => {
    const input = "  <think>thinking</think>  Answer  ";
    expect(stripThinkTags(input)).toBe("Answer");
  });

  it("returns string unchanged when no <think> tags present", () => {
    const input = "Plain answer without think tags";
    expect(stripThinkTags(input)).toBe("Plain answer without think tags");
  });

  it("returns empty string for think-tag-only input", () => {
    const input = "<think>only thinking here</think>";
    expect(stripThinkTags(input)).toBe("");
  });

  it("handles <think> with special regex characters inside", () => {
    const input = "<think>match .* everything (a|b)+</think>Clean";
    expect(stripThinkTags(input)).toBe("Clean");
  });

  it("does NOT remove partial/malformed tags", () => {
    const input = "<think>not closed output";
    // Non-greedy [\s\S]*? requires a matching </think>
    expect(stripThinkTags(input)).toBe("<think>not closed output");
  });

  it("handles consecutive think blocks with content between them", () => {
    const input = "<think>a</think>middle<think>b</think>end";
    expect(stripThinkTags(input)).toBe("middleend");
  });

  it("handles empty <think></think> block", () => {
    const input = "<think></think>Answer";
    expect(stripThinkTags(input)).toBe("Answer");
  });

  it("preserves markdown formatting outside think blocks", () => {
    const input = "<think>thinking</think>## Heading\n- item 1\n- item 2";
    expect(stripThinkTags(input)).toBe("## Heading\n- item 1\n- item 2");
  });
});
