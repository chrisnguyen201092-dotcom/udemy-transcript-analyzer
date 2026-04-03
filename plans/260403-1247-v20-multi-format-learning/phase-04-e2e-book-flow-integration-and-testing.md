# Phase 4: End-to-End Book Flow Integration & Testing

## Context Links
- Upload flow: `src/components/UploadModal.tsx`
- Book routes: `src/app/api/books/` (upload, split, confirm, lessons)
- Split dialog: `src/components/SplitChapterDialog.tsx`
- Main page: `src/app/page.tsx`
- Phase 1-3 outputs: EPUB parsing, metadata, UI labels

## Overview
- **Priority:** HIGH — validates entire book feature works end-to-end
- **Status:** ✅ Complete
- **Effort:** 3-4 days
- **Dependencies:** Phase 1, 2, 3
- **Description:** Wire the complete book upload → parse → split → confirm → learn flow. Ensure all pieces from Phase 1-3 connect seamlessly. Write integration tests and fix edge cases discovered during testing.
- **Completed:** 2026-04-03

## Key Insights
- UploadModal already has a 2-step book flow (form → split preview) but needs polish
- SplitChapterDialog is for manual split of a single lesson — different from the auto-split preview
- **Authoritative v2.0 UI ingestion path:** UploadModal → `POST /api/courses` (stub) → `POST /api/books/split` → preview → `POST /api/books/split/confirm` (create lessons)
- **`/api/books/upload` is legacy/internal** — used by tests and potential future direct API. NOT the primary v2.0 UI path. Both paths share the same parsing library functions (no code duplication).
- Need to verify: after book upload + split confirm, user can immediately use AI features on chapters
- AI routes already read `contentType` from course and dispatch to book-specific prompts
- Dashboard widgets should reflect book courses (Continue Learning, progress tracking)

## Requirements

### Functional
- F1: Complete happy path: upload book → auto-split → confirm → view chapters → use AI
- F2: Upload book with no chapter structure → single lesson fallback → user can manually split later
- F3: Re-split flow: delete existing chapters → re-upload/re-split
- F4: Cancel flow: cancel during split preview → clean up book stub
- F5: Error recovery: parse failure → clear error message → retry
- F6: AI features work on book chapters: summary, explain, chat, quiz, flashcard, exercise, roadmap

### Non-Functional
- NF1: Upload + parse + split < 15s for typical book (PDF < 10MB)
- NF2: Split preview renders < 1s
- NF3: No orphaned book stubs after cancel

## Architecture

### Complete Book Upload Flow
```
User clicks "Upload sách"
  → UploadModal opens in book mode
  → User fills: title, author*, isbn*, publisher*, selects file
  → Client reads file → base64 encode (binary) or text (txt/md)
  → POST /api/courses { title, author, isbn, publisher, contentType: "book" }
    → Creates Course stub (contentType="book", no lessons)
    → Returns { id } (courseId used as bookId)
  → POST /api/books/split { bookId, format, content, splitConfig }
    → Parses file content
    → Heuristic chapter detection (+AI if enabled)
    → Stores rawContent on Course
    → Returns { chapters[], method, avgConfidence, warnings }
  → UploadModal shows split preview
    → User reviews/edits chapter titles
    → User confirms
  → POST /api/books/split/confirm { bookId, chapters[] }
    → Creates Lesson records for each chapter
    → Returns { created[], courseId }
  → UploadModal closes
  → Course list refreshes → auto-select new book
  → User can now browse chapters + use AI
```

### Cancel/Error Recovery
```
If user cancels during preview:
  → DELETE /api/books?id={bookId} (cleanup stub with no lessons)

If parse fails:
  → DELETE /api/books?id={bookId} (cleanup stub)
  → Show error toast
```

## Related Code Files

### Files to modify
- `src/components/UploadModal.tsx` — polish book flow, fix edge cases, connect metadata
- `src/app/page.tsx` — handle book course selection, pass contentType to panels
- `src/components/LessonList.tsx` — ensure book chapters render correctly with re-split option

### Files to verify (no changes expected)
- `src/app/api/books/upload/route.ts` — should work with Phase 1 changes
- `src/app/api/books/split/route.ts` — should work
- `src/app/api/books/split/confirm/route.ts` — should work
- `src/app/api/ai/summary/route.ts` — verify contentType forwarding
- `src/app/api/ai/explain/route.ts` — verify contentType forwarding
- `src/app/api/ai/chat/route.ts` — verify contentType forwarding
- `src/app/api/ai/quiz/route.ts` — verify contentType forwarding
- `src/app/api/ai/roadmap/route.ts` — verify contentType forwarding

### Tests to create
- **Integration tests (Vitest):** `src/app/api/books/__tests__/`
  - `upload.test.ts` — upload route: valid files, invalid extension, size limit, magic-byte rejection
  - `split.test.ts` — split route: EPUB chapters, PDF heuristics, no-chapter fallback
  - `split-confirm.test.ts` — confirm route: lessons created, cancel/cleanup
  - `metadata-preview.test.ts` — metadata extraction without DB side effects
- **E2E tests (Playwright):** `e2e/` (extend `e2e/book-upload.spec.ts` as base)
  - Scenario 1: Upload PDF → split → confirm → verify lessons created in DB + visible in UI
  - Scenario 2: Upload EPUB → verify metadata auto-fill in form → confirm
  - Scenario 3: Upload DOCX → verify chapter list preview → cancel → verify stub deleted (cleanup)
  - Scenario 4: Navigate to book lesson → verify AI panel shows book-specific prompts ("chương", book context)

## Implementation Steps

### Step 1: Verify existing API routes work with EPUB
Manually test each route with `.epub` files. Fix any issues.

### Step 2: Polish UploadModal book flow
- After file selection: show auto-extracted metadata (from Phase 2) in form
- During split analysis: show progress indicator (Loader2 animation)
- Split preview: editable chapter titles, word count per chapter, warnings display
- Confirm button: clear loading state, handle errors
- Cancel: cleanup book stub via DELETE /api/books

### Step 3: Connect split preview to confirmation
- Map preview chapters to ConfirmRequestSchema format
- Send to `/api/books/split/confirm`
- On success: close modal, trigger course refresh, auto-select book

### Step 4: Verify AI features work on book chapters
- Open a book chapter → click Summary → verify book-specific prompt used
- Open a book chapter → click Explain → verify no ASR rules
- Open a book chapter → click Chat → verify book context
- Open a book → click Roadmap → verify "Kế hoạch đọc" format
- Open a book chapter → click Practice → verify book-specific quiz/flashcard/exercise

### Step 5: Test re-split flow
- Upload book → split → confirm → re-split (delete lessons → re-analyze)
- Verify LessonList "Chia lại chương" button works
- Verify `/api/books/split/lessons` DELETE endpoint works

### Step 6: Write tests (split by type)

**Integration tests (Vitest):**
- Upload route: valid PDF/EPUB/DOCX, invalid extension, >50MB rejection, magic-byte mismatch
- Split route: EPUB chapter detection, PDF heuristic fallback, no-chapter single-lesson fallback
- Confirm route: lessons created correctly, cancel cleanup deletes stub
- metadata-preview route: returns metadata without creating DB records

**E2E tests (Playwright — extend `e2e/book-upload.spec.ts`):**
- Scenario 1: Upload PDF → split → confirm → verify N lessons visible in chapter list
- Scenario 2: Upload EPUB → verify form pre-filled with extracted metadata → confirm
- Scenario 3: Upload DOCX → review chapter preview → click Cancel → verify book stub is deleted
- Scenario 4: Open book chapter → open AI panel → verify "chương" labels, book-specific prompt hints visible

### Step 7: Docker build verification
- Run `docker compose up -d --build udemy-app`
- Upload a real PDF book through the UI
- Verify chapter splitting works
- Verify AI features work on chapters

## Todo List
- [x] Test API routes with EPUB files (upload, split, confirm)
- [x] Polish UploadModal book upload flow
- [x] Connect split preview → confirmation → course refresh
- [x] Verify all 6 AI features work on book chapters
- [x] Test re-split flow end-to-end
- [x] Write Vitest integration tests (upload, split, confirm, metadata-preview routes)
- [x] Write Playwright E2E tests (4 scenarios in `e2e/book-upload.spec.ts`)
- [x] Docker build + manual smoke test
- [x] Run quality gate

## Success Criteria
- [x] User can upload PDF/EPUB/DOCX/TXT/MD → get chapters → use AI (complete flow)
- [x] Cancel during any step cleans up properly
- [x] Re-split works without data loss
- [x] AI Summary/Explain/Chat/Quiz/Flashcard/Exercise/Roadmap all work on book chapters
- [x] Dashboard shows book courses in Continue Learning widget
- [x] All tests pass, build succeeds, Docker works

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| State management bugs in multi-step flow | Medium | Medium | Test each transition; add error boundaries |
| AI prompts produce poor results for books | Low | Medium | Book prompts already tested; manual QA |
| Large PDF causes timeout in Docker | Medium | Medium | Test with 50MB PDF; add timeout handling |
| Race condition: cancel during split | Low | Medium | Disable cancel during API calls; cleanup in finally block |

## Security Considerations
- Validate all user input with Zod schemas (already done in routes)
- Ensure userId scoping on all book operations (withAuth middleware)
- No arbitrary code execution from uploaded files
- Content size limits enforced (50MB)
