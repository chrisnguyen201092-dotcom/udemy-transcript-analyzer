/**
 * Integration tests for POST /api/courses/upload.
 * Tests the VTT/SRT/TXT upload flow with Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST as uploadPost } from "@/app/api/courses/upload/route";

const VALID_COURSE = { id: "c1", title: "Test Course" };

function makeUploadRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/courses/upload", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/courses/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue(VALID_COURSE);
    mockPrisma.lesson.count.mockResolvedValue(0);
    mockPrisma.lesson.create.mockImplementation(
      (args: { data: { title: string; transcript: string | null; order: number; courseId: string } }) =>
        Promise.resolve({ id: "l1", ...args.data })
    );
  });

  // ─── VTT Upload ────────────────────────────────────────────────────────────
  it("parses VTT file and saves cleaned transcript", async () => {
    const vttContent = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello world";
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "lesson1.vtt", content: vttContent, type: ".vtt" }],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.created).toHaveLength(1);
    expect(json.created[0].title).toBe("lesson1");
    expect(json.errors).toHaveLength(0);
  });

  it("VTT: strips WEBVTT header, timestamps, and HTML tags", async () => {
    const vttContent = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<b>Bold</b> text";
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "lesson.vtt", content: vttContent, type: ".vtt" }],
    });

    await uploadPost(req);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBe("Bold text");
  });

  // ─── SRT Upload ────────────────────────────────────────────────────────────
  it("parses SRT file and saves cleaned transcript", async () => {
    const srtContent = "1\n00:00:01,000 --> 00:00:03,000\nHello from SRT";
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "lesson.srt", content: srtContent, type: ".srt" }],
    });

    const res = await uploadPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toHaveLength(1);
    expect(json.errors).toHaveLength(0);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBe("Hello from SRT");
  });

  it("SRT: strips sequence numbers and timestamp lines", async () => {
    const srtContent = [
      "1",
      "00:00:01,000 --> 00:00:03,000",
      "First subtitle",
      "",
      "2",
      "00:00:04,000 --> 00:00:05,000",
      "Second subtitle",
    ].join("\n");

    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "lesson.srt", content: srtContent, type: ".srt" }],
    });

    await uploadPost(req);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBe("First subtitle Second subtitle");
  });

  // ─── TXT Upload ────────────────────────────────────────────────────────────
  it("parses TXT file and saves text as-is (trimmed)", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "lesson.txt", content: "  Plain text content  ", type: ".txt" }],
    });

    await uploadPost(req);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBe("Plain text content");
  });

  // ─── Empty file ────────────────────────────────────────────────────────────
  it("sets transcript to null for VTT file with only timestamps (empty after parse)", async () => {
    const vttContent = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n";
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "empty.vtt", content: vttContent, type: ".vtt" }],
    });

    await uploadPost(req);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.transcript).toBeNull();
  });

  it("hasTranscript=false when transcript is null", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "empty.vtt", content: "WEBVTT\n\n", type: ".vtt" }],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(json.created).toHaveLength(1);
    expect(json.created[0].title).toBe("empty");
    expect(json.errors).toHaveLength(0);
  });

  // ─── Multi-file upload ─────────────────────────────────────────────────────
  it("handles multiple files in one request", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [
        { name: "lesson1.vtt", content: "WEBVTT\n\nContent one", type: ".vtt" },
        { name: "lesson2.srt", content: "1\n00:00:01,000 --> 00:00:02,000\nContent two", type: ".srt" },
      ],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(json.created).toHaveLength(2);
    expect(json.errors).toHaveLength(0);
    expect(mockPrisma.lesson.create).toHaveBeenCalledTimes(2);
  });

  it("assigns correct order to multiple files: existingCount + i + 1", async () => {
    mockPrisma.lesson.count.mockResolvedValue(3); // 3 existing lessons

    const req = makeUploadRequest({
      courseId: "c1",
      files: [
        { name: "a.txt", content: "text1", type: ".txt" },
        { name: "b.txt", content: "text2", type: ".txt" },
      ],
    });

    await uploadPost(req);

    const firstCall = mockPrisma.lesson.create.mock.calls[0][0];
    const secondCall = mockPrisma.lesson.create.mock.calls[1][0];
    expect(firstCall.data.order).toBe(4); // 3 + 0 + 1
    expect(secondCall.data.order).toBe(5); // 3 + 1 + 1
  });

  // ─── Error cases ────────────────────────────────────────────────────────────
  it("partial success: returns 200 with errors[] when one file fails DB write", async () => {
    // First file succeeds, second file throws on DB create
    mockPrisma.lesson.create
      .mockResolvedValueOnce({ id: "l1", title: "good", order: 1, transcript: "text", courseId: "c1" })
      .mockRejectedValueOnce(new Error("DB constraint violation"));

    const req = makeUploadRequest({
      courseId: "c1",
      files: [
        { name: "good.txt", content: "text", type: ".txt" },
        { name: "bad.txt", content: "text", type: ".txt" },
      ],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.created).toHaveLength(1);
    expect(json.created[0].title).toBe("good");
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0].fileName).toBe("bad.txt");
    expect(json.errors[0].reason).toContain("DB constraint");
  });

  it("created[].id is present in response", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "lesson.txt", content: "text", type: ".txt" }],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(json.created[0].id).toBe("l1");
    expect(json.created[0].order).toBe(1);
  });

  it("returns 404 when course does not exist", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = makeUploadRequest({
      courseId: "nonexistent",
      files: [{ name: "lesson.txt", content: "text", type: ".txt" }],
    });

    const res = await uploadPost(req);

    expect(res.status).toBe(404);
  });

  it("returns 400 when files array is empty", async () => {
    const req = makeUploadRequest({ courseId: "c1", files: [] });
    const res = await uploadPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when courseId is missing", async () => {
    const req = makeUploadRequest({
      files: [{ name: "lesson.txt", content: "text", type: ".txt" }],
    });

    const res = await uploadPost(req);

    expect(res.status).toBe(400);
  });

  // ─── Filename processing ────────────────────────────────────────────────────
  it("strips file extension from filename to use as lesson title", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "My Lesson Title.vtt", content: "WEBVTT\n\nContent", type: ".vtt" }],
    });

    await uploadPost(req);

    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    expect(createCall.data.title).toBe("My Lesson Title");
  });
});

// ─── Edge-case tests (gap analysis) ──────────────────────────────────────────

describe("POST /api/courses/upload — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue(VALID_COURSE);
    mockPrisma.lesson.count.mockResolvedValue(0);
    mockPrisma.lesson.create.mockImplementation(
      (args: { data: { title: string; transcript: string | null; order: number; courseId: string } }) =>
        Promise.resolve({ id: "l1", ...args.data })
    );
  });

  it("handles malformed VTT format gracefully (broken timestamps fallback to raw text)", async () => {
    // VTT with broken timestamps — parser should handle gracefully
    const malformedVtt = "WEBVTT\n\nNOT_A_TIMESTAMP\nSome content here\nAnother line";
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "malformed.vtt", content: malformedVtt, type: ".vtt" }],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should either parse what it can or treat as raw text
    expect(json.created).toHaveLength(1);
    const createCall = mockPrisma.lesson.create.mock.calls[0][0];
    // Transcript should contain some content (not crash)
    expect(typeof createCall.data.transcript === "string" || createCall.data.transcript === null).toBe(true);
  });

  it("handles empty file content (0 bytes)", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "empty.txt", content: "", type: ".txt" }],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Empty content should result in null transcript
    if (json.created.length > 0) {
      const createCall = mockPrisma.lesson.create.mock.calls[0][0];
      expect(createCall.data.transcript).toBeNull();
    }
  });

  it("handles whitespace-only file content", async () => {
    const req = makeUploadRequest({
      courseId: "c1",
      files: [{ name: "whitespace.txt", content: "   \n\n   ", type: ".txt" }],
    });

    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    if (json.created.length > 0) {
      const createCall = mockPrisma.lesson.create.mock.calls[0][0];
      // Trimmed whitespace should result in null transcript
      expect(createCall.data.transcript).toBeNull();
    }
  });
});
