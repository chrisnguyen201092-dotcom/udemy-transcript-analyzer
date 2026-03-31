/**
 * AI-assisted chapter splitting via multi-slice sampling.
 *
 * When heuristic detection fails (low confidence or fallback),
 * this module sends representative text slices to an LLM to identify
 * chapter boundaries.
 *
 * Strategy: sample 3 slices (beginning, middle, end) of the text,
 * ask the LLM to identify chapter heading patterns, then apply those
 * patterns back to the full text.
 *
 * Covers B-18: AI fallback for chapter detection.
 */

import { createAIClient } from "@/lib/ai/client";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AIChapter {
  title: string;
  /** 0-based line index where this chapter starts. */
  startLine: number;
}

export interface AISplitResult {
  chapters: AIChapter[];
  /** Model-reported confidence 0–1 (from LLM JSON output). */
  confidence: number;
  /** Token usage for cost tracking. */
  tokensUsed: number;
}

export interface AISplitConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Max tokens for the completion (default: 2000). */
  maxTokens?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Max characters per slice to stay within context limits. */
const SLICE_CHARS = 3000;

/** Number of slices: beginning, middle, end. */
const SLICE_COUNT = 3;

/** Default max tokens for completion. */
const DEFAULT_MAX_TOKENS = 2000;

// ── Slice sampling ─────────────────────────────────────────────────────────

/**
 * Extract representative slices from text for LLM analysis.
 * Returns beginning, middle, and end slices with line offsets.
 */
function sampleSlices(
  lines: string[],
  sliceChars: number = SLICE_CHARS
): { text: string; startLine: number; label: string }[] {
  const totalLines = lines.length;
  if (totalLines === 0) return [];

  // For short texts, just send everything
  const fullText = lines.join("\n");
  if (fullText.length <= sliceChars * SLICE_COUNT) {
    return [{ text: fullText, startLine: 0, label: "full" }];
  }

  const slices: { text: string; startLine: number; label: string }[] = [];

  // Beginning slice
  const beginSlice = extractSlice(lines, 0, sliceChars);
  slices.push({ ...beginSlice, label: "beginning" });

  // Middle slice
  const midStart = Math.max(0, Math.floor(totalLines / 2) - 20);
  const midSlice = extractSlice(lines, midStart, sliceChars);
  slices.push({ ...midSlice, label: "middle" });

  // End slice — work backwards
  const endSlice = extractSliceFromEnd(lines, sliceChars);
  slices.push({ ...endSlice, label: "end" });

  return slices;
}

function extractSlice(
  lines: string[],
  startLine: number,
  maxChars: number
): { text: string; startLine: number } {
  let chars = 0;
  let endLine = startLine;

  for (let i = startLine; i < lines.length; i++) {
    chars += lines[i].length + 1; // +1 for newline
    endLine = i + 1;
    if (chars >= maxChars) break;
  }

  return {
    text: lines.slice(startLine, endLine).join("\n"),
    startLine,
  };
}

function extractSliceFromEnd(
  lines: string[],
  maxChars: number
): { text: string; startLine: number } {
  let chars = 0;
  let startLine = lines.length;

  for (let i = lines.length - 1; i >= 0; i--) {
    chars += lines[i].length + 1;
    startLine = i;
    if (chars >= maxChars) break;
  }

  return {
    text: lines.slice(startLine).join("\n"),
    startLine,
  };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(
  slices: { text: string; startLine: number; label: string }[]
): string {
  const sliceBlocks = slices
    .map(
      (s) =>
        `--- SLICE "${s.label}" (starts at line ${s.startLine}) ---\n${s.text}\n--- END SLICE ---`
    )
    .join("\n\n");

  return `You are a document structure analyzer. Given text slices from a book/document, identify chapter or section boundaries.

TASK: Find all chapter/section headings in these text slices. A heading is a line that starts a new major section (chapter, part, lesson, etc.)

TEXT SLICES:
${sliceBlocks}

RESPOND WITH ONLY valid JSON (no markdown code fences):
{
  "chapters": [
    { "title": "Chapter heading text", "linePattern": "exact text of the heading line" }
  ],
  "patternDescription": "Brief description of the heading pattern you found",
  "confidence": 0.85
}

RULES:
- "confidence" is 0–1 indicating how sure you are about the pattern.
- "linePattern" must be the EXACT text of heading lines as they appear in the slices.
- Only include major divisions (chapters, parts, lessons), not sub-sections.
- If no clear pattern exists, return {"chapters": [], "patternDescription": "none", "confidence": 0}.
- Return ONLY the JSON object, nothing else.`;
}

// ── Parse LLM response ─────────────────────────────────────────────────────

interface LLMChapterResponse {
  chapters: { title: string; linePattern: string }[];
  patternDescription: string;
  confidence: number;
}

function parseLLMResponse(raw: string): LLMChapterResponse {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(cleaned) as LLMChapterResponse;

  // Validate shape
  if (!Array.isArray(parsed.chapters)) {
    return { chapters: [], patternDescription: "none", confidence: 0 };
  }

  // Clamp confidence
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0));

  return parsed;
}

// ── Apply patterns to full text ────────────────────────────────────────────

function applyPatternsToFullText(
  lines: string[],
  llmChapters: { title: string; linePattern: string }[]
): AIChapter[] {
  if (llmChapters.length === 0) return [];

  // Build regex patterns from the LLM-identified heading lines
  const headingPatterns = llmChapters.map((ch) => {
    // Escape regex special chars, allow flexible whitespace
    const escaped = ch.linePattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    return new RegExp(`^\\s*${escaped}\\s*$`, "i");
  });

  // Also create a generalized pattern from the heading structure
  const generalPattern = inferGeneralPattern(llmChapters);

  const chapters: AIChapter[] = [];
  const seen = new Set<number>();

  // First pass: exact matches from LLM-identified patterns
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;

    for (const pattern of headingPatterns) {
      if (pattern.test(lines[i]) && !seen.has(i)) {
        chapters.push({ title: trimmed, startLine: i });
        seen.add(i);
        break;
      }
    }
  }

  // Second pass: generalized pattern for headings not in the slices
  if (generalPattern) {
    for (let i = 0; i < lines.length; i++) {
      if (seen.has(i)) continue;
      const trimmed = lines[i].trim();
      if (trimmed.length === 0) continue;

      if (generalPattern.test(trimmed)) {
        chapters.push({ title: trimmed, startLine: i });
        seen.add(i);
      }
    }
  }

  // Sort by line position
  chapters.sort((a, b) => a.startLine - b.startLine);
  return chapters;
}

/**
 * Try to infer a general regex pattern from the LLM-identified headings.
 * E.g., if all headings match "Chương N. Title", create a regex for that.
 */
function inferGeneralPattern(
  chapters: { title: string; linePattern: string }[]
): RegExp | null {
  if (chapters.length < 2) return null;

  // Common patterns to test
  const patterns = [
    /^(chapter|chương|phần|part|bài|lesson)\s+\d+/i,
    /^(mục|section)\s+\d+/i,
    /^\d+\.\s+\S/,
    /^#{1,2}\s+\S/,
  ];

  // Find which pattern matches most headings
  for (const pattern of patterns) {
    const matches = chapters.filter((ch) => pattern.test(ch.linePattern.trim()));
    if (matches.length >= chapters.length * 0.6) {
      return pattern;
    }
  }

  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Use an LLM to detect chapter boundaries when heuristic detection fails.
 *
 * Sends representative text slices to the model, gets heading patterns back,
 * then applies those patterns to the full text.
 *
 * @throws Error if the LLM call fails or returns invalid JSON.
 */
export async function detectChaptersWithAI(
  text: string,
  config: AISplitConfig
): Promise<AISplitResult> {
  const lines = text.split("\n");
  const slices = sampleSlices(lines);

  if (slices.length === 0) {
    return { chapters: [], confidence: 0, tokensUsed: 0 };
  }

  const safeBaseUrl = validateBaseUrl(config.baseUrl);
  const client = createAIClient(config.apiKey, safeBaseUrl);
  const prompt = buildPrompt(slices);

  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: 0.1, // Low temp for structured output
  });

  const responseText = completion.choices[0]?.message?.content ?? "";
  const tokensUsed =
    (completion.usage?.prompt_tokens ?? 0) + (completion.usage?.completion_tokens ?? 0);

  const llmResult = parseLLMResponse(responseText);

  // Apply LLM-identified patterns to full text
  const chapters = applyPatternsToFullText(lines, llmResult.chapters);

  return {
    chapters,
    confidence: llmResult.confidence,
    tokensUsed,
  };
}

// ── Exports for testing ────────────────────────────────────────────────────

export const _testExports = {
  sampleSlices,
  buildPrompt,
  parseLLMResponse,
  applyPatternsToFullText,
  inferGeneralPattern,
};
