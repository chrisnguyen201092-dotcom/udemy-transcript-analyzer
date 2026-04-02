/**
 * Integration tests for POST /api/ai/chat (SSE streaming).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock streaming AI ─────────────────────────────────────────────────────
async function* makeStream(chunks: string[]) {
  for (const chunk of chunks) {
    yield { choices: [{ delta: { content: chunk } }] };
  }
}

const { mockCreate, mockPrisma } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(), update: vi.fn(), create: vi.fn(),
      findFirst: vi.fn(), count: vi.fn(), deleteMany: vi.fn(),
    },
    course: {
      findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(),
      findUnique: vi.fn(), delete: vi.fn(), update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
  getCleanHeaders: vi.fn(),
}));

import { POST as chatPost } from "@/app/api/ai/chat/route";

const VALID_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
  message: "What is this lesson about?",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when lesson has no transcript", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: null, course: { title: "C" },
    });

    const req = makeRequest(VALID_BODY);
    const res = await chatPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when neither message nor messages is provided", async () => {
    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      // no message, no messages
    });

    const res = await chatPost(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is empty array (refine check)", async () => {
    const req = makeRequest({
      ...VALID_BODY,
      message: undefined,
      messages: [],
    });

    const res = await chatPost(req);
    expect(res.status).toBe(400);
  });

  it("returns streaming response with text/plain Content-Type", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: "Some transcript", course: { title: "C" },
    });
    mockCreate.mockResolvedValue(makeStream(["Hello ", "World"]));

    const req = makeRequest(VALID_BODY);
    const res = await chatPost(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });

  it("strips <think> blocks from streamed content", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    // Deliver think block across chunks
    mockCreate.mockResolvedValue(makeStream([
      "<think>internal reasoning</think>",
      "Clean response",
    ]));

    const req = makeRequest(VALID_BODY);
    const res = await chatPost(req);

    const decoder = new TextDecoder();
    const reader = res.body!.getReader();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
    }

    expect(output).toBe("Clean response");
    expect(output).not.toContain("<think>");
  });

  it("accepts messages array (full history mode)", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    mockCreate.mockResolvedValue(makeStream(["Response"]));

    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      messages: [
        { role: "user", content: "What is X?" },
        { role: "assistant", content: "X is Y" },
        { role: "user", content: "Tell me more" },
      ],
    });

    const res = await chatPost(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 when baseUrl is invalid", async () => {
    const req = makeRequest({ ...VALID_BODY, baseUrl: "bad-url" });
    const res = await chatPost(req);

    expect(res.status).toBe(400);
  });

  it("think block split across stream chunks is still stripped", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    // Split the think tag across multiple chunks
    mockCreate.mockResolvedValue(makeStream([
      "Before<thi",
      "nk>hidden</think>After",
    ]));

    const req = makeRequest(VALID_BODY);
    const res = await chatPost(req);

    const decoder = new TextDecoder();
    const reader = res.body!.getReader();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
    }

    expect(output).toContain("Before");
    expect(output).toContain("After");
    expect(output).not.toContain("<think>");
    expect(output).not.toContain("hidden");
  });

  // ─── Edge case: handles long conversation history (>20 messages) ────────────
  it("handles conversation with 21+ messages gracefully", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    mockCreate.mockResolvedValue(makeStream(["Response"]));

    // Build 22 messages (11 user + 11 assistant turns)
    const messages = [];
    for (let i = 0; i < 11; i++) {
      messages.push({ role: "user", content: `Question ${i}` });
      messages.push({ role: "assistant", content: `Answer ${i}` });
    }

    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      messages,
    });

    const res = await chatPost(req);
    expect(res.status).toBe(200);
  });

  // ─── Edge case: returns 400 for empty message ──────────────────────────────
  it("returns 400 for empty message string", async () => {
    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      message: "",
    });

    const res = await chatPost(req);
    // Empty message + no messages array → refine check fails
    expect(res.status).toBe(400);
  });

  // ─── Edge case: lesson with no transcript ──────────────────────────────────
  it("handles lesson with no transcript in chat context — returns 400", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "L", transcript: null, course: { title: "C" },
    });

    const req = makeRequest(VALID_BODY);
    const res = await chatPost(req);

    expect(res.status).toBe(400);
  });

  // ─── Edge case: message is not a string ────────────────────────────────────
  it("returns 400 when message is a number instead of string", async () => {
    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      message: 123,
    });

    const res = await chatPost(req);
    expect(res.status).toBe(400);
  });
});
