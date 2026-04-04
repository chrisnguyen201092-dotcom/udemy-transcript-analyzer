/**
 * Unit tests for createThinkFilteredStream (src/lib/ai/stream.ts).
 *
 * Covers:
 * - Normal streaming (no think tags): output passes through unchanged
 * - <think>...</think> blocks stripped from output
 * - Stream error → fullText promise rejects (C-6 regression)
 * - Partial think tag at chunk boundary handled correctly
 * - STREAM_HEADERS shape
 */
import { describe, it, expect } from "vitest";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";
import type OpenAI from "openai";

// ─── Helper: build a mock AsyncIterable from chunks ───────────────────────────

function makeChunks(
  contents: (string | null)[]
): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
  async function* gen() {
    for (const content of contents) {
      yield {
        choices: [{ delta: { content: content ?? "" } }],
      } as OpenAI.Chat.Completions.ChatCompletionChunk;
    }
  }
  return gen();
}

// ─── Helper: consume a ReadableStream into a string ──────────────────────────

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createThinkFilteredStream", () => {
  // ── 1. Normal passthrough ──────────────────────────────────────────────────

  it("passes through plain text with no think tags", async () => {
    const input = makeChunks(["Hello, ", "world!"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe("Hello, world!");
    expect(text).toBe("Hello, world!");
  });

  it("resolves fullText to the concatenated assistant response", async () => {
    const input = makeChunks(["foo", "bar", "baz"]);
    const { fullText } = createThinkFilteredStream(input);

    await expect(fullText).resolves.toBe("foobarbaz");
  });

  // ── 2. Think-tag stripping ─────────────────────────────────────────────────

  it("strips a single <think>...</think> block", async () => {
    const input = makeChunks(["Before", "<think>hidden</think>", "After"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).not.toContain("<think>");
    expect(output).not.toContain("hidden");
    expect(output).toContain("Before");
    expect(output).toContain("After");
    expect(text).not.toContain("hidden");
  });

  it("strips think block split across multiple chunks", async () => {
    // Tag split: "<thi" | "nk>content</thi" | "nk>tail"
    const input = makeChunks(["start <thi", "nk>secret</thi", "nk> end"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).not.toContain("secret");
    expect(output).toContain("start");
    expect(output).toContain("end");
    expect(text).not.toContain("secret");
  });

  it("strips multiple think blocks", async () => {
    const input = makeChunks([
      "A<think>one</think>B<think>two</think>C",
    ]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe("ABC");
    expect(text).toBe("ABC");
  });

  it("handles think block at start", async () => {
    const input = makeChunks(["<think>ignore this</think>real content"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe("real content");
    expect(text).toBe("real content");
  });

  it("handles think block at end", async () => {
    const input = makeChunks(["real content<think>trailing</think>"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe("real content");
    expect(text).toBe("real content");
  });

  // ── 3. C-6 regression: stream error → fullText rejects ────────────────────

  it("C-6 regression: stream error causes fullText promise to reject", async () => {
    const error = new Error("OpenAI stream failed");

    async function* failingGen() {
      yield {
        choices: [{ delta: { content: "partial" } }],
      } as OpenAI.Chat.Completions.ChatCompletionChunk;
      throw error;
    }

    const { stream, fullText } = createThinkFilteredStream(failingGen());

    // Consume the stream (it will error)
    try {
      await readStream(stream);
    } catch {
      // Expected — stream controller.error() propagates here
    }

    // fullText must reject, not hang
    await expect(fullText).rejects.toThrow("OpenAI stream failed");
  });

  it("C-6 regression: fullText rejects even if stream error is consumed silently", async () => {
    const error = new Error("network error");

    async function* failingGen() {
      throw error;
    }

    const { stream, fullText } = createThinkFilteredStream(failingGen());

    // Silently drain stream
    const reader = stream.getReader();
    await reader.read().catch(() => undefined);

    await expect(fullText).rejects.toThrow("network error");
  });

  // ── 4. Empty/null content chunks ──────────────────────────────────────────

  it("ignores chunks with empty string content", async () => {
    const input = makeChunks(["hello", "", null, " world"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe("hello world");
    expect(text).toBe("hello world");
  });

  it("returns empty string for completely empty stream", async () => {
    const input = makeChunks([]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe("");
    expect(text).toBe("");
  });

  it("handles stream with only think tags — returns empty content", async () => {
    const input = makeChunks(["<think>all thinking</think>"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).not.toContain("all thinking");
    expect(text).not.toContain("all thinking");
  });

  it("handles very large chunk (>1MB)", async () => {
    const largeContent = "x".repeat(1024 * 1024 + 1); // >1MB
    const input = makeChunks([largeContent]);
    const { stream, fullText } = createThinkFilteredStream(input);

    const output = await readStream(stream);
    const text = await fullText;

    expect(output).toBe(largeContent);
    expect(text).toBe(largeContent);
  });

  it("handles stream that ends mid-think-tag", async () => {
    // Stream ends with partial "<thi" — no closing tag, so leftover should pass through
    const input = makeChunks(["hello <thi"]);
    const { stream, fullText } = createThinkFilteredStream(input);

    await readStream(stream);
    const text = await fullText;

    // Partial tag never completed — content should contain "hello" at minimum
    expect(text).toContain("hello");
  });
});

// ─── STREAM_HEADERS ───────────────────────────────────────────────────────────

describe("STREAM_HEADERS", () => {
  it("has the expected content-type for streaming text", () => {
    expect(STREAM_HEADERS["Content-Type"]).toBe("text/plain; charset=utf-8");
  });

  it("includes Transfer-Encoding chunked", () => {
    expect(STREAM_HEADERS["Transfer-Encoding"]).toBe("chunked");
  });
});
