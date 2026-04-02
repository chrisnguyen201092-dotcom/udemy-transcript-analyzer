/**
 * Integration tests for POST /api/ai/explain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Streaming helper ─────────────────────────────────────────────────────────
async function* makeChunkStream(content: string) {
  yield { choices: [{ delta: { content } }] };
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
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
    learnerProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
  getCleanHeaders: vi.fn(() => ({
    Authorization: "Bearer test",
    "Content-Type": "application/json",
    "User-Agent": "inkgest/1.0",
  })),
}));

import { POST as explainPost } from "@/app/api/ai/explain/route";

const VALID_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/explain", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ai/explain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
  });

  it("returns 400 when lesson has no transcript", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: null, course: { title: "C", contentType: "course" },
    });

    const req = makeRequest(VALID_BODY);
    const res = await explainPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when baseUrl is invalid", async () => {
    const req = makeRequest({ ...VALID_BODY, baseUrl: "not-valid" });
    const res = await explainPost(req);

    expect(res.status).toBe(400);
  });

  it("strips <think> tags from AI response", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "Transcript", course: { title: "C", contentType: "course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("<think>reasoning</think>Explanation here"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await readStream(await explainPost(req));

    expect(res).toBe("Explanation here");
    expect(res).not.toContain("<think>");
  });

  it("persists explanation to DB via lesson.update with explanation field", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C", contentType: "course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("Detailed explanation"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const apiRes = await explainPost(req);
    await readStream(apiRes);
    await new Promise((r) => setTimeout(r, 0)); // flush fullText.then() microtask

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { explanation: "Detailed explanation" },
    });
  });

  it("returns 200 with explanation field in response", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C", contentType: "course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("My explanation"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const apiRes = await explainPost(req);

    expect(apiRes.status).toBe(200);
    expect(apiRes.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

    const text = await readStream(apiRes);
    expect(text).toBe("My explanation");
  });

  it("strips multiple <think> blocks", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C", contentType: "course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("<think>a</think>Part one<think>b</think>Part two"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const text = await readStream(await explainPost(req));

    expect(text).toBe("Part onePart two");
  });

  it("returns 400 when apiKey is empty", async () => {
    const req = makeRequest({ ...VALID_BODY, apiKey: "" });
    const res = await explainPost(req);

    expect(res.status).toBe(400);
  });

  // ─── Edge case: handles selectedText parameter ──────────────────────────────
  it("handles selectedText parameter and includes it in prompt", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "Full transcript here", course: { title: "C", contentType: "course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("Focused explanation"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest({ ...VALID_BODY, selectedText: "specific concept" });
    const res = await explainPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Focused explanation");

    // Verify user message contains selectedText
    const userMsg = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMsg).toContain("specific concept");
  });

  // ─── Edge case: returns 400 when lessonId is missing ────────────────────────
  it("returns 400 when lessonId is missing", async () => {
    const req = makeRequest({
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    });
    const res = await explainPost(req);

    expect(res.status).toBe(400);
  });

  // ─── Edge case: lesson with no transcript ───────────────────────────────────
  it("handles lesson with no transcript — returns 400", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: null, course: { title: "C", contentType: "course" },
    });

    const req = makeRequest(VALID_BODY);
    const res = await explainPost(req);

    // Route requires transcript — returns 400 when null
    expect(res.status).toBe(400);
  });
});
