import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/export/course/[id]/route";

function makeReq(body: object): NextRequest {
  return new NextRequest("http://localhost/api/export/course/c1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const baseCourseData = {
  title: "JavaScript Masterclass",
  lessons: [
    {
      title: "Lesson 1: Variables",
      summary: "Variables store data.",
      explanation: "Let, const, var are ways to declare variables.",
      flashcards: JSON.stringify({
        cards: [
          { type: "term_definition", front: "let", back: "Block-scoped variable", mnemonic: "" },
          { type: "term_definition", front: "const", back: "Immutable binding", mnemonic: "" },
        ],
      }),
    },
    {
      title: "Lesson 2: Functions",
      summary: "Functions are reusable blocks.",
      explanation: "Arrow functions, regular functions, and IIFE.",
      flashcards: JSON.stringify({
        cards: [
          { type: "term_definition", front: "arrow fn", back: "() => {}", mnemonic: "" },
        ],
      }),
    },
    {
      title: "Lesson 3: No AI Data",
      summary: null,
      explanation: null,
      flashcards: null,
    },
  ],
};

describe("POST /api/export/course/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports full-notes as markdown", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(baseCourseData);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("full-notes.md");

    const text = await res.text();
    expect(text).toContain("# JavaScript Masterclass — Ghi chú");
    expect(text).toContain("## Lesson 1: Variables");
    expect(text).toContain("### Tóm tắt");
    expect(text).toContain("Variables store data.");
    expect(text).toContain("### Giải thích");
    expect(text).toContain("Let, const, var");
  });

  it("exports all-flashcards as CSV", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(baseCourseData);

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("all-flashcards.csv");

    const text = await res.text();
    const lines = text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"let";"Block-scoped variable"');
    expect(lines[1]).toBe('"const";"Immutable binding"');
    expect(lines[2]).toBe('"arrow fn";"() => {}"');
  });

  it("returns 400 for invalid type", async () => {
    const res = await POST(makeReq({ type: "invalid-type", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 for invalid format combo (full-notes with csv)", async () => {
    const res = await POST(makeReq({ type: "full-notes", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("full-notes");
  });

  it("returns 400 for invalid format combo (all-flashcards with markdown)", async () => {
    const res = await POST(makeReq({ type: "all-flashcards", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("all-flashcards");
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Course not found");
  });

  it("skips lessons with no AI data in full-notes", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(baseCourseData);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    const text = await res.text();
    expect(text).toContain("## Lesson 1: Variables");
    expect(text).toContain("## Lesson 2: Functions");
    expect(text).not.toContain("## Lesson 3: No AI Data");
  });

  it("skips lessons with no flashcards in all-flashcards CSV", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(baseCourseData);

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    const text = await res.text();
    const lines = text.split("\n");
    // Only 3 cards total (2 from lesson 1 + 1 from lesson 2, none from lesson 3)
    expect(lines).toHaveLength(3);
  });

  it("handles CSV escaping with special characters in course flashcards", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      title: "Course with Special Chars",
      lessons: [
        {
          title: "L1",
          summary: null,
          explanation: null,
          flashcards: JSON.stringify({
            cards: [
              { type: "term_definition", front: 'What is "this"?', back: "context; scope", mnemonic: "" },
            ],
          }),
        },
      ],
    });

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('"What is ""this""?";"context; scope"');
  });

  it("handles course with all lessons having no flashcards", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      title: "Empty Course",
      lessons: [
        { title: "L1", summary: null, explanation: null, flashcards: null },
        { title: "L2", summary: null, explanation: null, flashcards: null },
      ],
    });

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("sanitizes course title in filename", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      title: 'Course: "Advanced" C++/C#',
      lessons: [],
    });

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain(":");
    expect(disposition).toContain("full-notes.md");
  });

  it("handles full-notes with only summary (no explanation)", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      title: "Partial Data Course",
      lessons: [
        {
          title: "Lesson A",
          summary: "Has summary only",
          explanation: null,
          flashcards: null,
        },
      ],
    });

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    const text = await res.text();
    expect(text).toContain("## Lesson A");
    expect(text).toContain("### Tóm tắt");
    expect(text).toContain("Has summary only");
    expect(text).not.toContain("### Giải thích");
  });
});
