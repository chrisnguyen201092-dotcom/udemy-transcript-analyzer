import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/export/lesson/[id]/route";

function makeReq(body: object): NextRequest {
  return new NextRequest("http://localhost/api/export/lesson/l1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const baseLessonData = {
  title: "Async Await Basics",
  summary: "This lesson covers async/await in JavaScript.",
  explanation: "Async/await is syntactic sugar over Promises.",
  quiz: JSON.stringify({
    questions: [
      {
        type: "mcq",
        question: "What does await do?",
        options: ["Pauses execution", "Throws error", "Returns undefined", "Loops"],
        answer: "Pauses execution",
        explanation: "await pauses until the Promise resolves.",
        bloom_level: "understand",
      },
    ],
  }),
  flashcards: JSON.stringify({
    cards: [
      { type: "term_definition", front: "async", back: "Declares an async function", mnemonic: "a" },
      { type: "term_definition", front: "await", back: "Waits for a Promise", mnemonic: "w" },
    ],
  }),
  exercises: JSON.stringify({
    exercises: [
      {
        type: "recall",
        title: "Fetch data",
        description: "Write a function that fetches data from an API.",
        hints: ["Use fetch()", "Remember to await"],
        rubric: "Correct usage of async/await",
        solution: "async function getData() { return await fetch('/api'); }",
      },
    ],
  }),
};

describe("POST /api/export/lesson/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports summary as markdown", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(baseLessonData);

    const res = await POST(makeReq({ type: "summary", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("summary.md");

    const text = await res.text();
    expect(text).toContain("# Async Await Basics");
    expect(text).toContain("async/await in JavaScript");
  });

  it("exports explanation as markdown", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(baseLessonData);

    const res = await POST(makeReq({ type: "explanation", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Async Await Basics — Giải thích");
    expect(text).toContain("syntactic sugar");
  });

  it("exports flashcards as CSV with correct format", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(baseLessonData);

    const res = await POST(makeReq({ type: "flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("flashcards.csv");

    const text = await res.text();
    const lines = text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('"async";"Declares an async function"');
    expect(lines[1]).toBe('"await";"Waits for a Promise"');
  });

  it("exports flashcards as markdown table", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(baseLessonData);

    const res = await POST(makeReq({ type: "flashcards", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");

    const text = await res.text();
    expect(text).toContain("# Async Await Basics — Flashcards");
    expect(text).toContain("| Mặt trước | Mặt sau |");
    expect(text).toContain("| async | Declares an async function |");
  });

  it("exports quiz as markdown", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(baseLessonData);

    const res = await POST(makeReq({ type: "quiz", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Async Await Basics — Quiz");
    expect(text).toContain("## Câu 1: What does await do?");
    expect(text).toContain("- A) Pauses execution");
    expect(text).toContain("- **Đáp án đúng: Pauses execution**");
    expect(text).toContain("> await pauses until the Promise resolves.");
  });

  it("exports exercises as markdown", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(baseLessonData);

    const res = await POST(makeReq({ type: "exercises", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Async Await Basics — Bài tập");
    expect(text).toContain("## Bài tập 1: Fetch data");
    expect(text).toContain("Write a function that fetches data");
    expect(text).toContain("**Gợi ý:** Use fetch(), Remember to await");
    expect(text).toContain("**Lời giải:**");
  });

  it("returns 400 for invalid type", async () => {
    const res = await POST(makeReq({ type: "invalid", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 for invalid format combo (csv with summary)", async () => {
    const res = await POST(makeReq({ type: "summary", format: "csv" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("flashcards");
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ type: "summary", format: "markdown" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Lesson not found");
  });

  it("returns 404 when AI data not generated", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...baseLessonData,
      summary: null,
    });

    const res = await POST(makeReq({ type: "summary", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Dữ liệu chưa được tạo");
    expect(json.error).toContain("summary");
  });

  it("handles CSV escaping with special characters (semicolons, quotes)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...baseLessonData,
      flashcards: JSON.stringify({
        cards: [
          { type: "term_definition", front: 'What is "async"?', back: "It's; complex", mnemonic: "" },
          { type: "term_definition", front: 'He said "hello"', back: 'semi;colon "and" quotes', mnemonic: "" },
        ],
      }),
    });

    const res = await POST(makeReq({ type: "flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.split("\n");
    expect(lines[0]).toBe('"What is ""async""?";"It\'s; complex"');
    expect(lines[1]).toBe('"He said ""hello""";"semi;colon ""and"" quotes"');
  });

  it("sanitizes filename removing special characters", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...baseLessonData,
      title: 'Lesson: "Advanced" C++/C# <Concepts>',
    });

    const res = await POST(makeReq({ type: "summary", format: "markdown" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain(":");
    expect(disposition).not.toContain('"Advanced"');
    expect(disposition).toContain("summary.md");
  });

  it("handles empty flashcards array (valid empty file)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...baseLessonData,
      flashcards: JSON.stringify({ cards: [] }),
    });

    const res = await POST(makeReq({ type: "flashcards", format: "csv" }), {
      params: Promise.resolve({ id: "l1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("returns 400 when format is missing", async () => {
    const req = new NextRequest("http://localhost/api/export/lesson/l1", {
      method: "POST",
      body: JSON.stringify({ type: "summary" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(400);
  });
});
