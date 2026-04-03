/**
 * Integration tests for POST /api/ai/concepts.
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

import { POST as conceptsPost } from "@/app/api/ai/concepts/route";

const VALID_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/concepts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_CONCEPTS = [
  {
    term: "Machine Learning",
    definition: "A subset of AI that learns from data",
    category: "thuật ngữ",
    relatedTerms: ["Deep Learning", "Neural Network"],
  },
  {
    term: "Supervised Learning",
    definition: "Learning with labeled training data",
    category: "phương pháp",
    relatedTerms: ["Classification", "Regression"],
  },
];

describe("POST /api/ai/concepts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when lesson has no transcript", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: null,
      course: { title: "Book", contentType: "book" },
    });

    const res = await conceptsPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No transcript available");
  });

  it("returns 400 when lesson does not exist", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue(null);

    const res = await conceptsPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 400 when contentType is not book", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Lesson", transcript: "Some content",
      course: { title: "Course", contentType: "course" },
    });

    const res = await conceptsPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Key concepts only available for books");
  });

  it("returns 400 when contentType is null (defaults to course)", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Lesson", transcript: "Some content",
      course: { title: "Course", contentType: null },
    });

    const res = await conceptsPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Key concepts only available for books");
  });

  it("returns cached concepts without calling AI when available", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Content",
      keyConcepts: JSON.stringify(SAMPLE_CONCEPTS),
      course: { title: "Book", contentType: "book" },
    });

    const res = await conceptsPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.concepts).toEqual(SAMPLE_CONCEPTS);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("regenerates concepts when force=true even with cached data", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Chapter content",
      keyConcepts: JSON.stringify(SAMPLE_CONCEPTS),
      course: { title: "Book", contentType: "book" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_CONCEPTS) } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({});

    const res = await conceptsPost(makeRequest({ ...VALID_BODY, force: true }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.concepts).toEqual(SAMPLE_CONCEPTS);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("extracts concepts from AI response and persists to DB", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Chapter content here",
      keyConcepts: null,
      course: { title: "My Book", contentType: "book" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_CONCEPTS) } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({});

    const res = await conceptsPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.concepts).toHaveLength(2);
    expect(json.concepts[0].term).toBe("Machine Learning");
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { keyConcepts: JSON.stringify(SAMPLE_CONCEPTS) },
    });
  });

  it("handles AI response wrapped in markdown code block", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Content",
      keyConcepts: null,
      course: { title: "Book", contentType: "book" },
    });
    const wrappedResponse = "```json\n" + JSON.stringify(SAMPLE_CONCEPTS) + "\n```";
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: wrappedResponse } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({});

    const res = await conceptsPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.concepts).toHaveLength(2);
  });

  it("returns empty concepts when AI response has no JSON array", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Content",
      keyConcepts: null,
      course: { title: "Book", contentType: "book" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Sorry, I cannot help with that." } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({});

    const res = await conceptsPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.concepts).toEqual([]);
    // Empty results should NOT be persisted to avoid caching AI failures
    expect(mockPrisma.lesson.update).not.toHaveBeenCalled();
  });

  it("returns 500 when AI response contains invalid JSON array", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Content",
      keyConcepts: null,
      course: { title: "Book", contentType: "book" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "[{invalid json}]" } }],
    });

    const res = await conceptsPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to parse AI response");
  });

  it("returns 400 when apiKey is missing", async () => {
    const res = await conceptsPost(makeRequest({
      lessonId: "l1",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lessonId is missing", async () => {
    const res = await conceptsPost(makeRequest({
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when baseUrl is not a valid URL", async () => {
    const res = await conceptsPost(makeRequest({
      ...VALID_BODY,
      baseUrl: "not-a-url",
    }));
    expect(res.status).toBe(400);
  });

  it("applies default values for optional concept fields", async () => {
    const minimalConcepts = [
      { term: "Test", definition: "A test term" },
    ];
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1", title: "Ch1", transcript: "Content",
      keyConcepts: null,
      course: { title: "Book", contentType: "book" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(minimalConcepts) } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({});

    const res = await conceptsPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.concepts[0].category).toBe("thuật ngữ");
    expect(json.concepts[0].relatedTerms).toEqual([]);
  });
});
