# Bug Report: Transcript Edits Lost on Course Switch

**Date:** 2026-04-01  
**Bug:** Transcript edit lost when user switches courses then returns

---

## How Transcript Editing Works

- **Component:** `src/components/TranscriptPanel.tsx`
- **State:** Local `draft` (string) + `editing` (bool) + `isDirty` (computed)
- **Save mechanism:** Explicit "Lưu" button only — no auto-save, no blur-save, no debounced save
- **API:** `PUT /api/lessons/[id]/transcript` → Prisma update → returns updated lesson
- **After save:** `page.tsx` updates both `selectedLesson` and `selectedCourse.lessons[n]` in state

---

## What Happens on Course Switch

**Lesson switch (within same course):**  
`handleSelectLesson` → checks `transcriptDirty` → if dirty, shows `AlertDialog` warning → user must confirm to proceed (i.e. **loss is warned**).

**Course switch (sidebar `CourseList` → `onSelect`):**  
```
setSelectedCourse(c);
setSelectedLesson(null);   // ← immediately nulls out lesson
setShowCollection(false);
// NO dirty check, NO warning
```
`TranscriptPanel` unmounts (because `selectedLesson` becomes `null`).  
All unsaved `draft` state is destroyed silently.

---

## Root Cause

**`page.tsx` line 701–704** — the `CourseList.onSelect` handler switches course with no dirty-state guard:

```ts
onSelect={(c) => {
  setSelectedCourse(c);
  setSelectedLesson(null);   // unmounts TranscriptPanel immediately
  setShowCollection(false);
}}
```

The `transcriptDirty` / `showLessonWarning` guard that exists for **lesson** switches (`handleSelectLesson`, line 494) is **never invoked** for **course** switches. There is also no `useEffect` cleanup in `TranscriptPanel` that auto-saves on unmount.

---

## Files & Lines to Fix

| File | Lines | Issue |
|------|-------|-------|
| `src/app/page.tsx` | 701–704 | `CourseList.onSelect` has no `transcriptDirty` check |
| `src/components/TranscriptPanel.tsx` | — | No save-on-unmount (`useEffect` cleanup) as backup |

**Primary fix location:** `page.tsx` `CourseList.onSelect` callback — add the same `transcriptDirty` guard used in `handleSelectLesson`, storing the pending course switch and showing a confirmation dialog before proceeding.
