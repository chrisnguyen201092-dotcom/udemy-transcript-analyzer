/**
 * Integration tests for POST /api/ai/roadmap.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreate, mockPrisma } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPrisma: {
    course: {
      findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(),
      create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(),
    },
    lesson: {
      findUnique: vi.fn(), update: vi.fn(), create: vi.fn(),
      findFirst: vi.fn(), count: vi.fn(), deleteMany: vi.fn(),
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

import { POST as roadmapPost } from "@/app/api/ai/roadmap/route";

const VALID_BODY = {
  courseId: "c1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/roadmap", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ai/roadmap", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 404 when course does not exist", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const req = makeRequest(VALID_BODY);
    const res = await roadmapPost(req);

    expect(res.status).toBe(404);
  });

  it("returns 400 when no lessons have transcripts", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Course",
      lessons: [
        { title: "L1", order: 1, transcript: null },
        { title: "L2", order: 2, transcript: null },
      ],
    });

    const req = makeRequest(VALID_BODY);
    const res = await roadmapPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 200 with roadmap when lessons have transcripts", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "JS Course",
      lessons: [
        { title: "Intro", order: 1, transcript: "Welcome to JavaScript" },
        { title: "Variables", order: 2, transcript: null },
      ],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Roadmap content" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const req = makeRequest(VALID_BODY);
    const res = await roadmapPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Roadmap content");
  });

  it("persists roadmap to Course (not Lesson)", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1", title: "C",
      lessons: [{ title: "L", order: 1, transcript: "Text" }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Roadmap here" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const req = makeRequest(VALID_BODY);
    await roadmapPost(req);

    expect(mockPrisma.course.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { roadmap: "Roadmap here" },
    });
    expect(mockPrisma.lesson.update).not.toHaveBeenCalled();
  });

  it("truncates each transcript to 4000 chars", async () => {
    const longTranscript = "A".repeat(5000);
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1", title: "C",
      lessons: [{ title: "L", order: 1, transcript: longTranscript }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const req = makeRequest(VALID_BODY);
    await roadmapPost(req);

    const aiCallArgs = mockCreate.mock.calls[0][0];
    const userContent = aiCallArgs.messages[1].content as string;
    // Should contain truncation notice
    expect(userContent).toContain("đã rút gọn");
    // Extract just the transcript body after the "--- Bài N: ... ---\n" header
    // and before the truncation notice (or end of block), then verify it's ≤ 4000 chars.
    const match = userContent.match(/---[^\n]+---\n([\s\S]*?)(?:\n\.\.\.|$)/);
    const transcriptSlice = match?.[1] ?? "";
    expect(transcriptSlice.length).toBeLessThanOrEqual(4000);
  });

  it("strips <think> tags from roadmap response", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1", title: "C",
      lessons: [{ title: "L", order: 1, transcript: "T" }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "<think>analysis</think>Clean roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const req = makeRequest(VALID_BODY);
    const res = await roadmapPost(req);
    const json = await res.json();

    expect(json.roadmap).toBe("Clean roadmap");
    expect(json.roadmap).not.toContain("<think>");
  });

  it("includes lesson list in AI prompt user message", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1", title: "My Course",
      lessons: [
        { title: "Intro", order: 1, transcript: "Content" },
        { title: "Advanced", order: 2, transcript: null },
      ],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const req = makeRequest(VALID_BODY);
    await roadmapPost(req);

    const aiCallArgs = mockCreate.mock.calls[0][0];
    const userContent = aiCallArgs.messages[1].content as string;
    expect(userContent).toContain("Intro");
    expect(userContent).toContain("Advanced");
    expect(userContent).toContain("My Course");
  });

  it("returns 400 when baseUrl is invalid", async () => {
    const req = makeRequest({ ...VALID_BODY, baseUrl: "invalid-url" });
    const res = await roadmapPost(req);

    expect(res.status).toBe(400);
  });
});
