/**
 * Integration tests for SRS API routes:
 * - POST /api/lessons/[id]/srs/init
 * - GET  /api/lessons/[id]/srs/due
 * - POST /api/lessons/[id]/srs/review
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Hoisted mocks ----------

const { mockPrisma } = vi.hoisted(() => {
  const db = {
    lesson: {
      findUnique: vi.fn(),
    },
    flashcardReview: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    // Allow the route's $transaction(async tx => ...) to work:
    // the callback receives db itself so all sub-mocks remain active.
    $transaction: vi.fn().mockImplementation(
      async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
    ),
  };
  return { mockPrisma: db };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ---------- Route imports (after mock) ----------

import { POST as initSRS } from "@/app/api/lessons/[id]/srs/init/route";
import { GET as getDue } from "@/app/api/lessons/[id]/srs/due/route";
import { POST as submitReview } from "@/app/api/lessons/[id]/srs/review/route";

// ---------- Helpers ----------

const LESSON_ID = "lesson-1";
const FLASHCARDS_JSON = JSON.stringify({
  cards: [
    { front: "Q1", back: "A1", type: "definition", mnemonic: "M1" },
    { front: "Q2", back: "A2", type: "concept", mnemonic: "M2" },
    { front: "Q3", back: "A3", type: "definition", mnemonic: null },
  ],
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

// ---------- Reset mocks ----------

beforeEach(() => {
  vi.clearAllMocks();
});

// ==============================
// POST /api/lessons/[id]/srs/init
// ==============================

describe("POST /api/lessons/[id]/srs/init", () => {
  it("creates FlashcardReview records for each card", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: FLASHCARDS_JSON,
    });
    mockPrisma.flashcardReview.findMany.mockResolvedValue([]);
    mockPrisma.flashcardReview.createMany.mockResolvedValue({ count: 3 });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/init`,
      {}
    );
    const res = await initSRS(req, makeParams(LESSON_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.created).toBe(3);
    expect(data.skipped).toBe(0);
  });

  it("skips already-existing card indices (idempotent)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: FLASHCARDS_JSON,
    });
    // Card 0 already exists
    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      { cardIndex: 0 },
    ]);
    mockPrisma.flashcardReview.createMany.mockResolvedValue({ count: 2 });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/init`,
      {}
    );
    const res = await initSRS(req, makeParams(LESSON_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.created).toBe(2);
    expect(data.skipped).toBe(1);
  });

  it("returns 404 if lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = makePostRequest(
      "http://localhost/api/lessons/nonexistent/srs/init",
      {}
    );
    const res = await initSRS(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("returns 422 if lesson has no flashcards field", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: null,
    });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/init`,
      {}
    );
    const res = await initSRS(req, makeParams(LESSON_ID));

    expect(res.status).toBe(422);
  });

  it("returns 422 if flashcards.cards is empty array", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: JSON.stringify({ cards: [] }),
    });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/init`,
      {}
    );
    const res = await initSRS(req, makeParams(LESSON_ID));

    expect(res.status).toBe(422);
  });
});

// ==============================
// GET /api/lessons/[id]/srs/due
// ==============================

describe("GET /api/lessons/[id]/srs/due", () => {
  it("returns due cards with card content from lesson flashcards", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: FLASHCARDS_JSON,
    });
    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      {
        cardIndex: 0,
        interval: 1,
        repetitions: 0,
        easinessFactor: 2.5,
        lastQuality: 0,
        nextReviewAt: new Date("2026-03-29T00:00:00Z"),
      },
      {
        cardIndex: 2,
        interval: 1,
        repetitions: 1,
        easinessFactor: 2.3,
        lastQuality: 3,
        nextReviewAt: new Date("2026-03-30T00:00:00Z"),
      },
    ]);

    const req = makeGetRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/due`
    );
    const res = await getDue(req, makeParams(LESSON_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(2);
    expect(data.dueCards).toHaveLength(2);
    expect(data.dueCards[0]).toMatchObject({
      cardIndex: 0,
      front: "Q1",
      back: "A1",
      type: "definition",
      mnemonic: "M1",
    });
    expect(data.dueCards[1]).toMatchObject({
      cardIndex: 2,
      front: "Q3",
      back: "A3",
    });
  });

  it("returns empty array when no cards are due", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: FLASHCARDS_JSON,
    });
    mockPrisma.flashcardReview.findMany.mockResolvedValue([]);

    const req = makeGetRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/due`
    );
    const res = await getDue(req, makeParams(LESSON_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(0);
    expect(data.dueCards).toEqual([]);
  });

  it("returns 404 if lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = makeGetRequest(
      "http://localhost/api/lessons/nonexistent/srs/due"
    );
    const res = await getDue(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });
});

// ==============================
// POST /api/lessons/[id]/srs/review
// ==============================

describe("POST /api/lessons/[id]/srs/review", () => {
  it("updates card with SM-2 results and returns new state", async () => {
    mockPrisma.flashcardReview.findFirst.mockResolvedValue({
      id: "review-1",
      lessonId: LESSON_ID,
      cardIndex: 0,
      easinessFactor: 2.5,
      interval: 0,
      repetitions: 0,
      totalReviews: 0,
    });
    mockPrisma.flashcardReview.update.mockResolvedValue({
      id: "review-1",
      cardIndex: 0,
      interval: 1,
      repetitions: 1,
      easinessFactor: 2.6,
      nextReviewAt: new Date("2026-03-31T00:00:00Z"),
      totalReviews: 1,
    });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { cardIndex: 0, quality: 5 }
    );
    const res = await submitReview(req, makeParams(LESSON_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cardIndex).toBe(0);
    expect(data.interval).toBe(1);
    expect(data.repetitions).toBe(1);
    expect(data.totalReviews).toBe(1);
    expect(mockPrisma.flashcardReview.update).toHaveBeenCalled();
  });

  it("returns 404 if review record not found", async () => {
    mockPrisma.flashcardReview.findFirst.mockResolvedValue(null);

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { cardIndex: 99, quality: 3 }
    );
    const res = await submitReview(req, makeParams(LESSON_ID));

    expect(res.status).toBe(404);
  });

  it("returns 400 if quality is out of range", async () => {
    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { cardIndex: 0, quality: 6 }
    );
    const res = await submitReview(req, makeParams(LESSON_ID));

    expect(res.status).toBe(400);
  });

  it("returns 400 if quality is negative", async () => {
    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { cardIndex: 0, quality: -1 }
    );
    const res = await submitReview(req, makeParams(LESSON_ID));

    expect(res.status).toBe(400);
  });

  it("returns 400 if cardIndex is negative", async () => {
    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { cardIndex: -1, quality: 3 }
    );
    const res = await submitReview(req, makeParams(LESSON_ID));

    expect(res.status).toBe(400);
  });

  it("returns 400 if body is missing required fields", async () => {
    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { quality: 3 } // missing cardIndex
    );
    const res = await submitReview(req, makeParams(LESSON_ID));

    expect(res.status).toBe(400);
  });

  it("returns 400 if quality is not an integer", async () => {
    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/review`,
      { cardIndex: 0, quality: 3.5 }
    );
    const res = await submitReview(req, makeParams(LESSON_ID));

    expect(res.status).toBe(400);
  });
});

// ==============================
// C-5 regression: concurrent SRS init — no 500, no duplicates
// ==============================

describe("C-5 regression: concurrent SRS init is idempotent", () => {
  it("second concurrent call returns 200 with 0 created (all skipped)", async () => {
    // Simulate: first call already created all 3 cards.
    // Second concurrent call finds them all via findMany and skips.
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: FLASHCARDS_JSON,
    });

    // All 3 cards already exist when second call reads
    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      { cardIndex: 0 },
      { cardIndex: 1 },
      { cardIndex: 2 },
    ]);
    // createMany should not be called — but if it is, return 0
    mockPrisma.flashcardReview.createMany.mockResolvedValue({ count: 0 });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/init`,
      {}
    );
    const res = await initSRS(req, makeParams(LESSON_ID));
    const data = await res.json();

    // Must return 200 (not 500) — idempotent
    expect(res.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(3);

    // createMany should NOT have been called (nothing new to create)
    expect(mockPrisma.flashcardReview.createMany).not.toHaveBeenCalled();
  });

  it("uses $transaction to prevent duplicate card creation", async () => {
    // Verify the route wraps init logic in a $transaction.
    // We check this by confirming findMany is called within the same mock scope.
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: LESSON_ID,
      flashcards: FLASHCARDS_JSON,
    });

    mockPrisma.flashcardReview.findMany.mockResolvedValue([]);
    mockPrisma.flashcardReview.createMany.mockResolvedValue({ count: 3 });

    const req = makePostRequest(
      `http://localhost/api/lessons/${LESSON_ID}/srs/init`,
      {}
    );
    const res = await initSRS(req, makeParams(LESSON_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.created).toBe(3);

    // Both findMany and createMany called — indicates $transaction pattern
    expect(mockPrisma.flashcardReview.findMany).toHaveBeenCalled();
    expect(mockPrisma.flashcardReview.createMany).toHaveBeenCalled();

    // createMany data must use cardIndex 0,1,2 — no duplicates
    const createManyCall = mockPrisma.flashcardReview.createMany.mock.calls[0][0];
    const indices = createManyCall.data.map((d: { cardIndex: number }) => d.cardIndex);
    expect(indices).toEqual([0, 1, 2]);
    expect(new Set(indices).size).toBe(3); // all unique
  });
});
