# Phase 6 — Schema Refactoring & Data Scoping

## Context Links

- Design Guidelines §19: `docs/design-guidelines.md` (line 1210+) — Data Scoping & Privacy
- PRD §6.20: `docs/prd.md` (line 345) — Multi-User Data Scoping (U-01..U-06)
- Current schema: `prisma/schema.prisma`
- Prisma singleton: `src/lib/prisma.ts`

## Overview

- **Priority:** Critical — blocks Phase 7 (Auth) and Phase 8 (Dashboard)
- **Status:** Pending
- **Description:** Add User model, LessonArtifact model, userId FK to all existing models, write migration script for legacy data. This is the structural foundation that enables multi-user data isolation.

## Key Insights

1. **SQLite limitations:** No `ALTER COLUMN`, no `DROP COLUMN` easily. Prisma `db push` handles this via table recreation, but production needs careful migration scripts.
2. **Current schema has 7 models** (Course, Lesson, LessonProgress, CourseProgress, FlashcardReview, LearnerProfile, ChatMessage) — all need userId FK.
3. **Lesson stores AI artifacts** directly (summary, explanation, quiz, flashcards, exercises, notes) — these must be extracted to per-user LessonArtifact model.
4. **LessonProgress/CourseProgress** use `@@unique([lessonId])` and `@@unique([courseId])` — must change to `@@unique([userId, lessonId])` and `@@unique([userId, courseId])` for multi-user.
5. **FlashcardReview** uses `@@unique([lessonId, cardIndex])` — must change to `@@unique([userId, lessonId, cardIndex])`.
6. **LearnerProfile** uses `@@unique([courseId])` — must change to `@@unique([userId, courseId])`.
7. **Course.url** has `@unique` constraint — must change to `@@unique([userId, url])` so different users can import same Udemy course.

## Requirements

### Functional
- U-01: All data models add `userId` FK with 4 ownership types (source, artifact, progress, config)
- U-02: LessonArtifact model with `@@unique([userId, lessonId, type])`
- U-03: Migrate existing AI fields from Lesson → LessonArtifact
- U-04: Bootstrap user protocol — first registration claims NULL-userId records
- U-05: Data isolation — query middleware auto-filters by userId
- U-06: Preference migration localStorage → DB (bind-and-clear)

### Non-Functional
- Migration script must be idempotent (safe to run multiple times)
- Zero data loss during migration
- Rollback capability via backup table
- `npx prisma db push` must succeed after schema changes

## Architecture

### New User Model

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String?
  avatarUrl     String?
  tokenVersion  Int      @default(0)
  preferences   String?  // JSON: theme, aiProfile, sidebarCollapsed, etc.
  resetToken    String?
  resetTokenExp DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  courses          Course[]
  lessonProgress   LessonProgress[]
  courseProgress    CourseProgress[]
  flashcardReviews FlashcardReview[]
  learnerProfiles  LearnerProfile[]
  chatMessages     ChatMessage[]
  lessonArtifacts  LessonArtifact[]
}
```

### New LessonArtifact Model

```prisma
model LessonArtifact {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  type      String   // "summary" | "explanation" | "quiz" | "flashcards" | "exercises" | "notes"
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, lessonId, type])
}
```

### FK Changes to Existing Models

| Model | Change | New Unique Constraint |
|-------|--------|----------------------|
| Course | Add `userId String` + relation | `@@unique([userId, url])` (replace `@unique` on url) |
| Lesson | Add `lessonArtifacts LessonArtifact[]` relation | — (inherited via Course) |
| LessonProgress | Add `userId String` + relation | `@@unique([userId, lessonId])` |
| CourseProgress | Add `userId String` + relation | `@@unique([userId, courseId])` |
| FlashcardReview | Add `userId String` + relation | `@@unique([userId, lessonId, cardIndex])` |
| LearnerProfile | Add `userId String` + relation | `@@unique([userId, courseId])` |
| ChatMessage | Add `userId String` + relation | — |

### Data Flow: Migration

```
1. Add User model + LessonArtifact model to schema
2. Add nullable userId to all existing models (prisma db push)
3. On first user registration:
   a. Create User record
   b. UPDATE all records WHERE userId IS NULL → SET userId = newUser.id
   c. For each Lesson with non-null AI fields:
      - Create LessonArtifact records (via Course.userId)
      - Set original Lesson AI fields to NULL
4. Make userId non-nullable (second schema push after migration)
```

## Related Code Files

### Files to Modify
- `prisma/schema.prisma` — Add User, LessonArtifact, userId FKs
- `src/lib/prisma.ts` — Keep as-is (singleton pattern unchanged)
- `src/app/api/courses/route.ts` — Add userId filter to GET, userId to POST
- `src/app/api/courses/[id]/route.ts` — Add userId ownership check
- `src/app/api/courses/[id]/lessons/route.ts` — Inherit userId from Course
- `src/app/api/courses/[id]/ai/route.ts` — Query LessonArtifact instead of Lesson fields
- `src/app/api/lessons/[id]/route.ts` — Add userId ownership check
- `src/app/api/lessons/[id]/ai/route.ts` — Query LessonArtifact instead of Lesson fields
- `src/app/api/lessons/[id]/transcript/route.ts` — Add userId ownership check
- `src/app/api/lessons/[id]/notes/route.ts` — Use LessonArtifact type="notes"
- `src/app/api/lessons/[id]/progress/route.ts` — Add userId filter
- `src/app/api/lessons/[id]/chat/route.ts` — Add userId filter
- `src/app/api/lessons/[id]/srs/init/route.ts` — Add userId filter
- `src/app/api/lessons/[id]/srs/review/route.ts` — Add userId filter
- `src/app/api/lessons/[id]/srs/due/route.ts` — Add userId filter
- `src/app/api/courses/[id]/progress/route.ts` — Add userId filter
- `src/app/api/courses/[id]/profile/route.ts` — Add userId filter
- `src/app/api/courses/[id]/notes/search/route.ts` — Use LessonArtifact
- `src/app/api/courses/[id]/collection/route.ts` — Add userId filter
- `src/app/api/courses/upload/route.ts` — Add userId to created records
- `src/app/api/udemy/import/route.ts` — Add userId to created records
- `src/app/api/ai/summary/route.ts` — Read/write LessonArtifact
- `src/app/api/ai/explain/route.ts` — Read/write LessonArtifact
- `src/app/api/ai/quiz/route.ts` — Read/write LessonArtifact
- `src/app/api/ai/roadmap/route.ts` — Read/write Course (userId owned)
- `src/app/api/ai/chat/route.ts` — Add userId to ChatMessage
- `src/app/api/srs/dashboard/route.ts` — Add userId filter
- `src/app/api/analytics/overview/route.ts` — Add userId filter
- `src/app/api/analytics/course/[id]/route.ts` — Add userId filter
- `src/app/api/export/lesson/[id]/route.ts` — Add userId ownership check
- `src/app/api/export/course/[id]/route.ts` — Add userId ownership check
- `src/app/api/books/route.ts` — Add userId filter
- `src/app/api/books/upload/route.ts` — Add userId
- `src/app/api/books/split/route.ts` — Add userId
- `src/app/api/books/split/confirm/route.ts` — Add userId
- `src/app/api/books/split/lessons/route.ts` — Add userId
- `src/app/api/courses/[id]/lessons/reorder/route.ts` — Add userId check
- `src/app/api/courses/[id]/lessons/merge/route.ts` — Add userId check
- `src/app/api/courses/[id]/lessons/split/route.ts` — Add userId check

### Files to Create
- `src/lib/auth.ts` — `withAuth()` helper to extract userId from session (used by all API routes)
- `prisma/scripts/migrate-legacy-data.ts` — Bootstrap user migration script
- `prisma/scripts/extract-lesson-artifacts.ts` — LessonArtifact migration script

### Files to Delete
- None (backward compat — Lesson AI fields kept temporarily)

## Implementation Steps

### Step 1: Add User Model to Schema
1. Edit `prisma/schema.prisma`:
   - Add `User` model with all fields (email, passwordHash, name, avatarUrl, tokenVersion, preferences, resetToken, resetTokenExp, timestamps)
   - Add all relation arrays to User

### Step 2: Add LessonArtifact Model
1. Edit `prisma/schema.prisma`:
   - Add `LessonArtifact` model with userId, lessonId, type, content
   - Add `@@unique([userId, lessonId, type])`
   - Add `lessonArtifacts LessonArtifact[]` relation to Lesson model

### Step 3: Add userId FK to All Existing Models
1. Edit `prisma/schema.prisma` for each model:
   - Course: add `userId String?` (nullable initially), `user User? @relation(...)`, change `url String? @unique` → remove @unique, add `@@unique([userId, url])`
   - LessonProgress: add `userId String?`, `user User? @relation(...)`, change `@@unique([lessonId])` → `@@unique([userId, lessonId])`
   - CourseProgress: add `userId String?`, `user User? @relation(...)`, change `@@unique([courseId])` → `@@unique([userId, courseId])`
   - FlashcardReview: add `userId String?`, `user User? @relation(...)`, change `@@unique([lessonId, cardIndex])` → `@@unique([userId, lessonId, cardIndex])`
   - LearnerProfile: add `userId String?`, `user User? @relation(...)`, change `@@unique([courseId])` → `@@unique([userId, courseId])`
   - ChatMessage: add `userId String?`, `user User? @relation(...)`
2. Run `npx prisma db push` to apply schema

### Step 4: Create withAuth Helper
1. Create `src/lib/auth.ts`:
   - `withAuth(handler)` wrapper that extracts userId from JWT cookie
   - Returns userId or 401 response
   - Pattern: `const userId = await getAuthUserId(req); if (!userId) return unauthorized();`
   - Keep under 60 lines — simple extraction, no middleware logic yet (that's Phase 7)
   - For Phase 6, this is a STUB that returns a hardcoded userId (first user) — real JWT validation comes in Phase 7

### Step 5: Create Legacy Data Migration Script
1. Create `prisma/scripts/migrate-legacy-data.ts`:
   - Accept userId parameter (the bootstrap user)
   - UPDATE Course SET userId = ? WHERE userId IS NULL
   - UPDATE LessonProgress, CourseProgress, FlashcardReview, LearnerProfile, ChatMessage SET userId = ? WHERE userId IS NULL
   - Create `_legacy_ownership_backup` table for rollback
   - Verification: assert COUNT WHERE userId IS NULL = 0

### Step 6: Create LessonArtifact Extraction Script
1. Create `prisma/scripts/extract-lesson-artifacts.ts`:
   - For each Lesson with non-null AI fields:
     - Resolve userId via Course.userId
     - For each field (summary, explanation, quiz, flashcards, exercises, notes):
       - If non-null: CREATE LessonArtifact { userId, lessonId, type, content }
   - Set original Lesson fields to NULL after extraction
   - Verification: assert artifact count = non-null field count

### Step 7: Update API Routes — Add withAuth + userId Scoping
1. For EACH API route listed in "Files to Modify":
   - Import `withAuth` from `src/lib/auth.ts`
   - Wrap handler or extract userId at top of handler
   - Add `where: { userId }` to all Prisma queries
   - For Lesson routes: verify ownership via `Course.userId`
   - For AI routes: switch from `lesson.summary` to `lessonArtifact.findUnique({ where: { userId_lessonId_type } })`
   - Maintain backward compatibility: if LessonArtifact not found, fall back to Lesson field (transition period)

### Step 8: Update Unique Constraints (Post-Migration)
1. After migration runs successfully:
   - Change all `userId String?` to `userId String` (non-nullable)
   - Run `npx prisma db push`

## Todo List

- [ ] 6.1 Add User model to prisma/schema.prisma
- [ ] 6.2 Add LessonArtifact model to prisma/schema.prisma
- [ ] 6.3 Add nullable userId FK to Course, LessonProgress, CourseProgress, FlashcardReview, LearnerProfile, ChatMessage
- [ ] 6.4 Update unique constraints (userId + existing unique fields)
- [ ] 6.5 Run `npx prisma db push` — verify schema applies cleanly
- [ ] 6.6 Create `src/lib/auth.ts` with withAuth stub helper
- [ ] 6.7 Create `prisma/scripts/migrate-legacy-data.ts`
- [ ] 6.8 Create `prisma/scripts/extract-lesson-artifacts.ts`
- [ ] 6.9 Update Course API routes (GET/POST/DELETE) with userId scoping
- [ ] 6.10 Update Lesson API routes with userId ownership via Course
- [ ] 6.11 Update AI routes to use LessonArtifact (summary, explain, quiz, roadmap)
- [ ] 6.12 Update Progress routes (lesson + course) with userId filter
- [ ] 6.13 Update SRS routes (init, review, due, dashboard) with userId filter
- [ ] 6.14 Update Chat routes with userId filter
- [ ] 6.15 Update Notes routes to use LessonArtifact type="notes"
- [ ] 6.16 Update Analytics routes with userId filter
- [ ] 6.17 Update Export routes with userId ownership check
- [ ] 6.18 Update Upload/Import routes to pass userId on creation
- [ ] 6.19 Update Book routes with userId scoping
- [ ] 6.20 Run migration scripts on dev DB, verify data integrity
- [ ] 6.21 Make userId non-nullable, run final db push
- [ ] 6.22 Run existing tests — fix any failures from schema changes
- [ ] 6.23 Run `npm run quality-gate`

## Success Criteria

- [ ] User model exists in schema with all required fields
- [ ] LessonArtifact model exists with `@@unique([userId, lessonId, type])`
- [ ] All 7 existing models have userId FK (non-nullable after migration)
- [ ] All ~35 API routes scope queries by userId
- [ ] Migration script successfully assigns legacy data to bootstrap user
- [ ] LessonArtifact extraction correctly moves AI content from Lesson fields
- [ ] No data loss — verification queries pass
- [ ] All existing tests pass (updated for userId context)
- [ ] `npx prisma db push` succeeds

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| SQLite migration fails on unique constraint change | Medium | High | Use nullable userId first, then backfill, then make non-nullable |
| Existing tests break due to missing userId | High | Medium | Create test helper that provides mock userId context |
| AI route queries become complex with LessonArtifact | Low | Medium | Create `getArtifact(userId, lessonId, type)` helper function |
| Data loss during LessonArtifact extraction | Low | Critical | Backup table + keep original Lesson fields until verified |
| Course.url unique constraint conflicts when multi-user | Medium | Medium | Change to `@@unique([userId, url])` — different users can import same course |

## Security Considerations

- userId MUST come from server session, NEVER from client request body
- All Prisma queries MUST include userId filter (no cross-user data leaks)
- 404-not-403 pattern: if record exists but wrong userId → return 404
- Migration scripts should run server-side only (not exposed as API)
- Password hash stored via bcrypt cost 12 (prepared for Phase 7)
- Reset token hashed in DB (not stored in plaintext)

## Next Steps

- Phase 7: Implement JWT auth system using the User model created here
- Phase 7 will replace the withAuth stub with real JWT validation
