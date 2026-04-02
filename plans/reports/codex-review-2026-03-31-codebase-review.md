# Codebase Review Report — Udemy Learner App

**Reviewer:** Codex CLI (high effort) + Claude Code synthesis  
**Date:** 2026-03-31  
**Scope:** Full codebase — 79 source files, ~17,000 lines  
**Chunks reviewed:** 8 (lib-core, AI routes, SRS/progress/notes, lesson/reorder, books/analytics/export, udemy/upload/misc, large components, medium+small components+hooks)  
**Verdicts:** All 8 chunks → **REVISE**

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 27 |
| Medium | 34 |
| Low | 0 |
| **Total** | **63** |

The codebase has **two critical bugs** (stale-stream race in AI chat, regex DoS in transcript parser), **27 high-severity issues** spanning race conditions, SSRF, data corruption, and state management, and **34 medium-severity issues** across error handling, edge cases, and security hardening. No chunk passed review.

---

## Critical Issues (2)

### CRIT-1: Chat race guard is a no-op — stale streams write into wrong lesson
- **File:** `src/components/AIAssistantPanel.tsx` → `handleChat`
- **Problem:** The guard `if (currentLessonId !== lesson.id)` compares two values from the same render closure, so it never detects lesson switches. Streaming chat responses continue writing into whatever lesson is currently displayed.
- **Impact:** Chat history corruption — AI responses for lesson A appear in lesson B.
- **Fix:** Track current lesson with a ref updated on lesson change, or abort the active chat request when `lesson.id` changes.

### CRIT-2: Regex DoS in SRT/VTT transcript parsers
- **File:** `src/lib/parse-transcript.ts` → `parseSrt`, `parseVtt`
- **Problem:** Timestamp regex uses nested quantifiers that backtrack exponentially on malformed input.
- **Impact:** A single malformed transcript upload can hang the server for minutes.
- **Fix:** Rewrite regex to avoid catastrophic backtracking, or add input length limits.

---

## High-Severity Issues (27)

### Race Conditions & Data Corruption (12)

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| H-1 | AI lesson-scoped data loading has broken cleanup | `AIAssistantPanel.tsx` | `return () => controller.abort()` is inside the async function, not the effect — React never calls it. Old requests overwrite new lesson state. |
| H-2 | External explain applies stale results | `AIAssistantPanel.tsx` | Highlight-to-explain fetch has no abort signal and ignores dependency changes. Can write explanation for wrong lesson. |
| H-3 | Shared AbortController across unrelated AI actions | `AIAssistantPanel.tsx` | Summary, explain, roadmap, practice all overwrite the same `abortControllerRef`. Canceling one operation affects the wrong request. |
| H-4 | SRS review race — concurrent submissions lose data | `api/srs/review/route.ts` | Read-increment-write on `box`/`nextReviewDate` outside transaction. Concurrent reviews can overwrite each other. |
| H-5 | Course progress recomputation race | `api/courses/[id]/progress/route.ts` | Stale aggregate can overwrite a more recent one when concurrent progress updates trigger recomputation. |
| H-6 | Book upload lesson order race | `api/books/upload/route.ts` | `existingCount` computed outside transaction. Concurrent uploads assign overlapping `order` values. |
| H-7 | Split confirm check-then-create race | `api/books/split/confirm/route.ts` | Two concurrent confirms both see `existingCount === 0` and both insert lessons, duplicating chapters. |
| H-8 | Lesson reorder trusts arbitrary IDs | `api/lessons/[id]/reorder/route.ts` | No ownership verification — caller can inject lesson IDs from other courses, corrupting order across courses. |
| H-9 | Notes retry can overwrite wrong lesson | `NotesEditor.tsx` | `refetchNotes` has no cancellation. Navigate to lesson B while A's retry is in-flight → A's response overwrites B's editor. |
| H-10 | Settings model fetch patches wrong profile | `SettingsModal.tsx` | Async model fetch resolves and writes to `selectedId` instead of the profile that initiated the request. |
| H-11 | Study time double-counting | `page.tsx` | Time flushed once before unsaved-warning dialog, then flushed again on confirm using same timer origin. |
| H-12 | Remote transcript downloads inside Prisma transaction | `api/udemy/import/route.ts` | SQLite write lock held during network I/O for every lecture caption. Blocks all concurrent writes. |

### Security (7)

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| H-13 | SSRF via user-controlled `baseUrl` | `api/ai/*/route.ts` | `validateBaseUrl` only blocks private IPs but allows DNS rebinding, non-HTTP schemes after redirect, and cloud metadata endpoints. |
| H-14 | API keys stored in localStorage | `SettingsModal.tsx` | `apiKey` and `udemyCookie` persisted in plaintext. Any XSS or extension can exfiltrate. |
| H-15 | Frontend forwards arbitrary baseUrl/secrets to backend | `AIAssistantPanel.tsx`, `page.tsx` | User-controlled `baseUrl`, `apiKey`, and Udemy cookie sent in request bodies, amplifying SSRF. |
| H-16 | No auth/ownership on any API route | All `api/` routes | Every route trusts caller-supplied IDs. Acceptable only in strict single-user deployment. |
| H-17 | Udemy import trusts caption URLs without allowlisting | `api/udemy/import/route.ts` | `caption.url` fetched server-side without origin validation. Third-party response can steer server to arbitrary hosts. |
| H-18 | AI cache key includes full API key | `api/ai/*/route.ts` | Sensitive material in cache keys increases exposure surface. |
| H-19 | Book endpoints accept non-book courses | `api/books/upload/route.ts`, `split/route.ts` | No `contentType === "book"` check. Any course ID can have book-specific lessons injected. |

### Data Loss & Correctness (8)

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| H-20 | Udemy re-import silently replaces full course with partial data | `api/udemy/import/route.ts` | Pagination failure → still deletes existing lessons → re-imports only partial set. |
| H-21 | Navigation paths bypass central guard logic | `page.tsx` | Sidebar/collection navigation skips unsaved-warning and time-tracking logic. |
| H-22 | Transcript save treats non-OK as success | `page.tsx`, `TranscriptPanel.tsx` | No `res.ok` check. Child exits edit mode even on failure. Can also restore stale lesson selection. |
| H-23 | Quiz state not reset on new quiz load | `QuizPlayer.tsx` | `selectedAnswers`, `showAllAnswers`, `score` persist from previous quiz. |
| H-24 | True/False parsing leaks correct answer | `QuizPlayer.tsx` | Answer marker `Đáp án: Đúng/Sai` appended to question text, visible before answering. |
| H-25 | Heatmap drops most recent days | `StudyHeatmap.tsx` | Monday-alignment shift not compensated — rightmost column doesn't reach today. |
| H-26 | SRS init check-then-create race | `api/srs/init/route.ts` | Concurrent inits for same lesson can create duplicate flashcard sets. |
| H-27 | Flashcard review `where` clause misses lesson scope | `api/srs/review/route.ts` | Updates by `flashcardId` alone. If IDs collide across lessons, wrong card gets updated. |

---

## Medium-Severity Issues (34)

### Error Handling (10)
| # | Issue | File |
|---|-------|------|
| M-1 | Upload can leave orphan course rows on parse failure | `api/books/upload/route.ts` |
| M-2 | Manual upload leaves empty orphan courses | `api/courses/upload/route.ts` |
| M-3 | Malformed request JSON reported as server corruption | `api/export/*/route.ts` |
| M-4 | AI model discovery can hang indefinitely | `api/ai/models/route.ts` |
| M-5 | Udemy courses route collapses all failures into "bad token" | `api/udemy/courses/route.ts` |
| M-6 | Collection fetch failures shown as "no data" | `CollectionPanel.tsx` |
| M-7 | Re-split dialog closes immediately, swallows failures | `LessonList.tsx` |
| M-8 | AI streaming doesn't surface structured errors | `lib/ai/stream.ts` |
| M-9 | Profile creation race returns generic 500 | `api/courses/[id]/profile/route.ts` |
| M-10 | Book stub deletion TOCTOU | `api/books/route.ts` |

### Race Conditions & State (8)
| # | Issue | File |
|---|-------|------|
| M-11 | Cache miss race in AI routes | `api/ai/*/route.ts` |
| M-12 | Unsaved chat warning stuck after persistence | `AIAssistantPanel.tsx` |
| M-13 | Upload modal close doesn't cancel transcript uploads | `UploadModal.tsx` |
| M-14 | Aborted course-detail requests clear loading for next request | `AnalyticsCourseDetail.tsx` |
| M-15 | Rename can fire twice (Enter + blur) | `CourseList.tsx` |
| M-16 | Back-to-back URL state updates clobber each other | `useUrlState.ts` |
| M-17 | Search results can reappear after query cleared | `NotesEditor.tsx` |
| M-18 | Stale lesson options bleed across courses | `LearnerProfileModal.tsx` |

### Security & Input Validation (8)
| # | Issue | File |
|---|-------|------|
| M-19 | CSV exports vulnerable to formula injection | `api/export/*/route.ts` |
| M-20 | Upload parser trusts `file.type` as filename extension | `api/courses/upload/route.ts` |
| M-21 | No Zod/schema validation on most API request bodies | Multiple routes |
| M-22 | `split-ai.ts` injects unsanitized titles into AI prompt | `lib/split-ai.ts` |
| M-23 | Flashcard review accepts arbitrary `quality` values | `api/srs/review/route.ts` |
| M-24 | `meta/cmd` shortcuts parsed but never matched | `useKeyboardShortcuts.ts` |
| M-25 | Global flashcard shortcuts hijack form inputs | `FlashcardDeck.tsx` |
| M-26 | OCR `maxPages` can be set to 0 or negative | `lib/ocr.ts` |

### Performance & Edge Cases (8)
| # | Issue | File |
|---|-------|------|
| M-27 | Analytics overview unbounded in-memory read | `api/analytics/overview/route.ts` |
| M-28 | Streak/frequency bucketing is UTC-based | `api/analytics/overview/route.ts` |
| M-29 | Udemy course listing truncates at 100 | `api/udemy/courses/route.ts` |
| M-30 | `splitChaptersByAI` retry logic reuses same prompt on failure | `lib/split-ai.ts` |
| M-31 | Pattern-based split has O(n²) behavior on large inputs | `lib/split-patterns.ts` |
| M-32 | SRS interval calculation can produce Infinity/NaN | `lib/srs.ts` |
| M-33 | Notes search debounce timer not cleaned on unmount | `NotesEditor.tsx` |
| M-34 | AI explain/summary responses not sanitized before render | `AIAssistantPanel.tsx` |

---

## Architecture Observations

1. **No authentication layer.** Every API route trusts caller-supplied IDs. This is documented as intentional (single-user PRD), but creates a hard migration path if multi-user is ever needed.

2. **Pervasive check-then-act pattern.** At least 8 routes follow read → check → write without transactions or constraints, causing races under concurrent requests.

3. **No request cancellation strategy.** Frontend components lack consistent AbortController usage. Lesson switches during in-flight AI requests are the primary source of state corruption bugs.

4. **Secrets in the client.** API keys and cookies flow through localStorage → request body → server fetch. No server-side secret management.

5. **Missing schema validation.** Most API routes cast `await req.json()` directly without Zod or similar validation, making them fragile to malformed input.

---

## Recommended Fix Priority

### P0 — Fix immediately (data corruption / security)
1. CRIT-1: Fix chat race guard (use ref, not closure)
2. CRIT-2: Fix regex DoS in parsers
3. H-1 through H-3: Fix AbortController lifecycle in AIAssistantPanel
4. H-20: Abort Udemy re-import on pagination failure
5. H-13: Strengthen SSRF protection

### P1 — Fix before next release
6. H-4 through H-7: Transaction races in SRS, progress, upload, split
7. H-14, H-15: Move secrets to server-side storage
8. H-21, H-22: Unify navigation guard, fix transcript save
9. H-24, H-25: Quiz answer leak, heatmap date math
10. M-19: CSV formula injection

### P2 — Fix in next sprint
11. All remaining medium issues
12. Add Zod validation to API routes
13. Implement consistent request cancellation pattern

---

## Review Metadata

| Chunk | Files | Lines | Time (s) | Issues | Verdict |
|-------|-------|-------|-----------|--------|---------|
| 1: lib-core | 15 | 2,534 | ~300 | 10 | REVISE |
| 2: AI routes | 5 | 681 | ~350 | 10 | REVISE |
| 3: SRS/progress/notes | 6 | 540 | ~250 | 8 | REVISE |
| 4: lesson/reorder | 3 | 350 | ~300 | 7 | REVISE |
| 5: books/analytics/export | 9 | 1,100 | ~466 | 10 | REVISE |
| 6: udemy/upload/misc | 9 | 813 | ~259 | 9 | REVISE |
| 7: large components | 5 | 4,529 | ~1,067 | 11 | REVISE |
| 8A: medium components | 5 | 2,018 | ~242 | 8 | REVISE |
| 8B: small components+hooks | 19 | 2,607 | ~231 | 6 | REVISE |
| **Total** | **76** | **~15,172** | **~3,465** | **~79 raw → 63 deduped** | **REVISE** |

*Note: 79 raw issues were deduplicated to 63 unique findings (some cross-chunk overlap on auth and race patterns).*
