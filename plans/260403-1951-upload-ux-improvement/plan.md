# Upload UX Improvement — Implementation Plan

## Spec
- `docs/specs/upload-ux-improvement.md`

## Summary
Clearly separate "Upload files" (multi-file transcripts) from "Upload sách" (single book) in the UI. Rename buttons, add descriptions/tooltips, pass initial mode to modal so each sidebar button opens the correct tab directly.

**No API or database changes.** Pure UI/UX.

## Implementation Summary

### Phase 1 ✅ Completed
- ✅ Added `initialMode` prop to UploadModal with useEffect sync
- ✅ Wired `uploadMode` state in page.tsx with differentiated callbacks
- ✅ Renamed AddCoursePanel buttons: "Upload files" & "Upload sách" with tooltips
- ✅ Updated UploadModal tab labels + added mode descriptions
- ✅ Updated empty-state button labels in page.tsx

### Phase 2 ✅ Completed
- ✅ Enhanced drag-drop rejection toast to mention "Upload sách" alternative
- ✅ Added server-side PDF/EPUB guard in courses/upload route (400 error)
- ✅ Added 2 new tests for PDF/EPUB rejection

**Build & Tests:**
- ✅ 0 TypeScript errors
- ✅ 912/912 tests passing
- ✅ All spec acceptance criteria met

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [UI Labels, Descriptions & Mode Routing](./phase-01-ui-labels-and-mode-routing.md) | ✅ COMPLETE |
| 2 | [Validation & Error Messages](./phase-02-validation-and-error-messages.md) | ✅ COMPLETE |

## Key Decisions
- **Keep single UploadModal** (Option A from spec) — already works, just needs initialMode prop + label updates
- **Don't refactor 1114-line UploadModal** — out of scope per YAGNI; note for future tech debt
- **Tooltips via `title` attribute** on sidebar buttons — KISS, no tooltip library needed

## Risk
- Low risk — cosmetic changes only, no data flow changes
- UploadModal size (1114 lines) makes edits harder but changes are localized to labels/text
