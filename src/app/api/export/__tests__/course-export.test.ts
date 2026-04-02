import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: { findUnique: vi.fn(), findFirst: vi.fn() },
    lessonArtifact: { findMany: vi.fn() },
    course: { findUnique: vi.fn(), findFirst: vi.fn() },
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
    { id: "lesson-1", title: "Lesson 1: Variables" },
    { id: "lesson-2", title: "Lesson 2: Functions" },
    { id: "lesson-3", title: "Lesson 3: No AI Data" },
  ],
};

const baseCourseArtifacts = [
  { lessonId: "lesson-1", type: "summary", content: "Variables store data." },
  { lessonId: "lesson-1", type: "explanation", content: "Let, const, var are ways to declare variables." },
  {
    lessonId: "lesson-1", type: "flashcards", content: JSON.stringify({
      cards: [
        { type: "term_definition", front: "let", back: "Block-scoped variable", mnemonic: "" },
        { type: "term_definition", front: "const", back: "Immutable binding", mnemonic: "" },
      ],
    })
  },
  { lessonId: "lesson-2", type: "summary", content: "Functions are reusable blocks." },
  { lessonId: "lesson-2", type: "explanation", content: "Arrow functions, regular functions, and IIFE." },
  {
    lessonId: "lesson-2", type: "flashcards", content: JSON.stringify({
      cards: [
        { type: "term_definition", front: "arrow fn", back: "() => {}", mnemonic: "" },
      ],
    })
  },
  // lesson-3 has no artifacts
];

describe("POST /api/export/course/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue(baseCourseData);
    mockPrisma.lessonArtifact.findMany.mockResolvedValue(baseCourseArtifacts);
  });

  it("exports full-notes as markdown", async () => {
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
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Course not found");
  });

  it("skips lessons with no AI data in full-notes", async () => {
    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    const text = await res.text();
    expect(text).toContain("## Lesson 1: Variables");
    expect(text).toContain("## Lesson 2: Functions");
    expect(text).not.toContain("## Lesson 3: No AI Data");
  });

  it("skips lessons with no flashcards in all-flashcards CSV", async () => {
    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    const text = await res.text();
    const lines = text.split("\n");
    // Only 3 cards total (2 from lesson 1 + 1 from lesson 2, none from lesson 3)
    expect(lines).toHaveLength(3);
  });

  it("handles CSV escaping with special characters in course flashcards", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      title: "Course with Special Chars",
      lessons: [{ id: "l1", title: "L1" }],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        type: "flashcards",
        content: JSON.stringify({
          cards: [
            { type: "term_definition", front: 'What is "this"?', back: "context; scope", mnemonic: "" },
          ],
        }),
      },
    ]);

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('"What is ""this""?";"context; scope"');
  });

  it("handles course with all lessons having no flashcards", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      title: "Empty Course",
      lessons: [
        { id: "l1", title: "L1" },
        { id: "l2", title: "L2" },
      ],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([]);

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("sanitizes course title in filename", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      title: 'Course: "Advanced" C++/C#',
      lessons: [],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([]);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain(":");
    expect(disposition).toContain("full-notes.md");
  });

  it("handles full-notes with only summary (no explanation)", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      title: "Partial Data Course",
      lessons: [{ id: "la", title: "Lesson A" }],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      { lessonId: "la", type: "summary", content: "Has summary only" },
    ]);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    const text = await res.text();
    expect(text).toContain("## Lesson A");
    expect(text).toContain("### Tóm tắt");
    expect(text).toContain("Has summary only");
    expect(text).not.toContain("### Giải thích");
  });

  // ── Deprecated format regression (finding M-5) ─────────────────────────────

  it("returns 400 for deprecated format value 'md' (must use 'markdown')", async () => {
    const res = await POST(makeReq({ type: "full-notes", format: "md" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 for deprecated format value 'txt'", async () => {
    const res = await POST(makeReq({ type: "all-flashcards", format: "txt" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 for unknown format value 'text'", async () => {
    const res = await POST(makeReq({ type: "full-notes", format: "text" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(400);
  });
});

// ── Edge case tests ──────────────────────────────────────────────────────────

describe("POST /api/export/course/[id] — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles course with mixed null/present data across lessons", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      title: "Mixed Data Course",
      lessons: [
        { id: "la", title: "Lesson A" },
        { id: "lb", title: "Lesson B" },
        { id: "lc", title: "Lesson C" },
      ],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      { lessonId: "la", type: "summary", content: "Has summary" },
      { lessonId: "la", type: "explanation", content: "Has explanation" },
      { lessonId: "la", type: "flashcards", content: JSON.stringify({ cards: [{ type: "term_definition", front: "A", back: "B", mnemonic: "" }] }) },
      // lb has no artifacts
      { lessonId: "lc", type: "summary", content: "Only summary" },
      { lessonId: "lc", type: "flashcards", content: JSON.stringify({ cards: [{ type: "term_definition", front: "C", back: "D", mnemonic: "" }] }) },
    ]);

    // full-notes: should include A and C (have summary), skip B
    const resNotes = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(resNotes.status).toBe(200);
    const notesText = await resNotes.text();
    expect(notesText).toContain("## Lesson A");
    expect(notesText).not.toContain("## Lesson B");
    expect(notesText).toContain("## Lesson C");

    // all-flashcards CSV: should include cards from A and C, skip B
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue({
      title: "Mixed Data Course",
      lessons: [
        { id: "la", title: "Lesson A" },
        { id: "lb", title: "Lesson B" },
        { id: "lc", title: "Lesson C" },
      ],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      { lessonId: "la", type: "flashcards", content: JSON.stringify({ cards: [{ type: "term_definition", front: "A", back: "B", mnemonic: "" }] }) },
      { lessonId: "lc", type: "flashcards", content: JSON.stringify({ cards: [{ type: "term_definition", front: "C", back: "D", mnemonic: "" }] }) },
    ]);

    const resCsv = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(resCsv.status).toBe(200);
    const csvText = await resCsv.text();
    const lines = csvText.split("\n");
    expect(lines).toHaveLength(2); // A→B and C→D
  });

  // Emoji in course title — sanitizeFilename strips non-ASCII for Content-Disposition header safety
  it("handles emoji in CSV course export", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      title: "Emoji Course 🎓",
      lessons: [{ id: "l1", title: "Lesson 🎉" }],
    });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        type: "flashcards",
        content: JSON.stringify({
          cards: [
            { type: "term_definition", front: "🚀 Launch", back: "Deployment 💯", mnemonic: "" },
          ],
        }),
      },
    ]);

    const res = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("🚀");
    expect(text).toContain("💯");
  });

  it("handles very large course with 50 lessons", async () => {
    const lessons = Array.from({ length: 50 }, (_, i) => ({
      id: `lesson-${i}`,
      title: `Lesson ${i + 1}`,
    }));
    const artifacts = lessons.flatMap((l, i) => [
      { lessonId: l.id, type: "summary", content: `Summary for lesson ${i + 1}` },
      { lessonId: l.id, type: "explanation", content: `Explanation for lesson ${i + 1}` },
      {
        lessonId: l.id, type: "flashcards", content: JSON.stringify({
          cards: [{ type: "term_definition", front: `Term ${i + 1}`, back: `Definition ${i + 1}`, mnemonic: "" }],
        })
      },
    ]);

    mockPrisma.course.findFirst.mockResolvedValue({ title: "Massive Course", lessons });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue(artifacts);

    const res = await POST(makeReq({ type: "full-notes", format: "markdown" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("## Lesson 1");
    expect(text).toContain("## Lesson 50");

    // Also verify CSV with 50 lessons
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue({ title: "Massive Course", lessons });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue(artifacts.filter((a) => a.type === "flashcards"));

    const resCsv = await POST(makeReq({ type: "all-flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(resCsv.status).toBe(200);
    const csvText = await resCsv.text();
    const csvLines = csvText.split("\n");
    expect(csvLines).toHaveLength(50);
  });
});
