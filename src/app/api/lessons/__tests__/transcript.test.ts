/**
 * Integration tests for PUT /api/lessons/[id]/transcript.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: {
      update: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    course: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PUT as putTranscript } from "@/app/api/lessons/[id]/transcript/route";

function makeRequest(lessonId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/lessons/${lessonId}/transcript`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PUT /api/lessons/[id]/transcript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Route calls findFirst for ownership check before update
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
  });

  it("saves transcript and returns updated lesson", async () => {
    const updatedLesson = { id: "l1", title: "Lesson 1", transcript: "Hello world" };
    mockPrisma.lesson.update.mockResolvedValue(updatedLesson);

    const req = makeRequest("l1", { transcript: "Hello world" });
    const res = await putTranscript(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.transcript).toBe("Hello world");
  });

  it("saves empty string transcript", async () => {
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1", transcript: "" });

    const req = makeRequest("l1", { transcript: "" });
    const res = await putTranscript(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(200);
    const updateCall = mockPrisma.lesson.update.mock.calls[0][0];
    expect(updateCall.data.transcript).toBe("");
  });

  it("calls prisma.lesson.update with correct id and transcript", async () => {
    mockPrisma.lesson.update.mockResolvedValue({ id: "l42", transcript: "Content" });

    const req = makeRequest("l42", { transcript: "Content" });
    await putTranscript(req, { params: Promise.resolve({ id: "l42" }) });

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l42" },
      data: { transcript: "Content" },
    });
  });

  it("returns 500 when lesson does not exist (Prisma throws)", async () => {
    mockPrisma.lesson.update.mockRejectedValue(
      new Error("Record to update not found")
    );

    const req = makeRequest("nonexistent", { transcript: "text" });
    const res = await putTranscript(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(500);
  });

  it("returns 500 when body is invalid JSON (missing transcript field)", async () => {
    // UpdateTranscriptSchema requires transcript: z.string() — missing it fails Zod
    // The route catches all errors as 500 (no explicit 400 handling for ZodError)
    const req = new NextRequest("http://localhost/api/lessons/l1/transcript", {
      method: "PUT",
      body: JSON.stringify({}), // missing transcript field
      headers: { "Content-Type": "application/json" },
    });

    const res = await putTranscript(req, { params: Promise.resolve({ id: "l1" }) });

    expect([400, 500]).toContain(res.status);
  });

  it("saves long transcript without truncation", async () => {
    const longText = "A".repeat(50000);
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1", transcript: longText });

    const req = makeRequest("l1", { transcript: longText });
    await putTranscript(req, { params: Promise.resolve({ id: "l1" }) });

    const updateCall = mockPrisma.lesson.update.mock.calls[0][0];
    expect(updateCall.data.transcript).toBe(longText);
  });
});
