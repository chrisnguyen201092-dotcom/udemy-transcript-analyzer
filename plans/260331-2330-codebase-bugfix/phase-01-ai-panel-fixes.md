# Phase 1: AI Panel Fixes

**Issues:** CRIT-1, H-2, H-3
**Files:** `src/components/AIAssistantPanel.tsx`
**Priority:** Critical + High

## Issues

- **CRIT-1:** `handleChat` streaming writes not guarded — if user switches lesson mid-stream, `setChatMessages` writes to wrong lesson's state. The `currentLessonId !== lesson.id` check only guards DB persistence, not the streaming loop.
- **H-2:** `handleExplain` (external explain from highlight) has no abort signal — can't cancel, leaks fetch.
- **H-3:** Single shared `abortControllerRef` across all AI actions — starting summary while explain is loading doesn't cancel the explain stream; old controller is overwritten.

## Implementation Steps

### CRIT-1: Guard streaming writes with lessonId ref
1. Add `const lessonIdRef = useRef(lesson.id)` and keep in sync via effect
2. In `handleChat` streaming loop (line ~632), before `setChatMessages`, check `if (lessonIdRef.current !== currentLessonId) { reader.cancel(); break; }`
3. Same guard before DB persistence calls (already partially exists at line 655)

### H-2: Add abort signal to external explain
1. In the `externalExplainText` useEffect (line ~349), create `AbortController` and pass `signal` to fetch
2. Pass signal to `readStreamOrJson` call (4th parameter)
3. Return cleanup: `return () => controller.abort()`

### H-3: Per-action abort controllers
1. Replace single `abortControllerRef` with a `Map<string, AbortController>` or individual refs:
   - `summaryAbortRef`, `explainAbortRef`, `chatAbortRef`, `roadmapAbortRef`, `practiceAbortRef`
2. Update `cancelGeneration()` to abort ALL active controllers
3. Each handler creates and stores its own controller in the corresponding ref
4. Each handler clears only its own ref on completion
5. Update `startGenTimer`/`stopGenTimer` — timer still shared (only 1 UI indicator), but cancellation is per-action

## Success Criteria
- [x] Switching lessons mid-chat-stream doesn't corrupt new lesson's chat
- [x] External explain requests are cancellable (component unmount aborts)
- [x] Starting summary while explain loads cancels the explain (or both run independently)
- [x] No leaked fetch requests on component unmount

**Status:** ✅ COMPLETE
