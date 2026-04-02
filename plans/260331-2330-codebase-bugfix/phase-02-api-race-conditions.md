# Phase 2: API Race Conditions

**Issues:** H-6, H-7, H-4, M-9, M-10
**Files:** `books/upload/route.ts`, `books/split/confirm/route.ts`, `srs/review/route.ts`, `courses/[id]/profile/route.ts`, `books/route.ts`
**Priority:** High + Medium

## Issues

- **H-6:** `books/upload` — `existingCount` queried outside transaction (line 86). Concurrent uploads get same count → duplicate order values.
- **H-7:** `books/split/confirm` — `existingCount` check (line 38) is outside transaction. Two concurrent confirms both see 0 → both create lessons.
- **H-4:** `srs/review` — `totalReviews: review.totalReviews + 1` (line 59) uses stale read. Should use Prisma `increment`.
- **M-9:** `courses/[id]/profile` POST — check-then-create (lines 53-65) race. Two concurrent POSTs both see no profile → unique constraint error → 500.
- **M-10:** `books/route.ts` DELETE — TOCTOU: check `_count.lessons > 0` (line 75) then delete (line 82). Lesson could be added between check and delete.

## Implementation Steps

### H-6: Move existingCount inside transaction
1. In `books/upload/route.ts`, move the `prisma.lesson.count()` call (line 86-88) inside the `$transaction` block (after line 162)
2. Use `tx.lesson.count()` instead of `prisma.lesson.count()`

### H-7: Move existingCount check inside transaction
1. In `books/split/confirm/route.ts`, convert batch `$transaction` to interactive transaction
2. Move the `existingCount` check (lines 38-46) inside the transaction using `tx.lesson.count()`
3. Keep the lesson creation inside same transaction

### H-4: Use Prisma atomic increment
1. In `srs/review/route.ts` line 59, replace `totalReviews: review.totalReviews + 1` with `totalReviews: { increment: 1 }`

### M-9: Handle unique constraint gracefully
1. In `courses/[id]/profile/route.ts` POST, remove the check-then-create pattern (lines 53-58)
2. Use `prisma.learnerProfile.create()` directly inside try-catch
3. Catch Prisma unique constraint error (P2002) → return 409 with existing message
4. Alternative: use `upsert` but POST semantics requires create-only, so catch is better

### M-10: Atomic delete with WHERE conditions
1. In `books/route.ts` DELETE, combine check+delete into single operation:
   ```
   const result = await prisma.course.deleteMany({
     where: { id, contentType: "book", lessons: { none: {} } }
   });
   if (result.count === 0) → check why (not found / not book / has lessons) and return appropriate error
   ```
2. Or use interactive transaction wrapping both findUnique + delete

## Success Criteria
- [x] Concurrent book uploads get unique order values
- [x] Concurrent split confirms → second gets 409
- [x] SRS totalReviews never loses increments under concurrency
- [x] Concurrent profile creation → second gets 409 (not 500)
- [x] Book stub delete is atomic — can't delete if lessons added between check and delete

**Status:** ✅ COMPLETE
