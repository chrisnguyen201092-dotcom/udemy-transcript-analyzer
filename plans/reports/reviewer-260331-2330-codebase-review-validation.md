# Codebase Review Validation Report

## Critical Issues

| # | Verdict | Justification |
|---|---------|---------------|
| CRIT-1 | PARTIALLY VALID | `handleChat` (L598) captures `const currentLessonId = lesson.id` and checks `if (currentLessonId !== lesson.id)` at L655. Both values come from the same `lesson` prop closure — **however**, React can re-render mid-await if parent passes new `lesson` prop, so `lesson.id` at L655 could differ from the captured value. The guard works for re-renders but NOT for in-flight stream reads (L626-637) which still write to state before the check. The guard only protects the DB persistence, not the streaming UI updates. |
| CRIT-2 | INVALID | `parseSrt` regex is `/^\d{2}:\d{2}:\d{2},\d{3}\s*-->/` and `parseVtt` regex is `/^\d{2}:\d{2}/`. These are simple anchored patterns with no nested quantifiers, no unbounded repetition, no backtracking risk. The `<[^>]+>` tag strip is also safe. |

## High — Race Conditions

| # | Verdict | Justification |
|---|---------|---------------|
| H-1 | INVALID | `handleChat` (L593-677) is an async event handler, not a useEffect. There is no cleanup function returned to an effect. The `return` at L656 exits the handler early, which is correct behavior. |
| H-2 | VALID | The highlight-to-explain effect (L349-376) calls `fetch("/api/ai/explain")` with no `AbortSignal`. The effect has no cleanup/abort on unmount or dependency change. |
| H-3 | PARTIALLY VALID | `abortControllerRef` (L165) is shared across handleSummary (L439), handleExplain (L471), handleRoadmap (L503). Each creates its own `new AbortController()` and assigns to the same ref. If user triggers summary then quickly triggers explain, the old summary controller is orphaned (never aborted). The shared ref means `cancelGeneration()` only aborts the most recent action. Not a data-corruption bug but a UX issue — previous stream isn't cancelled. |
| H-4 | PARTIALLY VALID | SRS review route (L31-60) does `findFirst` then `update` — not inside a `$transaction`. However, Prisma `update` with `where: { id }` is atomic at DB level. The `totalReviews: review.totalReviews + 1` reads stale value, but for a single-user local app the practical risk is very low. Should use `increment` for correctness. |
| H-5 | INVALID | `courses/[id]/progress/route.ts` GET handler is read-only — it fetches and returns progress data. No write race exists here. The PATCH handler in `lessons/[id]/progress/route.ts` uses `{ increment: delta }` for timeSpentMs which is atomic. |
| H-6 | VALID | `books/upload/route.ts` L86: `existingCount` is computed outside the transaction at L162-175. Two concurrent uploads to the same course could both read count=5, both start ordering at 6, creating duplicate order values. |
| H-7 | VALID | `books/split/confirm/route.ts` L38-46: `existingCount` check is outside the transaction (L58-60). Two concurrent confirms could both see `existingCount===0`, pass the guard, and both create lessons. |
| H-8 | VALID | `courses/[id]/lessons/reorder/route.ts` L15-31: Accepts arbitrary `lessonIds` array, verifies course exists, but does NOT verify each lessonId belongs to the course. Could update lessons from other courses. |
| H-9 | PARTIALLY VALID | `NotesEditor.tsx` `refetchNotes` (L50-83) is a plain function with no cancellation token. However, the `useEffect` version at L85-127 does use `cancelled` flag. The `refetchNotes` function (used by Retry button) lacks cancellation, but this is a minor issue since it's user-initiated and single-fire. |
| H-10 | INVALID | `SettingsModal.tsx` `fetchModels` (L218-245) is an async function that calls `updateProfile` which updates `draft` state scoped to `selectedId`. Profile switching resets state via `handleProfileSwitch`. The modal is local-state-only; no wrong-profile patching occurs because `updateProfile` always targets `selectedId` (closure at call time) and the `useCallback` depends on `[selectedId]`. |
| H-11 | PARTIALLY VALID | `page.tsx` L396-412 (pagehide beacon) and L416-424 (lesson switch) both fire time tracking for the same lesson. If user switches lesson, `handleSelectLesson` fires a PATCH (L419-423), then `lessonStartTimeRef` resets (L433). The pagehide handler reads from `selectedLessonRef` which updates to the new lesson. Double-counting only occurs if pagehide fires during the same tick as lesson switch — unlikely but theoretically possible. |
| H-12 | VALID | `udemy/import/route.ts` L102-141: `fetchTranscript` (network I/O to remote caption URLs) is called inside `prisma.$transaction`. This holds the transaction open for the duration of all remote downloads, which could timeout or fail mid-transaction. |

## High — Security

| # | Verdict | Justification |
|---|---------|---------------|
| H-13 | PARTIALLY VALID | `validateBaseUrl.ts` checks against an allowlist + regex pattern `^https://[a-zA-Z0-9.-]+(:[0-9]+)?(/[\w./-]*)?\/?$`. It requires HTTPS (blocks `http://` private IPs), but doesn't block DNS rebinding or internal hostnames like `https://internal-api.corp:8080`. For a single-user local app, risk is low. |
| H-14 | VALID | `SettingsModal.tsx` L64: `localStorage.getItem("udemy_ai_profiles")` stores full profile data including `apiKey`. API keys are stored in plaintext in localStorage. |
| H-15 | VALID | `AIAssistantPanel.tsx` `apiBody()` (L380-388) forwards `settings.apiKey`, `settings.baseUrl` from frontend to backend. The frontend sends user-controlled baseUrl/apiKey in every AI request body. |
| H-16 | VALID | All API routes examined have no auth middleware, no session checks, no ownership verification. This is by design for a single-user local app but is a concern if deployed publicly. |
| H-17 | PARTIALLY VALID | `udemy/import/route.ts` L40-59: `fetchTranscript` fetches arbitrary caption URLs from Udemy API response. `validateUdemyNextUrl` only validates pagination `next` URLs, not caption URLs. However, caption URLs come from Udemy's API response (not directly user-controlled), so exploitation requires compromising Udemy's API. |
| H-18 | INVALID | No `cacheKey` or cache key including API key found in any AI route. Server-side caching uses Prisma DB fields (`lesson.summary`, `lesson.explanation`) keyed by lessonId, not API key. |
| H-19 | PARTIALLY VALID | `books/upload/route.ts` and `books/split/route.ts` don't verify `contentType === "book"` on the target course. However, the upload route creates its own course with `contentType: "book"` (L75), and `split/route.ts` only requires `course.findUnique`. Mixing content types is possible if user provides a courseId pointing to a non-book course. |

## High — Data Loss & Correctness

| # | Verdict | Justification |
|---|---------|---------------|
| H-20 | VALID | `udemy/import/route.ts` L108-111: On re-import, `deleteMany` removes ALL existing lessons before re-creating. If pagination fails mid-way (L92 `if (!r.ok) break`), only partial lectures are collected, but all old lessons are already deleted inside the transaction. The transaction is atomic, so if it commits, old data is lost and replaced with partial data. |
| H-21 | PARTIALLY VALID | `page.tsx` L552-560: `navigateLesson` calls `handleSelectLesson` which does check for unsaved warnings (L427-429). Keyboard shortcuts (L563-571) also go through `handleSelectLesson`. The guard logic is centralized. However, if user navigates via browser back/forward, the guard is bypassed. |
| H-22 | PARTIALLY VALID | `page.tsx` L463-484: `handleSaveTranscript` does `await fetch(...)` but does NOT check `res.ok`. It always proceeds to update state and shows "Đã lưu transcript" toast. A non-OK response would silently appear as success. |
| H-23 | INVALID | `QuizPlayer.tsx` L37-42: `useEffect` with `[markdown]` dependency resets `selected`, `answers`, `currentQuestion`, `showResult` when markdown changes. State IS reset. However, `selectedAnswers`, `showAllAnswers`, and `score` are not reset — this is a minor omission but the claim of "state not reset" is mostly wrong. |
| H-24 | PARTIALLY VALID | `QuizPlayer.tsx` L217: Renders `Đáp án: {answer.correct}` directly in the DOM. For True/False questions, the correct answer ("Đúng"/"Sai") is shown after answering (L166-175), which is intentional reveal behavior. The answer data is in the markdown source (client-side), so a tech-savvy user could inspect it, but this is inherent to client-side quiz rendering. |
| H-25 | INVALID | `StudyHeatmap.tsx` L34-54: Builds 364 cells (52×7), goes back `totalDays-1` = 363 days, adjusts to nearest Monday, then iterates forward. The grid correctly covers up to today. No days are dropped — the mondayOffset adjustment may shift start but the 364-cell grid fills correctly through current date. |
| H-26 | INVALID | `srs/init/route.ts` L51-78: The check-then-create is inside a `prisma.$transaction`. Existing indices are checked and new cards created atomically within the same transaction. Race is properly handled. |
| H-27 | PARTIALLY VALID | `srs/review/route.ts` L31-33: `findFirst({ where: { lessonId: id, cardIndex } })` — the `lessonId` is from the URL param `id`, which is the lesson ID. This is correct scoping. However, there's no verification that the lesson belongs to a specific course/user, so any lesson's cards can be reviewed if you know the lesson ID. This is an auth issue (H-16), not a where-clause scoping issue. |

## Summary

- **Valid: 8** (H-2, H-6, H-7, H-8, H-12, H-14, H-15, H-16)
- **Partially Valid: 12** (CRIT-1, H-3, H-4, H-9, H-11, H-13, H-17, H-19, H-20, H-21, H-22, H-24, H-27)
- **Invalid: 9** (CRIT-2, H-1, H-5, H-10, H-18, H-23, H-25, H-26)

### Key Takeaways

1. **No ReDoS risk** — transcript parsers use safe, anchored regexes
2. **Real race conditions** exist in books upload/split confirm (order count outside tx) and Udemy import (network I/O in tx)
3. **Security issues are real but contextual** — this is a single-user local app; no auth is by design
4. **The most impactful valid issue** is H-20 (re-import data loss on pagination failure) and H-12 (network calls inside transaction)
5. **Several claims overstated** — H-23 (quiz reset works), H-25 (heatmap is correct), H-26 (SRS init is properly transactional)
