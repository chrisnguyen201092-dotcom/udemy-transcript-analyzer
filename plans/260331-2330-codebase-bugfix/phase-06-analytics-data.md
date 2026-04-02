# Phase 6: Analytics & Data

**Issues:** H-8, M-11, M-27, M-28
**Files:** `courses/[id]/lessons/reorder/route.ts`, `analytics/overview/route.ts`, AI cache layer
**Priority:** High + Medium

## Issues

- **H-8:** `courses/[id]/lessons/reorder` — no ownership verification. Any lessonId is accepted; could reorder lessons belonging to different courses.
- **M-11:** AI routes — cache miss race condition. Two simultaneous requests for same lesson's summary both miss cache → duplicate AI calls + double cost.
- **M-27:** `analytics/overview` — `findMany` (line 49) loads ALL completed lessons into memory for streak calculation. Unbounded — grows with usage.
- **M-28:** `analytics/overview` — `toDateString` uses UTC (`toISOString`), but user's "today" is local time. Streaks can be off by 1 day.

## Implementation Steps

### H-8: Verify lesson ownership in reorder
1. In `courses/[id]/lessons/reorder/route.ts`, after parsing lessonIds, verify all belong to the course:
   ```ts
   const ownedCount = await prisma.lesson.count({
     where: { courseId: id, id: { in: lessonIds } }
   });
   if (ownedCount !== lessonIds.length) {
     return NextResponse.json({ error: "Some lessons don't belong to this course" }, { status: 400 });
   }
   ```
2. Place this check inside the transaction for atomicity (or before, since it's a read)

### M-11: Simple lock/dedup for AI generation
1. Add a lightweight in-memory dedup map in a new util `src/lib/ai/generation-lock.ts`:
   ```ts
   const pending = new Map<string, Promise<string>>();
   export function deduplicateGeneration(key: string, fn: () => Promise<string>): Promise<string> {
     const existing = pending.get(key);
     if (existing) return existing;
     const promise = fn().finally(() => pending.delete(key));
     pending.set(key, promise);
     return promise;
   }
   ```
2. In AI routes (summary, explain, quiz, etc.), wrap the generation call:
   ```ts
   const result = await deduplicateGeneration(`summary:${lessonId}`, () => generateSummary(...));
   ```
3. Key format: `{type}:{lessonId}` — ensures different types don't collide

### M-27: Use aggregate query instead of findMany
1. In `analytics/overview/route.ts`, replace the `findMany` (line 49) with a SQL group-by:
   ```ts
   const dateCounts = await prisma.$queryRaw<{date: string; count: bigint}[]>`
     SELECT DATE(completedAt) as date, COUNT(*) as count
     FROM LessonProgress
     WHERE completed = 1 AND completedAt IS NOT NULL
     GROUP BY DATE(completedAt)
     ORDER BY date ASC
   `;
   ```
2. Update `calculateStreaks` and `buildStudyFrequency` to accept `{date: string, count: number}[]` instead of raw records
3. This reduces memory from O(n records) to O(n unique dates) — bounded by ~365 for streaks

### M-28: Add timezone parameter or document UTC behavior
1. Accept optional `timezone` query param in analytics overview:
   ```ts
   const tz = new URL(req.url).searchParams.get("tz") || "UTC";
   ```
2. For SQLite, timezone conversion is limited. Pragmatic approach:
   - Pass timezone offset from client as minutes
   - Adjust date bucketing in JS using the offset
   - Or: accept UTC approximation and document it as known limitation
3. Simplest fix: client sends `tzOffset` (minutes), server adjusts `completedAt` before bucketing:
   ```ts
   const adjustedDate = new Date(d.getTime() - tzOffset * 60000);
   ```

## Success Criteria
- [x] Reorder rejects lessonIds not belonging to the course
- [x] Concurrent identical AI requests result in single API call
- [x] Analytics overview doesn't load all progress records into memory
- [x] Streak calculation accounts for user timezone (or documented as UTC)

**Status:** ✅ COMPLETE
