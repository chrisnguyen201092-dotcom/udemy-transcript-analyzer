/**
 * Integration tests for POST /api/ai/glossary.
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
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { POST as glossaryPost } from "@/app/api/ai/glossary/route";

const VALID_BODY = {
  courseId: "c1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/glossary", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_CONCEPTS_JSON = JSON.stringify([
  { term: "Machine Learning", definition: "A subset of AI that learns from data", category: "thuật ngữ" },
]);

const SAMPLE_GLOSSARY = [
  {
    term: "Machine Learning",
    definition: "Học máy (Machine Learning) là nhánh của AI cho phép máy tính học từ dữ liệu",
    chapters: [{ id: "l1", title: "Chapter 1" }],
    category: "thuật ngữ",
  },
  {
    term: "Neural Network",
    definition: "Mạng nơ-ron nhân tạo mô phỏng cách não bộ hoạt động",
    chapters: [{ id: "l1", title: "Chapter 1" }, { id: "l2", title: "Chapter 2" }],
    category: "khái niệm",
  },
];

describe("POST /api/ai/glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const res = await glossaryPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Course not found");
  });

  it("returns 400 when contentType is not book", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "Course", contentType: "course",
      glossary: null,
      lessons: [{ id: "l1", title: "Lesson 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });

    const res = await glossaryPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Glossary only available for books");
  });

  it("returns 400 when no lessons have keyConcepts", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: null,
      lessons: [
        { id: "l1", title: "Chapter 1", keyConcepts: null },
        { id: "l2", title: "Chapter 2", keyConcepts: null },
      ],
    });

    const res = await glossaryPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/No chapters have key concepts/);
  });

  it("returns cached glossary when available (no force)", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: JSON.stringify(SAMPLE_GLOSSARY),
      lessons: [{ id: "l1", title: "Chapter 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });

    const res = await glossaryPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.glossary).toEqual(SAMPLE_GLOSSARY);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("regenerates with force=true even when cached glossary exists", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: JSON.stringify(SAMPLE_GLOSSARY),
      lessons: [{ id: "l1", title: "Chapter 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_GLOSSARY) } }],
    });
    mockPrisma.course.update.mockResolvedValue({});

    const res = await glossaryPost(makeRequest({ ...VALID_BODY, force: true }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.glossary).toEqual(SAMPLE_GLOSSARY);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("extracts glossary from AI response and persists to DB", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: null,
      lessons: [{ id: "l1", title: "Chapter 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_GLOSSARY) } }],
    });
    mockPrisma.course.update.mockResolvedValue({});

    const res = await glossaryPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.glossary).toHaveLength(2);
    expect(json.glossary[0].term).toBe("Machine Learning");
    expect(mockPrisma.course.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { glossary: JSON.stringify(SAMPLE_GLOSSARY) },
    });
  });

  it("handles AI response wrapped in markdown code block", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: null,
      lessons: [{ id: "l1", title: "Chapter 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });
    const wrappedResponse = "```json\n" + JSON.stringify(SAMPLE_GLOSSARY) + "\n```";
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: wrappedResponse } }],
    });
    mockPrisma.course.update.mockResolvedValue({});

    const res = await glossaryPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.glossary).toHaveLength(2);
  });

  it("returns 500 when AI response contains invalid JSON array", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: null,
      lessons: [{ id: "l1", title: "Chapter 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "[{invalid json}]" } }],
    });

    const res = await glossaryPost(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to parse AI response");
  });

  it("applies default values for optional glossary fields", async () => {
    const minimalGlossary = [{ term: "Test", definition: "A test definition" }];
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1", title: "My Book", contentType: "book",
      glossary: null,
      lessons: [{ id: "l1", title: "Chapter 1", keyConcepts: SAMPLE_CONCEPTS_JSON }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(minimalGlossary) } }],
    });
    mockPrisma.course.update.mockResolvedValue({});

    const res = await glossaryPost(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.glossary[0].chapters).toEqual([]);
    expect(json.glossary[0].category).toBe("thuật ngữ");
  });

  it("returns 400 when courseId is missing", async () => {
    const res = await glossaryPost(makeRequest({
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when baseUrl is not a valid URL", async () => {
    const res = await glossaryPost(makeRequest({
      ...VALID_BODY,
      baseUrl: "not-a-url",
    }));
    expect(res.status).toBe(400);
  });
});
