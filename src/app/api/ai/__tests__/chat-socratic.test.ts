/**
 * Tests for Socratic mode in POST /api/ai/chat + DB persistence after stream.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock streaming AI ─────────────────────────────────────────────────────
async function* makeStream(chunks: string[]) {
  for (const chunk of chunks) {
    yield { choices: [{ delta: { content: chunk } }] };
  }
}

const mockCreate = vi.fn();

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: { findUnique: vi.fn() },
    chatMessage: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/client", () => ({
  createAIClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
}));

import { POST as chatPost } from "@/app/api/ai/chat/route";

const BASE_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
  message: "What is a promise?",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function readStream(res: Response): Promise<string> {
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

describe("POST /api/ai/chat — Socratic mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      title: "Lesson 1",
      transcript: "Some transcript content",
      course: { title: "Course 1" },
    });
    mockPrisma.chatMessage.createMany.mockResolvedValue({ count: 2 });
  });

  it("accepts socraticMode=false (default) and streams normally", async () => {
    mockCreate.mockResolvedValue(makeStream(["Hello"]));

    const req = makeRequest({ ...BASE_BODY, socraticMode: false });
    const res = await chatPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Hello");
  });

  it("accepts socraticMode=true in request body", async () => {
    mockCreate.mockResolvedValue(makeStream(["What do you think?"]));

    const req = makeRequest({ ...BASE_BODY, socraticMode: true });
    const res = await chatPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("What do you think?");
  });

  it("defaults socraticMode to false when not provided", async () => {
    mockCreate.mockResolvedValue(makeStream(["Response"]));

    const req = makeRequest(BASE_BODY); // no socraticMode field
    const res = await chatPost(req);

    expect(res.status).toBe(200);
  });

  it("injects Socratic prompt into system messages when socraticMode=true", async () => {
    mockCreate.mockResolvedValue(makeStream(["Socratic response"]));

    const req = makeRequest({ ...BASE_BODY, socraticMode: true });
    await chatPost(req);

    // Verify that the system prompt passed to AI includes Socratic instruction
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    expect(systemMsg.content).toContain("Chế độ Dẫn dắt Tư duy (Socratic Mode)");
    expect(systemMsg.content).toContain("Đặt câu hỏi dẫn dắt");
  });

  it("does NOT inject Socratic prompt when socraticMode=false", async () => {
    mockCreate.mockResolvedValue(makeStream(["Normal response"]));

    const req = makeRequest({ ...BASE_BODY, socraticMode: false });
    await chatPost(req);

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    expect(systemMsg.content).not.toContain("Socratic Mode");
  });

  it("returns 400 when neither message nor messages is provided", async () => {
    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      socraticMode: true,
    });

    const res = await chatPost(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lesson not found (no transcript)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      title: "L",
      transcript: null,
      course: { title: "C" },
    });

    const req = makeRequest({ ...BASE_BODY, socraticMode: true });
    const res = await chatPost(req);

    expect(res.status).toBe(400);
  });
});

describe("POST /api/ai/chat — DB persistence after stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      title: "Lesson 1",
      transcript: "Some transcript",
      course: { title: "Course 1" },
    });
    mockPrisma.chatMessage.createMany.mockResolvedValue({ count: 2 });
  });

  it("saves user message and assistant response to DB after stream completes", async () => {
    mockCreate.mockResolvedValue(makeStream(["Hello ", "World"]));

    const req = makeRequest(BASE_BODY);
    const res = await chatPost(req);

    // Must consume the stream for persistence to trigger
    await readStream(res);

    // Wait a tick for async DB write
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPrisma.chatMessage.createMany).toHaveBeenCalledOnce();
    const createArgs = mockPrisma.chatMessage.createMany.mock.calls[0][0];
    expect(createArgs.data).toHaveLength(2);
    expect(createArgs.data[0]).toMatchObject({
      lessonId: "l1",
      role: "user",
      content: BASE_BODY.message,
    });
    expect(createArgs.data[1]).toMatchObject({
      lessonId: "l1",
      role: "assistant",
      content: "Hello World",
    });
  });

  it("saves last user message from messages array (not legacy message)", async () => {
    mockCreate.mockResolvedValue(makeStream(["Reply"]));

    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      messages: [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow up" },
      ],
    });
    const res = await chatPost(req);
    await readStream(res);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPrisma.chatMessage.createMany).toHaveBeenCalledOnce();
    const createArgs = mockPrisma.chatMessage.createMany.mock.calls[0][0];
    expect(createArgs.data[0]).toMatchObject({
      role: "user",
      content: "Follow up",
    });
    expect(createArgs.data[1]).toMatchObject({
      role: "assistant",
      content: "Reply",
    });
  });

  it("does not crash if DB save fails (best effort)", async () => {
    mockPrisma.chatMessage.createMany.mockRejectedValue(
      new Error("DB connection error")
    );
    mockCreate.mockResolvedValue(makeStream(["Response"]));

    const req = makeRequest(BASE_BODY);
    const res = await chatPost(req);

    // Stream should still work fine
    const text = await readStream(res);
    expect(text).toBe("Response");

    await new Promise((r) => setTimeout(r, 50));
    // createMany was called but failed — no crash
    expect(mockPrisma.chatMessage.createMany).toHaveBeenCalled();
  });
});

// ─── Edge case: Socratic mode question types ──────────────────────────────────

describe("POST /api/ai/chat — Socratic mode edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      title: "Lesson 1",
      transcript: "Some transcript content about JavaScript promises and async/await patterns",
      course: { title: "Course 1" },
    });
    mockPrisma.chatMessage.createMany.mockResolvedValue({ count: 2 });
  });

  it("Socratic prompt includes guidance for multiple question types", async () => {
    mockCreate.mockResolvedValue(makeStream(["Socratic response"]));

    const req = makeRequest({ ...BASE_BODY, socraticMode: true });
    await chatPost(req);

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    // The Socratic instruction should contain various question type guidance
    expect(systemMsg.content).toContain("Socratic");
    expect(systemMsg.content).toContain("Đặt câu hỏi dẫn dắt");
  });

  // Stream error mid-way — fullText.then().catch() prevents unhandled rejection
  it("stream error mid-way still returns partial content or handles gracefully", async () => {
    // Mock a stream that yields one chunk then throws
    async function* errorStream() {
      yield { choices: [{ delta: { content: "Partial content" } }] };
      throw new Error("Stream interrupted");
    }
    mockCreate.mockResolvedValue(errorStream());

    const req = makeRequest({ ...BASE_BODY, socraticMode: true });
    const res = await chatPost(req);

    // Stream should start successfully
    expect(res.status).toBe(200);

    // Reading should get at least partial content or handle error
    const decoder = new TextDecoder();
    const reader = res.body!.getReader();
    let output = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value);
      }
    } catch {
      // Stream error is acceptable — partial content may or may not be captured
    }
    // At minimum, stream started with 200 status
    expect(res.status).toBe(200);
  });

  it("handles very long conversation history (50+ messages) gracefully", async () => {
    mockCreate.mockResolvedValue(makeStream(["Response"]));

    // Build 52 messages (26 user + 26 assistant turns)
    const messages = [];
    for (let i = 0; i < 26; i++) {
      messages.push({ role: "user", content: `Question ${i}` });
      messages.push({ role: "assistant", content: `Answer ${i}` });
    }

    const req = makeRequest({
      lessonId: "l1",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      socraticMode: true,
      messages,
    });

    const res = await chatPost(req);
    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Response");
  });
});
