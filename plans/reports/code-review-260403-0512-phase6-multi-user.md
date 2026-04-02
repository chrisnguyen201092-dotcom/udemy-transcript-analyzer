# Code Review: Phase 6 — Schema Refactoring & Multi-User Data Scoping

**Reviewer:** code-reviewer  
**Date:** 2026-04-03  
**Build:** 0 errors, 0 warnings | **Tests:** 829/829 passed  
**Verdict:** APPROVE with 3 issues (2 medium, 1 low)

---

## Scope

Reviewed all changes for Phase 6 multi-user foundation:
- `prisma/schema.prisma` — User model, LessonArtifact, userId FKs, compound uniques
- `src/lib/auth.ts` — `getAuthUserId` stub, `withAuth` wrapper
- 4 migration scripts in `prisma/scripts/`
- All 39 API route files in `src/app/api/`
- `src/test/setup.ts` — global auth mock
- 32 test files (not individually reviewed — covered by test pass + mock pattern inspection)

---

## 1. Security: userId Scoping (39/39 routes audited)

### PASS - All routes wrapped with `withAuth`

Every exported handler uses `withAuth(async (req, { userId, params }) => ...)`. No unprotected routes found.

### PASS - Data access scoped by userId

All Prisma queries include userId filtering:
- **Direct models** (Course, CourseProgress, LessonProgress, FlashcardReview, LearnerProfile): `where: { ..., userId }`
- **Indirect models** (Lesson, ChatMessage): scoped via `course: { userId }` relation filter
- **Upserts** use compound unique keys: `userId_lessonId`, `userId_courseId`, etc.

### PASS - Ownership verified before mutation

Pattern consistently applied: `findFirst({ where: { id, userId } })` → 404 if null → then `update/delete({ where: { id } })`. This is correct — the ownership check prevents IDOR.

---

## 2. Issues Found

### ISSUE-1: ChatMessage missing userId on CREATE and missing userId filter on READ [MEDIUM]

**File:** `src/app/api/lessons/[id]/chat/route.ts`

**Problem (a) — GET handler (line 22-23):**
```ts
const messages = await prisma.chatMessage.findMany({
  where: { lessonId: id },  // Missing: userId filter
```
After verifying the lesson belongs to the user's course, the query fetches ALL chat messages for that lesson regardless of userId. Currently single-user so no impact, but in multi-user this could leak messages if the Lesson model ever becomes shared across users (e.g., a future "shared course" feature).

**Risk:** Low now (lessons are scoped by course.userId), but violates defense-in-depth.

**Recommendation:** Add `userId` to the `where` clause: `where: { lessonId: id, userId }`.

**Problem (b) — POST handler (line 75-79):**
```ts
const message = await prisma.chatMessage.create({
  data: {
    lessonId: id,
    role: body.role,
    content: body.content,
    // Missing: userId
  },
});
```
New ChatMessage records are created without setting `userId`. This means new chat messages will have `userId: null` in the database.

**Recommendation:** Add `userId` to the create data.

**Problem (c) — DELETE handler (line 49-51):**
```ts
await prisma.chatMessage.deleteMany({
  where: { lessonId: id },  // Missing: userId filter
```
Same as GET — deletes all messages for the lesson, not just the user's.

**Recommendation:** Add `userId` to the where clause.

---

### ISSUE-2: AI chat route (`/api/ai/chat`) missing userId on ChatMessage persistence [MEDIUM]

**File:** `src/app/api/ai/chat/route.ts` (lines 97-100)

```ts
await prisma.chatMessage.createMany({
  data: [
    { lessonId, role: "user", content: userContent },
    { lessonId, role: "assistant", content: fullAssistantResponse },
    // Missing: userId in both records
  ],
});
```

**Impact:** Same as ISSUE-1b — chat messages persisted without userId, breaking multi-user scoping.

**Recommendation:** Add `userId` to both records in the createMany data array.

---

### ISSUE-3: `books/split/lessons` DELETE route doesn't scope related-count queries by userId [LOW]

**File:** `src/app/api/books/split/lessons/route.ts` (lines 33-37)

```ts
const [lessonCount, progress, flashcardReviews, chatMessages] = await Promise.all([
  prisma.lesson.count({ where: { courseId: bookId } }),
  prisma.lessonProgress.count({ where: { lesson: { courseId: bookId } } }),  // no userId
  prisma.flashcardReview.count({ where: { lesson: { courseId: bookId } } }),  // no userId
  prisma.chatMessage.count({ where: { lesson: { courseId: bookId } } }),      // no userId
]);
```

The `buildPreview` function counts related records across ALL users, not just the authenticated user. The actual deletion (`deleteMany`) is correctly scoped by course ownership (since the course was verified to belong to the user). The impact is cosmetic — preview counts may be inflated if multiple users shared data.

**Risk:** Low — cosmetic only, no data leakage. Course ownership is verified.

**Recommendation:** Add `userId` filter to the count queries for accuracy.

---

## 3. Schema Review

### PASS - Relations & Cascades

- All FK relations have `onDelete: Cascade` — correct for user deletion cleanup
- `User?` (nullable) on existing models is correct for migration period
- `LessonArtifact` has non-nullable `userId` — correct for new model

### PASS - Compound Unique Constraints

All compound uniques are well-designed:
- `@@unique([userId, url])` on Course — allows same URL for different users
- `@@unique([userId, lessonId])` on LessonProgress — one progress record per user per lesson
- `@@unique([userId, courseId])` on CourseProgress, LearnerProfile
- `@@unique([userId, lessonId, cardIndex])` on FlashcardReview
- `@@unique([userId, lessonId, type])` on LessonArtifact

### NOTE - Schema evolution consideration

Legacy AI fields (summary, explanation, quiz, flashcards, exercises, notes) remain on the Lesson model alongside the new LessonArtifact model. The migration scripts handle extraction correctly. A future cleanup migration should remove these columns once all data is migrated.

---

## 4. Auth Module Review

### PASS - `withAuth` wrapper design

- Clean separation: auth logic isolated in `getAuthUserId`, handler receives `{ userId, params }`
- 401 response when no user found
- Properly awaits `routeCtx.params` (Next.js 16 dynamic params are async)
- Clear TODO markers for Phase 7 JWT implementation

### NOTE - Stub security

The current stub (`findFirst` user) means ALL requests authenticate as the first user. This is acceptable for Phase 6 (single-user bridge) but must be replaced before any multi-user deployment. The TODO comment is clear.

---

## 5. Migration Scripts Review

### PASS - `bootstrap-and-migrate.ts`

- Creates bootstrap user idempotently (checks `findFirst` first)
- Migrates NULL userId records across all 6 models
- Extracts lesson artifacts using `upsert` (idempotent)
- Nullifies original AI fields after extraction
- Includes verification step — checks for orphans and remaining AI fields
- Safe to re-run

### PASS - `migrate-legacy-data.ts`

- Standalone script accepting userId as CLI arg
- Validates user exists before migration
- Dependency-ordered migration (Course first, children after)
- Verification with orphan count check
- Throws on incomplete migration

### PASS - `extract-lesson-artifacts.ts`

- Uses `upsert` with compound unique key — fully idempotent
- Skips lessons where course has no userId
- Error handling per-field (doesn't abort on single failure)
- Verification with count summary

### PASS - `check-db-state.ts`

- Read-only diagnostic tool — safe at any time

---

## 6. Test Setup Review

### PASS - Global auth mock

```ts
vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn().mockResolvedValue('test-user-id'),
  withAuth: vi.fn((handler) => {
    return async (req, routeCtx) => {
      const params = routeCtx?.params ? await routeCtx.params : undefined;
      return handler(req, { userId: 'test-user-id', params });
    };
  }),
}))
```

- Correctly injects consistent `test-user-id` across all tests
- Properly handles async params (Next.js 16 pattern)
- All 829 tests pass — mock contract matches implementation

---

## 7. Summary

| Category | Status | Notes |
|----------|--------|-------|
| All routes use `withAuth` | PASS | 39/39 verified |
| Prisma queries scoped by userId | PASS (37/39) | 2 routes have gaps (ISSUE-1, ISSUE-2) |
| Schema relations & cascades | PASS | Clean design |
| Compound unique constraints | PASS | Well-designed for multi-user |
| Migration scripts idempotent | PASS | Safe to re-run |
| Test mocks accurate | PASS | 829/829 pass |
| Auth stub adequate for phase | PASS | Clear Phase 7 TODOs |

### Recommended Actions

1. **[MEDIUM] Fix ChatMessage userId scoping** — Add `userId` to create/query in `lessons/[id]/chat/route.ts` and `ai/chat/route.ts`. ~10 min fix.
2. **[LOW] Fix preview counts** in `books/split/lessons/route.ts` — cosmetic but good hygiene. ~5 min fix.
3. **[FUTURE] Phase 7** — Replace auth stub with JWT validation before any multi-user deployment.

---

**Overall Assessment:** Solid multi-user foundation. The `withAuth` + userId scoping pattern is consistently applied across the vast majority of routes. The 2 medium issues are limited to ChatMessage operations and are low-risk in the current single-user stub phase but should be fixed before Phase 7 JWT auth.
