/**
 * Tests for LearnerProfile + Progress integration in POST /api/ai/roadmap
 * and GET /api/courses/[id]/ai.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreate, mockPrisma } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    lesson: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    learnerProfile: { findUnique: vi.fn() },
    lessonProgress: { findMany: vi.fn() },
    courseProgress: { findUnique: vi.fn() },
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
import { GET as courseAiGet } from "@/app/api/courses/[id]/ai/route";

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

function makeCourseWithLessons(overrides?: {
  roadmap?: string | null;
  lessonIds?: string[];
}) {
  return {
    id: "c1",
    title: "JS Course",
    roadmap: overrides?.roadmap ?? null,
    lessons: [
      {
        id: overrides?.lessonIds?.[0] ?? "l1",
        title: "Intro",
        order: 1,
        transcript: "Welcome to JavaScript basics",
      },
      {
        id: overrides?.lessonIds?.[1] ?? "l2",
        title: "Variables",
        order: 2,
        transcript: "Let and const are block-scoped",
      },
    ],
  };
}

describe("POST /api/ai/roadmap — LearnerProfile + Progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Backward compatibility ──────────────────────────────────────

  it("generates roadmap without profile (backward compat)", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourseWithLessons());
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Roadmap");
    // No profile context in prompt
    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).not.toContain("Hồ sơ người học");
  });

  // ── Profile found ───────────────────────────────────────────────

  it("injects profile context into prompt when profile exists", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourseWithLessons());
    mockPrisma.learnerProfile.findUnique.mockResolvedValue({
      id: "p1",
      courseId: "c1",
      level: "beginner",
      goal: "career_change",
      dailyTimeMin: 60,
      knownTopics: JSON.stringify(["HTML", "CSS"]),
      learningStyle: "hands_on",
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Personalized Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Personalized Roadmap");

    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).toContain("Hồ sơ người học");
    expect(userContent).toContain("beginner");
    expect(userContent).toContain("career_change");
    expect(userContent).toContain("60");
    expect(userContent).toContain("HTML");
    expect(userContent).toContain("CSS");
    expect(userContent).toContain("hands_on");
  });

  // ── Profile not found ──────────────────────────────────────────

  it("generates normally when profile not found (no error)", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourseWithLessons());
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Generic Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).not.toContain("Hồ sơ người học");
  });

  // ── Progress data found ────────────────────────────────────────

  it("injects progress context into prompt when progress exists", async () => {
    const course = makeCourseWithLessons({ lessonIds: ["l1", "l2"] });
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true },
    ]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Progress Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Progress Roadmap");

    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).toContain("Tiến độ hiện tại");
    expect(userContent).toContain("1/2");
    expect(userContent).toContain("Intro");
    expect(userContent).toContain("✅");
  });

  // ── No progress ────────────────────────────────────────────────

  it("does not include progress section when no progress data", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourseWithLessons());
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    await roadmapPost(makeRequest(VALID_BODY));

    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).not.toContain("Tiến độ hiện tại");
  });

  // ── Both profile AND progress ──────────────────────────────────

  it("injects both profile and progress when both exist", async () => {
    const course = makeCourseWithLessons({ lessonIds: ["l1", "l2"] });
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.learnerProfile.findUnique.mockResolvedValue({
      id: "p1",
      courseId: "c1",
      level: "intermediate",
      goal: "exam_prep",
      dailyTimeMin: 90,
      knownTopics: JSON.stringify(["JavaScript"]),
      learningStyle: "theory_first",
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true },
      { lessonId: "l2", completed: true },
    ]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Full Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).toContain("Hồ sơ người học");
    expect(userContent).toContain("intermediate");
    expect(userContent).toContain("Tiến độ hiện tại");
    expect(userContent).toContain("2/2");
  });

  // ── Profile with empty knownTopics ─────────────────────────────

  it("handles profile with empty knownTopics gracefully", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourseWithLessons());
    mockPrisma.learnerProfile.findUnique.mockResolvedValue({
      id: "p1",
      courseId: "c1",
      level: "advanced",
      goal: "hobby",
      dailyTimeMin: 30,
      knownTopics: null,
      learningStyle: "balanced",
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const userContent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userContent).toContain("Hồ sơ người học");
    expect(userContent).not.toContain("Các chủ đề đã biết");
  });

  // ── Cache guard works ──────────────────────────────────────────

  it("returns cached roadmap without calling AI", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(
      makeCourseWithLessons({ roadmap: "## Cached" })
    );

    const res = await roadmapPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Cached");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPrisma.learnerProfile.findUnique).not.toHaveBeenCalled();
  });

  // ── force=true regenerates ─────────────────────────────────────

  it("regenerates when force=true despite cached roadmap", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(
      makeCourseWithLessons({ roadmap: "## Old", lessonIds: ["l1", "l2"] })
    );
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## New Roadmap" } }],
    });
    mockPrisma.course.update.mockResolvedValue({ id: "c1" });

    const res = await roadmapPost(
      makeRequest({ ...VALID_BODY, force: true })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## New Roadmap");
    expect(mockCreate).toHaveBeenCalled();
  });

  // ── Course not found ───────────────────────────────────────────

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const res = await roadmapPost(makeRequest(VALID_BODY));

    expect(res.status).toBe(404);
  });

  // ── No transcripts ─────────────────────────────────────────────

  it("returns 400 when no transcripts available", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Empty",
      roadmap: null,
      lessons: [
        { id: "l1", title: "L1", order: 1, transcript: null },
      ],
    });

    const res = await roadmapPost(makeRequest(VALID_BODY));

    expect(res.status).toBe(400);
  });
});

// ── GET /api/courses/[id]/ai — hasProfile + progressPercent ──────

describe("GET /api/courses/[id]/ai — hasProfile + progressPercent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeGetRequest(id: string) {
    const req = new NextRequest(`http://localhost/api/courses/${id}/ai`, {
      method: "GET",
    });
    return { req, params: Promise.resolve({ id }) };
  }

  it("returns roadmap, hasProfile=true and progressPercent when data exists", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      roadmap: "## My Roadmap",
    });
    mockPrisma.learnerProfile.findUnique.mockResolvedValue({
      id: "p1",
      courseId: "c1",
    });
    mockPrisma.courseProgress.findUnique.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 42.5,
    });

    const { req, params } = makeGetRequest("c1");
    const res = await courseAiGet(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## My Roadmap");
    expect(json.hasProfile).toBe(true);
    expect(json.progressPercent).toBe(42.5);
  });

  it("returns hasProfile=false and progressPercent=0 when no profile/progress", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      roadmap: null,
    });
    mockPrisma.learnerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.courseProgress.findUnique.mockResolvedValue(null);

    const { req, params } = makeGetRequest("c1");
    const res = await courseAiGet(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBeNull();
    expect(json.hasProfile).toBe(false);
    expect(json.progressPercent).toBe(0);
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const { req, params } = makeGetRequest("nonexistent");
    const res = await courseAiGet(req, { params });

    expect(res.status).toBe(404);
  });
});
