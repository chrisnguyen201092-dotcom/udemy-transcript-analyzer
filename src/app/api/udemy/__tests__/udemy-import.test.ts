/**
 * Integration tests for POST /api/udemy/import.
 * External fetch and Prisma are both mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => {
  const db = {
    course: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    // Route wraps lesson creation in $transaction; callback receives db itself.
    $transaction: vi.fn().mockImplementation(
      async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
    ),
  };
  return { mockPrisma: db };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST as importCourse } from "@/app/api/udemy/import/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/udemy/import", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const COURSE_INFO_RESPONSE = {
  ok: true,
  json: async () => ({ id: 123, title: "JavaScript Basics", url: "/course/js-basics" }),
};

const CURRICULUM_RESPONSE = {
  ok: true,
  json: async () => ({
    results: [
      {
        _class: "lecture",
        id: 1,
        title: "Intro",
        object_index: 1,
        asset: {
          captions: [
            { locale_id: "en_US", url: "https://cdn.udemy.com/captions/1.vtt", source: "auto" },
          ],
        },
      },
    ],
    next: null,
  }),
};

const CAPTION_RESPONSE = {
  ok: true,
  text: async () => "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nWelcome to the course",
};

describe("POST /api/udemy/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue(null);
    mockPrisma.course.create.mockResolvedValue({ id: "db-c1", title: "JavaScript Basics" });
    mockPrisma.lesson.create.mockResolvedValue({ id: "l1", title: "Intro", order: 1 });
  });

  it("returns 400 when courseId is missing", async () => {
    const req = makeRequest({ cookie: "token" });
    const res = await importCourse(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when cookie is missing", async () => {
    const req = makeRequest({ courseId: 123 });
    const res = await importCourse(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when courseId is not a positive integer", async () => {
    const req = makeRequest({ courseId: -1, cookie: "token" });
    const res = await importCourse(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when course info fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const req = makeRequest({ courseId: 123, cookie: "bad-token" });
    const res = await importCourse(req);

    expect(res.status).toBe(400);
  });

  it("successfully imports course and returns title + lessonCount", async () => {
    mockFetch
      .mockResolvedValueOnce(COURSE_INFO_RESPONSE)   // course info
      .mockResolvedValueOnce(CURRICULUM_RESPONSE)     // curriculum page
      .mockResolvedValueOnce(CAPTION_RESPONSE);        // caption VTT

    const req = makeRequest({ courseId: 123, cookie: "valid-token" });
    const res = await importCourse(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("JavaScript Basics");
    expect(json.lessonCount).toBe(1);
  });

  it("prefers en_US caption over other locales", async () => {
    const curriculumWithMultipleCaptions = {
      ok: true,
      json: async () => ({
        results: [
          {
            _class: "lecture",
            id: 1,
            title: "Intro",
            object_index: 1,
            asset: {
              captions: [
                { locale_id: "fr_FR", url: "https://cdn.udemy.com/fr.vtt", source: "human" },
                { locale_id: "en_US", url: "https://cdn.udemy.com/en.vtt", source: "auto" },
                { locale_id: "ja_JP", url: "https://cdn.udemy.com/ja.vtt", source: "human" },
              ],
            },
          },
        ],
        next: null,
      }),
    };

    mockFetch
      .mockResolvedValueOnce(COURSE_INFO_RESPONSE)
      .mockResolvedValueOnce(curriculumWithMultipleCaptions)
      .mockResolvedValueOnce(CAPTION_RESPONSE);

    const req = makeRequest({ courseId: 123, cookie: "valid-token" });
    await importCourse(req);

    // The 3rd fetch (caption) should be called with the en_US URL
    const captionFetchUrl = mockFetch.mock.calls[2][0];
    expect(captionFetchUrl).toBe("https://cdn.udemy.com/en.vtt");
  });

  it("upserts existing course: deletes old lessons and updates title", async () => {
    const existingCourse = { id: "existing-c1", title: "Old Title" };
    mockPrisma.course.findFirst.mockResolvedValue(existingCourse);
    mockPrisma.course.update.mockResolvedValue({ id: "existing-c1", title: "JavaScript Basics" });
    mockPrisma.lesson.deleteMany.mockResolvedValue({ count: 3 });

    mockFetch
      .mockResolvedValueOnce(COURSE_INFO_RESPONSE)
      .mockResolvedValueOnce(CURRICULUM_RESPONSE)
      .mockResolvedValueOnce(CAPTION_RESPONSE);

    const req = makeRequest({ courseId: 123, cookie: "valid-token" });
    await importCourse(req);

    expect(mockPrisma.lesson.deleteMany).toHaveBeenCalledWith({
      where: { courseId: "existing-c1" },
    });
    expect(mockPrisma.course.create).not.toHaveBeenCalled();
  });

  it("handles lecture with no captions — sets transcript null", async () => {
    const curriculumNoCaptions = {
      ok: true,
      json: async () => ({
        results: [
          {
            _class: "lecture",
            id: 2,
            title: "No Caption Lecture",
            object_index: 2,
            asset: { captions: [] },
          },
        ],
        next: null,
      }),
    };

    mockFetch
      .mockResolvedValueOnce(COURSE_INFO_RESPONSE)
      .mockResolvedValueOnce(curriculumNoCaptions);

    const req = makeRequest({ courseId: 123, cookie: "valid-token" });
    const res = await importCourse(req);
    const json = await res.json();

    expect(json.lessonCount).toBe(1);
    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBeNull();
  });

  it("filters out non-lecture items from curriculum", async () => {
    const mixedCurriculum = {
      ok: true,
      json: async () => ({
        results: [
          { _class: "chapter", id: 10, title: "Section 1", object_index: 0 },
          { _class: "lecture", id: 11, title: "Lesson 1", object_index: 1, asset: { captions: [] } },
          { _class: "quiz", id: 12, title: "Quiz", object_index: 2 },
        ],
        next: null,
      }),
    };

    mockFetch
      .mockResolvedValueOnce(COURSE_INFO_RESPONSE)
      .mockResolvedValueOnce(mixedCurriculum);

    const req = makeRequest({ courseId: 123, cookie: "valid-token" });
    const res = await importCourse(req);
    const json = await res.json();

    // Only 1 lecture should be imported
    expect(json.lessonCount).toBe(1);
  });

  it("parses VTT transcript and strips timestamps", async () => {
    mockFetch
      .mockResolvedValueOnce(COURSE_INFO_RESPONSE)
      .mockResolvedValueOnce(CURRICULUM_RESPONSE)
      .mockResolvedValueOnce(CAPTION_RESPONSE);

    const req = makeRequest({ courseId: 123, cookie: "valid-token" });
    await importCourse(req);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBe("Welcome to the course");
  });
});
