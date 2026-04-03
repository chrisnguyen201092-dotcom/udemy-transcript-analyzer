/**
 * Integration tests for POST /api/ai/study-plan.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockCreate, mockPrisma } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPrisma: {
    lesson: {
      findFirst: vi.fn(),
      update: vi.fn(),
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
}));

import { POST as studyPlanPost } from "@/app/api/ai/study-plan/route";

const VALID_BODY = {
  courseId: "course1",
  availableDays: 7,
  hoursPerDay: 1,
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/study-plan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_LESSONS = [
  { id: "l1", title: "Chapter 1: Introduction", transcript: "word ".repeat(1000), order: 1 },
  { id: "l2", title: "Chapter 2: Core Concepts", transcript: "word ".repeat(2000), order: 2 },
  { id: "l3", title: "Chapter 3: Advanced Topics", transcript: "word ".repeat(1500), order: 3 },
];

const SAMPLE_PLAN = {
  days: [
    {
      day: 1,
      chapters: [{ id: "l1", title: "Chapter 1: Introduction", estimatedMinutes: 25 }],
      goals: "Hiểu được nền tảng và khái niệm cơ bản",
    },
    {
      day: 2,
      chapters: [{ id: "l2", title: "Chapter 2: Core Concepts", estimatedMinutes: 45 }],
      goals: "Nắm vững các khái niệm cốt lõi",
    },
    {
      day: 3,
      chapters: [{ id: "l3", title: "Chapter 3: Advanced Topics", estimatedMinutes: 35 }],
      goals: "Hiểu các chủ đề nâng cao",
    },
  ],
  summary: "3 ngày · 3 chương · ~35 phút/ngày",
};

describe("POST /api/ai/study-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const res = await studyPlanPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Course not found");
  });

  it("returns 400 when contentType is not book", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "course1", title: "My Course", contentType: "course", lessons: SAMPLE_LESSONS,
    });

    const res = await studyPlanPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Study plan only available for books");
  });

  it("returns 400 when no chapters exist", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "course1", title: "Empty Book", contentType: "book", lessons: [],
    });

    const res = await studyPlanPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No chapters found for this book");
  });

  it("successfully generates study plan", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "course1", title: "My Book", contentType: "book", lessons: SAMPLE_LESSONS,
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_PLAN) } }],
    });

    const res = await studyPlanPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.plan).toBeDefined();
    expect(json.plan.days).toHaveLength(3);
    expect(json.plan.days[0].day).toBe(1);
    expect(json.plan.days[0].chapters[0].id).toBe("l1");
    expect(mockCreate).toHaveBeenCalled();
  });

  it("validates request schema — returns 400 for missing apiKey", async () => {
    const res = await studyPlanPost(makeRequest({
      courseId: "course1",
      availableDays: 7,
      hoursPerDay: 1,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    }));
    expect(res.status).toBe(400);
  });

  it("validates request schema — returns 400 for invalid availableDays", async () => {
    const res = await studyPlanPost(makeRequest({ ...VALID_BODY, availableDays: 0 }));
    expect(res.status).toBe(400);
  });

  it("validates request schema — returns 400 for invalid hoursPerDay", async () => {
    const res = await studyPlanPost(makeRequest({ ...VALID_BODY, hoursPerDay: 0.1 }));
    expect(res.status).toBe(400);
  });

  it("validates request schema — returns 400 for invalid baseUrl", async () => {
    const res = await studyPlanPost(makeRequest({ ...VALID_BODY, baseUrl: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("handles AI parse errors — returns 500 when no JSON object found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "course1", title: "My Book", contentType: "book", lessons: SAMPLE_LESSONS,
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "I cannot create a plan at this time." } }],
    });

    const res = await studyPlanPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to parse AI response");
  });

  it("handles AI response wrapped in markdown code block", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "course1", title: "My Book", contentType: "book", lessons: SAMPLE_LESSONS,
    });
    const wrapped = "```json\n" + JSON.stringify(SAMPLE_PLAN) + "\n```";
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: wrapped } }],
    });

    const res = await studyPlanPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.plan.days).toHaveLength(3);
  });

  it("passes correct parameters to AI including availableDays and hoursPerDay", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "course1", title: "My Book", contentType: "book", lessons: SAMPLE_LESSONS,
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_PLAN) } }],
    });

    await studyPlanPost(makeRequest({ ...VALID_BODY, availableDays: 14, hoursPerDay: 2 }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
    // Verify the user message contains the parameters
    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toContain("14 ngày");
    expect(userMsg.content).toContain("2 giờ");
  });
});
