# Code Review: Upload UX Improvement

**Reviewer:** code-reviewer | **Date:** 2026-04-03 | **Verdict:** APPROVE with minor suggestions

---

## Summary

Clean, well-scoped UI/UX improvement that separates transcript upload and book upload flows. Changes are consistent across all 5 files, type-safe, and well-tested.

---

## File-by-File Review

### 1. `src/components/UploadModal.tsx` — PASS

**initialMode / useEffect pattern (lines 96-101):**
- `initialMode?: UploadMode` — correct optional typing
- `useEffect` syncs `mode` when `open` transitions to `true` AND `initialMode` is set — correct
- Guard `if (open && initialMode)` avoids overwriting mode when `initialMode` is undefined — good

**Concern (minor):** The `useEffect` depends on `[open, initialMode]` but won't reset mode when the modal is reopened *without* `initialMode`. This is fine since `page.tsx` always sets `uploadMode` before opening. No action needed.

**Tab label rename:** "Transcript" → "Upload files", "Sách / Giáo trình" → "Upload sách" — consistent with button labels in AddCoursePanel.

**Description text (lines 669-671, 789-791):** Good — gives users clear context about what each mode does.

**Drag-drop rejection toast (line 269):** Enhanced message mentioning "Upload sách" for PDF/EPUB — helpful guidance.

### 2. `src/components/AddCoursePanel.tsx` — PASS

- Button labels renamed consistently: "Upload files", "Upload sách"
- `title` tooltip attributes (lines 68-69, 79-80) provide hover hints — good discoverability
- `onOpenUploadBook` callback already existed in interface — no breaking change

### 3. `src/app/page.tsx` — PASS

- `uploadMode` state with correct type `"transcript" | "book"` (line 96)
- `onOpenUpload` and `onOpenUploadBook` callbacks correctly set mode before opening modal (lines 739-740)
- `initialMode={uploadMode}` passed to UploadModal (line 974) — correct prop threading
- Empty-state buttons (lines 924, 935) set `uploadMode("transcript")` before showing modal — consistent

**No regressions:** Escape key handler (line 712), close callback, and `onUploadComplete` remain unchanged.

### 4. `src/app/api/courses/upload/route.ts` — PASS

- Server-side PDF/EPUB guard (lines 29-35) is defense-in-depth — correct placement after Zod validation but before DB operations
- `bookExts` check uses `f.name.toLowerCase().endsWith(ext)` — handles case insensitivity
- Returns 400 with helpful Vietnamese error message pointing to "Upload sách" — good UX
- Early return prevents processing — efficient

### 5. `src/app/api/courses/__tests__/upload.test.ts` — PASS

- Two new tests (lines 285-309) cover PDF and EPUB rejection
- Both verify status 400 and error message contains "Upload sách"
- Well-structured, consistent with existing test patterns

---

## Checklist

| Check | Result |
|---|---|
| TypeScript type safety | PASS — `UploadMode` type, optional `initialMode?`, correct state typing |
| No `as any` / `@ts-ignore` | PASS |
| Error handling | PASS — server guard + client toast + abort handling all intact |
| Regressions | PASS — no existing functionality altered, only labels and new guard |
| UI/UX clarity | PASS — labels are shorter, descriptions explain each mode |
| Test coverage | PASS — server guard has tests, client changes are UI-only |
| Zod validation | PASS — existing validation untouched, new guard is additive |

---

## Issues Found

### None (blocking)

### Minor Suggestions (non-blocking)

1. **`.txt` overlap:** Both `TRANSCRIPT_EXTENSIONS` and `BOOK_EXTENSIONS` include `.txt`. If a user drags a `.txt` into the wrong mode, it silently processes. Consider adding a UI hint in the description text clarifying `.txt` behavior differs per mode (transcript = 1 lesson vs book = chapter splitting). Not a bug — just UX clarity.

2. **Server guard coverage:** The guard only checks `f.name` extension. If someone renames a PDF to `.txt`, it bypasses. This is acceptable — defense-in-depth, not primary validation. The binary content would likely fail transcript parsing gracefully.

---

**Status:** DONE
**Summary:** All 5 files reviewed. Clean implementation with correct initialMode/useEffect pattern, consistent label renaming, proper server-side guard with tests. No regressions, no type issues. Approved.
**Concerns/Blockers:** None blocking. Two minor UX suggestions noted above.
