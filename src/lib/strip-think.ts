/**
 * Utility: strip <think>...</think> blocks from AI model responses.
 *
 * Some reasoning models (e.g. DeepSeek-R1, QwQ) emit internal thought chains
 * wrapped in <think> tags before their final answer. This helper removes those
 * blocks and trims surrounding whitespace so callers receive only the visible
 * response content.
 */

/**
 * Remove all `<think>…</think>` blocks from a string and trim the result.
 *
 * - Non-greedy (`[\s\S]*?`) — handles multiple blocks in one string.
 * - Unclosed tags are left intact (non-greedy requires a matching `</think>`).
 */
export function stripThinkTags(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
