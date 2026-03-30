/**
 * Integration tests for POST /api/ai/explain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
  getCleanHeaders: vi.fn(() => ({
    Authorization: "Bearer test",
    "Content-Type": "application/json",
    "User-Agent": "udemy-learner/1.0",
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
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when lesson has no transcript", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: null, course: { title: "C" },
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
      id: "l1", title: "L", transcript: "Transcript", course: { title: "C" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "<think>reasoning</think>Explanation here" } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await explainPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.explanation).toBe("Explanation here");
    expect(json.explanation).not.toContain("<think>");
  });

  it("persists explanation to DB via lesson.update with explanation field", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Detailed explanation" } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    await explainPost(req);

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { explanation: "Detailed explanation" },
    });
  });

  it("returns 200 with explanation field in response", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "My explanation" } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await explainPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("explanation");
  });

  it("strips multiple <think> blocks", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "<think>a</think>Part one<think>b</think>Part two" } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await explainPost(req);
    const json = await res.json();

    expect(json.explanation).toBe("Part onePart two");
  });

  it("returns 400 when apiKey is empty", async () => {
    const req = makeRequest({ ...VALID_BODY, apiKey: "" });
    const res = await explainPost(req);

    expect(res.status).toBe(400);
  });
});
