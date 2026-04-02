# Phase 5: Frontend State Fixes

**Issues:** H-9, H-11, H-21, H-22, M-1, M-2, M-3, M-5, M-6, M-8, M-13, M-14, M-15, M-16, M-17
**Files:** `page.tsx`, `NotesEditor.tsx`, `CourseList.tsx`, `CollectionPanel.tsx`, `UploadModal.tsx`, `AnalyticsCourseDetail.tsx`, `useUrlState.ts`, `stream.ts`, `courses/upload/route.ts`, `books/upload/route.ts`
**Priority:** High + Medium

## Issues

### High
- **H-9:** `NotesEditor.tsx` — `refetchNotes` (user-initiated) has no cancellation; rapid clicks stack requests.
- **H-11:** `page.tsx` — study time double-counting possible if `pagehide` fires during lesson switch.
- **H-21:** `page.tsx` — browser back/forward bypasses unsaved-warning guard (`beforeunload` doesn't block `popstate`).
- **H-22:** `page.tsx` — `handleSaveTranscript` doesn't check `res.ok`.

### Medium
- **M-1:** `books/upload/route.ts` — orphan course created (line 72-83) if parse fails later. Course exists with no lessons.
- **M-2:** `courses/upload/route.ts` — similar orphan course if all lesson uploads fail.
- **M-3:** Export routes — malformed `req.json()` gets generic 500 instead of 400.
- **M-5:** `udemy/courses/route.ts` — error message always says "check access_token" even for network errors.
- **M-6:** `CollectionPanel.tsx` — error state and empty state are indistinguishable to user.
- **M-8:** `stream.ts` — streaming errors propagated as raw text, not structured.
- **M-13:** `UploadModal.tsx` — transcript upload not cancelled on modal close.
- **M-14:** `AnalyticsCourseDetail.tsx` — aborted request clears loading state but doesn't prevent stale state update.
- **M-15:** `CourseList.tsx` — rename fires twice: once on Enter keypress, once on blur handler.
- **M-16:** `useUrlState.ts` — rapid state updates may clobber each other (stale URL reads).
- **M-17:** `NotesEditor.tsx` — in-flight search can overwrite cleared results.

## Implementation Steps

### H-9: Add abort controller to NotesEditor refetch
1. Store `AbortController` ref in `NotesEditor.tsx`
2. On refetch: abort previous, create new controller, pass signal to fetch
3. On unmount: abort

### H-11: Guard study time against double-counting
1. In `page.tsx`, add a `lastTimeSavedRef` tracking the last saved timestamp
2. In `pagehide` handler, check if time was already saved for current lesson switch
3. Use a flag `isSwitchingLesson` to skip pagehide time save during active lesson switch

### H-21: Handle popstate for unsaved warning
1. In `page.tsx`, add `popstate` event listener
2. On popstate with unsaved changes, push current URL back and show confirm dialog
3. If user confirms leave, allow navigation; if cancel, stay

### H-22: Check res.ok in handleSaveTranscript
1. In `page.tsx` `handleSaveTranscript` (line ~513), add `if (!res.ok)` check after fetch
2. Show toast error on failure

### M-1 + M-2: Cleanup orphan courses on failure
1. In `books/upload/route.ts`: if parse fails (line 150-157) AND we created a new course (not existing courseId), delete the orphan course in the catch block
2. In `courses/upload/route.ts`: similar — if all lessons fail to upload, delete the created course
3. Both: wrap in try-catch to not mask the original error

### M-3: Handle malformed JSON in export routes
1. In both export routes, wrap `req.json()` in try-catch:
   ```ts
   let body; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
   ```

### M-5: Differentiate Udemy error messages
1. In `udemy/courses/route.ts`, check `res.status`:
   - 401/403 → "Token không hợp lệ hoặc hết hạn"
   - Network error → "Không thể kết nối Udemy API"
   - Other → "Udemy API lỗi: {status}"

### M-6: Distinguish error vs empty in CollectionPanel
1. Add separate `error` state alongside existing state
2. Show error banner on fetch failure vs "No items" message when data loads empty

### M-8: Structured error in stream.ts
1. In `createThinkFilteredStream`, on error, enqueue a JSON error marker before closing:
   ```ts
   controller.enqueue(encoder.encode("\n\n[STREAM_ERROR]" + (err instanceof Error ? err.message : "Unknown error")));
   ```
2. Client-side: detect `[STREAM_ERROR]` prefix in accumulated text, show as error toast

### M-13: Cancel upload on modal close
1. In `UploadModal.tsx`, store `AbortController` ref
2. On modal close/unmount, call `controller.abort()`
3. Pass `signal` to upload fetch calls

### M-14: Guard stale state in AnalyticsCourseDetail
1. In the fetch effect, check `if (controller.signal.aborted) return` before `setLoading(false)`
2. Use the existing abort controller pattern — ensure state updates are skipped after abort

### M-15: Prevent double rename in CourseList
1. In `CourseList.tsx`, add a `renamingRef` boolean flag
2. `onKeyDown` Enter handler: if `renamingRef.current` return; else set true, call rename, blur input
3. `onBlur` handler: if `renamingRef.current` return; else call rename
4. Reset `renamingRef` after rename completes

### M-16: Use functional URL updates in useUrlState
1. In `useUrlState.ts`, read current URL inside the update function (not from stale closure):
   ```ts
   const currentParams = new URLSearchParams(window.location.search);
   ```
2. This ensures rapid updates read latest URL state

### M-17: Cancel in-flight search in NotesEditor
1. Add search-specific `AbortController` ref
2. On new search: abort previous, create new
3. On search clear: abort and set results to empty

## Success Criteria
- [x] NotesEditor refetch is cancellable; rapid clicks don't stack
- [x] Study time not double-counted on lesson switch + pagehide
- [x] Browser back/forward shows unsaved warning
- [x] handleSaveTranscript reports errors
- [x] No orphan courses on upload failure
- [x] Export routes return 400 for malformed JSON
- [x] CourseList rename fires exactly once
- [x] useUrlState handles rapid updates correctly

**Status:** ✅ COMPLETE
