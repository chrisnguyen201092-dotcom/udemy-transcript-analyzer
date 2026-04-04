/**
 * Integration tests for POST/GET/PUT /api/courses/[id]/profile.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    learnerProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST, GET, PUT } from "@/app/api/courses/[id]/profile/route";

const COURSE_ID = "course-1";
const PROFILE_ID = "profile-1";

const validBody = {
  level: "beginner",
  goal: "career_change",
  dailyTimeMin: 60,
  knownTopics: ["HTML Basics", "CSS Intro"],
  learningStyle: "hands_on",
};

const mockProfile = {
  id: PROFILE_ID,
  courseId: COURSE_ID,
  level: "beginner",
  goal: "career_change",
  dailyTimeMin: 60,
  knownTopics: '["HTML Basics","CSS Intro"]',
  learningStyle: "hands_on",
  createdAt: new Date("2026-03-30T00:00:00.000Z"),
  updatedAt: new Date("2026-03-30T00:00:00.000Z"),
};

function makeRequest(courseId: string, method: string, body?: unknown): NextRequest {
  const options: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(`http://localhost/api/courses/${courseId}/profile`, options);
}

function makeParams(courseId: string) {
  return { params: Promise.resolve({ id: courseId }) };
}

describe("POST /api/courses/[id]/profile", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates profile successfully (201)", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.learnerProfile.create.mockResolvedValue(mockProfile);

    const req = makeRequest(COURSE_ID, "POST", validBody);
    const res = await POST(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe(PROFILE_ID);
    expect(json.courseId).toBe(COURSE_ID);
    expect(json.level).toBe("beginner");
    expect(json.knownTopics).toEqual(["HTML Basics", "CSS Intro"]);
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = makeRequest("nonexistent", "POST", validBody);
    const res = await POST(req, makeParams("nonexistent"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Course not found");
  });

  it("returns 409 when profile already exists", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    // M-9: Route now uses create + P2002 catch instead of findUnique check
    const p2002Error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockPrisma.learnerProfile.create.mockRejectedValue(p2002Error);

    const req = makeRequest(COURSE_ID, "POST", validBody);
    const res = await POST(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBeDefined();
  });

  it("returns 400 for invalid level value", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest(COURSE_ID, "POST", { ...validBody, level: "expert" });
    const res = await POST(req, makeParams(COURSE_ID));

    expect(res.status).toBe(400);
  });

  it("handles null knownTopics", async () => {
    const profileWithNull = { ...mockProfile, knownTopics: null };
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.learnerProfile.create.mockResolvedValue(profileWithNull);

    const bodyWithNull = { ...validBody, knownTopics: undefined };
    const req = makeRequest(COURSE_ID, "POST", bodyWithNull);
    const res = await POST(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.knownTopics).toEqual([]);
  });

  it("handles empty knownTopics array", async () => {
    const profileWithEmpty = { ...mockProfile, knownTopics: "[]" };
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.learnerProfile.create.mockResolvedValue(profileWithEmpty);

    const req = makeRequest(COURSE_ID, "POST", { ...validBody, knownTopics: [] });
    const res = await POST(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.knownTopics).toEqual([]);
  });
});

describe("GET /api/courses/[id]/profile", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns profile successfully (200)", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(mockProfile);

    const req = makeRequest(COURSE_ID, "GET");
    const res = await GET(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(PROFILE_ID);
    expect(json.level).toBe("beginner");
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = makeRequest("nonexistent", "GET");
    const res = await GET(req, makeParams("nonexistent"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Course not found");
  });

  it("returns 404 when profile not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest(COURSE_ID, "GET");
    const res = await GET(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("parses knownTopics from JSON string to array", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(mockProfile);

    const req = makeRequest(COURSE_ID, "GET");
    const res = await GET(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(json.knownTopics).toEqual(["HTML Basics", "CSS Intro"]);
    expect(Array.isArray(json.knownTopics)).toBe(true);
  });
});

describe("PUT /api/courses/[id]/profile", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates profile successfully (200)", async () => {
    const updatedProfile = { ...mockProfile, level: "advanced", knownTopics: '["React"]' };
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(mockProfile);
    mockPrisma.learnerProfile.update.mockResolvedValue(updatedProfile);

    const updateBody = { ...validBody, level: "advanced", knownTopics: ["React"] };
    const req = makeRequest(COURSE_ID, "PUT", updateBody);
    const res = await PUT(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.level).toBe("advanced");
    expect(json.knownTopics).toEqual(["React"]);
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = makeRequest("nonexistent", "PUT", validBody);
    const res = await PUT(req, makeParams("nonexistent"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Course not found");
  });

  it("returns 404 when profile not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest(COURSE_ID, "PUT", validBody);
    const res = await PUT(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("validates body with Zod (400 on invalid)", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(mockProfile);

    const invalidBody = { ...validBody, dailyTimeMin: 45 };
    const req = makeRequest(COURSE_ID, "PUT", invalidBody);
    const res = await PUT(req, makeParams(COURSE_ID));

    expect(res.status).toBe(400);
  });
});

// ─── C-3 regression: knownTopicIds field is rejected ─────────────────────────

describe("C-3 regression: knownTopicIds field is not accepted", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("POST: ignores unknown field knownTopicIds (does not crash, uses knownTopics)", async () => {
    // The old field name was 'knownTopicIds' (array of IDs).
    // The route's Zod schema only accepts 'knownTopics' (array of strings).
    // Sending 'knownTopicIds' should either be ignored (extra field stripped by Zod)
    // or cause a 400 if it replaces the required field pattern.
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.learnerProfile.create.mockResolvedValue(mockProfile);

    // Send body with knownTopicIds (old field) instead of knownTopics
    const bodyWithOldField = {
      level: "beginner",
      goal: "career_change",
      dailyTimeMin: 60,
      knownTopicIds: ["topic-id-1", "topic-id-2"], // old field — should be ignored
      learningStyle: "hands_on",
      // knownTopics is optional — omitted
    };

    const req = makeRequest(COURSE_ID, "POST", bodyWithOldField);
    const res = await POST(req, makeParams(COURSE_ID));

    // Route must not return 500 — either 201 (field ignored) or 400 (not a 500)
    expect(res.status).not.toBe(500);

    // knownTopicIds must NOT be stored — verify create was called with
    // knownTopics as a JSON string of an array, not with knownTopicIds
    if (res.status === 201 && mockPrisma.learnerProfile.create.mock.calls.length > 0) {
      const createCall = mockPrisma.learnerProfile.create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty("knownTopicIds");
    }
  });

  it("PUT: sending knownTopicIds does not update the profile incorrectly", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(mockProfile);
    mockPrisma.learnerProfile.update.mockResolvedValue(mockProfile);

    const bodyWithOldField = {
      level: "beginner",
      goal: "career_change",
      dailyTimeMin: 60,
      knownTopicIds: ["topic-id-1"], // old field
      learningStyle: "hands_on",
    };

    const req = makeRequest(COURSE_ID, "PUT", bodyWithOldField);
    const res = await PUT(req, makeParams(COURSE_ID));

    // Must not 500
    expect(res.status).not.toBe(500);

    // If update was called, verify knownTopicIds is not in the data
    if (res.status === 200 && mockPrisma.learnerProfile.update.mock.calls.length > 0) {
      const updateCall = mockPrisma.learnerProfile.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty("knownTopicIds");
    }
  });
});

// ── Enum validation edge cases ───────────────────────────────────────────────

describe("Profile enum validation edge cases", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("validates all level enum values: beginner, intermediate, advanced", async () => {
    for (const level of ["beginner", "intermediate", "advanced"]) {
      vi.clearAllMocks();
      const profileForLevel = { ...mockProfile, level };
      mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
      mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
      mockPrisma.learnerProfile.create.mockResolvedValue(profileForLevel);

      const req = makeRequest(COURSE_ID, "POST", { ...validBody, level });
      const res = await POST(req, makeParams(COURSE_ID));

      expect(res.status).toBe(201);
    }
  });

  it("rejects invalid level enum", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest(COURSE_ID, "POST", { ...validBody, level: "expert" });
    const res = await POST(req, makeParams(COURSE_ID));

    expect(res.status).toBe(400);
  });

  it("validates all learningStyle enum values: theory_first, hands_on, mixed", async () => {
    for (const learningStyle of ["theory_first", "hands_on", "mixed"]) {
      vi.clearAllMocks();
      const profileForStyle = { ...mockProfile, learningStyle };
      mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
      mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
      mockPrisma.learnerProfile.create.mockResolvedValue(profileForStyle);

      const req = makeRequest(COURSE_ID, "POST", { ...validBody, learningStyle });
      const res = await POST(req, makeParams(COURSE_ID));

      expect(res.status).toBe(201);
    }
  });

  it("rejects invalid learningStyle enum", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest(COURSE_ID, "POST", { ...validBody, learningStyle: "visual" });
    const res = await POST(req, makeParams(COURSE_ID));

    expect(res.status).toBe(400);
  });

  it("validates dailyTimeMin enum values: 30, 60, 120", async () => {
    for (const dailyTimeMin of [30, 60, 120]) {
      vi.clearAllMocks();
      const profileForTime = { ...mockProfile, dailyTimeMin };
      mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
      mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
      mockPrisma.learnerProfile.create.mockResolvedValue(profileForTime);

      const req = makeRequest(COURSE_ID, "POST", { ...validBody, dailyTimeMin });
      const res = await POST(req, makeParams(COURSE_ID));

      expect(res.status).toBe(201);
    }
  });

  it("rejects invalid dailyTimeMin value", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest(COURSE_ID, "POST", { ...validBody, dailyTimeMin: 45 });
    const res = await POST(req, makeParams(COURSE_ID));

    expect(res.status).toBe(400);
  });

  it("PUT with empty knownTopics array", async () => {
    const updatedProfile = { ...mockProfile, knownTopics: "[]" };
    mockPrisma.course.findFirst.mockResolvedValue({ id: COURSE_ID });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(mockProfile);
    mockPrisma.learnerProfile.update.mockResolvedValue(updatedProfile);

    const req = makeRequest(COURSE_ID, "PUT", { ...validBody, knownTopics: [] });
    const res = await PUT(req, makeParams(COURSE_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.knownTopics).toEqual([]);
  });
});
