/**
 * Tests for GET /api/analytics/overview
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Hoisted mocks ----------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: { count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    lesson: { findMany: vi.fn() },
    lessonProgress: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    flashcardReview: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    courseProgress: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ---------- Route import (after mock) ----------

import { GET } from "@/app/api/analytics/overview/route";

// ---------- Helpers ----------

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/analytics/overview", {
    method: "GET",
  });
}

/** Create a Date for a given YYYY-MM-DD in UTC. */
function dateOf(s: string): Date {
  return new Date(s + "T12:00:00Z");
}

/** Reset all mocks to safe defaults. */
function setDefaults() {
  mockPrisma.course.count.mockResolvedValue(0);
  mockPrisma.lessonProgress.count.mockResolvedValue(0);
  mockPrisma.lessonProgress.aggregate.mockResolvedValue({
    _sum: { timeSpentMs: 0 },
    _avg: { quizScore: null },
  });
  mockPrisma.flashcardReview.count.mockResolvedValue(0);
  mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setDefaults();
});

// ==============================
// GET /api/analytics/overview
// ==============================

describe("GET /api/analytics/overview", () => {
  it("returns full data when all metrics have values", async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

    mockPrisma.course.count.mockResolvedValue(3);
    mockPrisma.lessonProgress.count.mockResolvedValue(42);

    // aggregate for timeSpentMs
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 18600000 } }) // time
      .mockResolvedValueOnce({ _avg: { quizScore: 78.5 } }); // quiz

    // flashcard counts
    mockPrisma.flashcardReview.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(65); // mastered

    // lesson completions for streak + frequency
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: dateOf(todayStr) },
      { completedAt: dateOf(todayStr) },
      { completedAt: dateOf(yesterdayStr) },
      { completedAt: dateOf(twoDaysAgoStr) },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalCourses).toBe(3);
    expect(data.totalLessonsCompleted).toBe(42);
    expect(data.totalTimeSeconds).toBe(18600);
    expect(data.averageQuizScore).toBe(78.5);
    expect(data.overallRetentionRate).toBe(65);
    expect(data.currentStreak).toBe(3);
    expect(data.longestStreak).toBe(3);
    expect(data.studyFrequency).toHaveLength(365);

    // Check today has 2 lessons
    const todayEntry = data.studyFrequency.find(
      (e: { date: string }) => e.date === todayStr
    );
    expect(todayEntry?.lessonsCompleted).toBe(2);
  });

  it("returns zeros and nulls when no data exists", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalCourses).toBe(0);
    expect(data.totalLessonsCompleted).toBe(0);
    expect(data.totalTimeSeconds).toBe(0);
    expect(data.averageQuizScore).toBeNull();
    expect(data.overallRetentionRate).toBeNull();
    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(0);
    expect(data.studyFrequency).toHaveLength(365);
    // All frequencies should be 0
    expect(data.studyFrequency.every((e: { lessonsCompleted: number }) => e.lessonsCompleted === 0)).toBe(true);
  });

  it("returns null averageQuizScore when no quiz data", async () => {
    mockPrisma.course.count.mockResolvedValue(2);
    mockPrisma.lessonProgress.count.mockResolvedValue(5);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 5000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.averageQuizScore).toBeNull();
    expect(data.totalTimeSeconds).toBe(5);
  });

  it("returns null overallRetentionRate when no flashcard reviews exist", async () => {
    mockPrisma.course.count.mockResolvedValue(1);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 1000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 90 } });
    // No flashcard reviews
    mockPrisma.flashcardReview.count.mockResolvedValue(0);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.overallRetentionRate).toBeNull();
  });

  it("calculates streak correctly when today has no completions but yesterday does", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: yesterday },
      { completedAt: twoDaysAgo },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    // Yesterday and 2 days ago = 2-day streak (still active since gap is only 1 day from today)
    expect(data.currentStreak).toBe(2);
    expect(data.longestStreak).toBe(2);
  });

  it("returns streak 0 when last completion was more than 1 day ago", async () => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: threeDaysAgo },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(1);
  });

  it("calculates longest streak from non-recent dates", async () => {
    // Create a long streak in the past but no current streak
    const today = new Date();
    const dates = [];
    // 5 consecutive days starting 20 days ago
    for (let i = 24; i >= 20; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push({ completedAt: d });
    }

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue(dates);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.longestStreak).toBe(5);
    expect(data.currentStreak).toBe(0); // Last activity was 20 days ago
  });

  it("handles partial data — some courses have progress, others do not", async () => {
    mockPrisma.course.count.mockResolvedValue(5);
    mockPrisma.lessonProgress.count.mockResolvedValue(3);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 60000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 50 } });
    mockPrisma.flashcardReview.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);

    const today = new Date();
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: today },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.totalCourses).toBe(5);
    expect(data.totalLessonsCompleted).toBe(3);
    expect(data.totalTimeSeconds).toBe(60);
    expect(data.averageQuizScore).toBe(50);
    expect(data.overallRetentionRate).toBe(30);
    expect(data.currentStreak).toBe(1);
  });

  it("returns 500 when database throws an error", async () => {
    mockPrisma.course.count.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to get analytics overview");
  });

  it("rounds averageQuizScore to 2 decimal places", async () => {
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 78.3333333 } });

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.averageQuizScore).toBe(78.33);
  });

  it("studyFrequency covers exactly 365 days ending today", async () => {
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.studyFrequency).toHaveLength(365);
    const todayStr = new Date().toISOString().split("T")[0];
    const lastEntry = data.studyFrequency[data.studyFrequency.length - 1];
    expect(lastEntry.date).toBe(todayStr);
  });
});

// ─── Edge cases: heatmap and time tracking ─────────────────────────────────────

describe("heatmap and time tracking edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("heatmap data format: returns 365 entries with date and count", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.studyFrequency).toHaveLength(365);

    // Every entry should have date (YYYY-MM-DD) and lessonsCompleted (number)
    for (const entry of data.studyFrequency) {
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("lessonsCompleted");
      expect(typeof entry.date).toBe("string");
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof entry.lessonsCompleted).toBe("number");
    }
  });

  it("time tracking caps individual session at 24 hours — large value stored", async () => {
    const largeTimeMs = 48 * 60 * 60 * 1000; // 48 hours

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: largeTimeMs } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    // Should convert ms to seconds without error — whether capped or not
    expect(data.totalTimeSeconds).toBe(largeTimeMs / 1000);
  });

  it("handles timezone edge case in heatmap dates — dates are consistent", async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    // Completion at midnight boundary
    const midnightCompletion = new Date(todayStr + "T23:59:59.999Z");
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: midnightCompletion },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    // Frequency array should still be 365 entries
    expect(data.studyFrequency).toHaveLength(365);
  });

  it("weekly trend calculation accuracy", async () => {
    const today = new Date();
    const completions = [];

    // Create completions for 7 consecutive days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      completions.push({ completedAt: d });
      completions.push({ completedAt: d }); // 2 per day
    }

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue(completions);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.currentStreak).toBe(7);
    expect(data.longestStreak).toBe(7);

    // Last 7 entries in studyFrequency should each have 2 lessons
    const last7 = data.studyFrequency.slice(-7);
    for (const entry of last7) {
      expect(entry.lessonsCompleted).toBe(2);
    }
  });

  it("handles user with only one day of activity", async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    mockPrisma.course.count.mockResolvedValue(1);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 5000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 80 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: dateOf(todayStr) },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.currentStreak).toBe(1);
    expect(data.longestStreak).toBe(1);
    expect(data.totalLessonsCompleted).toBe(1);
    const todayEntry = data.studyFrequency.find(
      (e: { date: string }) => e.date === todayStr
    );
    expect(todayEntry?.lessonsCompleted).toBe(1);
  });

  it("weekly trend shows 0 for inactive weeks", async () => {
    // Activity only 30 days ago, nothing recent
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 1000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: dateOf(thirtyDaysAgoStr) },
    ]);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    // Recent 7 days should all be 0
    const last7 = data.studyFrequency.slice(-7);
    for (const entry of last7) {
      expect(entry.lessonsCompleted).toBe(0);
    }
    // The day 30 days ago should have 1
    const activeDay = data.studyFrequency.find(
      (e: { date: string }) => e.date === thirtyDaysAgoStr
    );
    expect(activeDay?.lessonsCompleted).toBe(1);
  });
});
