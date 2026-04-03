# Phase 1: UI Labels, Descriptions & Mode Routing

## Context
- Spec: `docs/specs/upload-ux-improvement.md`
- Current code uses generic labels and doesn't route sidebar buttons to the correct modal tab

## Priority: High | Status: ✅ COMPLETE

## Key Insights
- UploadModal already has `mode` state (`"transcript" | "book"`) and `switchMode()` — just needs an `initialMode` prop
- AddCoursePanel already has separate `onOpenUpload` / `onOpenUploadBook` callbacks — just not differentiated in page.tsx
- Both sidebar buttons currently call `setShowUpload(true)` with no mode info

## Related Code Files

### Files to modify:
1. **`src/components/UploadModal.tsx`** — add `initialMode` prop, update labels/descriptions
2. **`src/components/AddCoursePanel.tsx`** — rename button labels, add tooltips
3. **`src/app/page.tsx`** — pass `initialMode` to UploadModal, differentiate the two open callbacks

## Implementation Steps

### Step 1: Add `initialMode` prop to UploadModal
- Add `initialMode?: UploadMode` to `UploadModalProps`
- In `useEffect` when `open` changes to `true`, set `mode` to `initialMode ?? "transcript"`
- This ensures clicking "Upload sách" in sidebar opens book tab directly

```typescript
// UploadModalProps — add:
initialMode?: "transcript" | "book";

// Add useEffect:
useEffect(() => {
  if (open && initialMode) {
    setMode(initialMode);
  }
}, [open, initialMode]);
```

### Step 2: Update page.tsx to pass initialMode
- Add `uploadMode` state: `useState<"transcript" | "book">("transcript")`
- `onOpenUpload`: set mode to `"transcript"`, then `setShowUpload(true)`
- `onOpenUploadBook`: set mode to `"book"`, then `setShowUpload(true)`
- Pass `initialMode={uploadMode}` to `<UploadModal>`

### Step 3: Rename AddCoursePanel buttons + add tooltips
**Before → After:**
- `"Upload từ file"` → `"Upload files"`
- `"Upload sách (EPUB/PDF)"` → `"Upload sách"`

**Add `title` (tooltip) attributes:**
- Upload files: `"Upload transcripts, documents. Mỗi file = 1 bài học"`
- Upload sách: `"Upload sách, giáo trình. Hệ thống tự tách chương"`

### Step 4: Update UploadModal labels
**Modal title:**
- Keep generic: `"Upload tài liệu"` (already fine, serves both modes)

**Tab labels:**
- `"Transcript"` → `"📄 Upload files"`
- `"Sách / Giáo trình"` → `"📚 Upload sách"`

**Add description text under each tab content:**
- Transcript mode: `"Upload transcripts, documents, notes. Mỗi file = 1 bài học."`
- Book mode: `"Upload sách, giáo trình. Hệ thống tự tách chương thành bài học."`

**Dropzone hint text:**
- Transcript: already shows `.vtt, .srt, .txt` ✓
- Book: already shows `.pdf, .docx, .txt, .md, .epub` ✓

### Step 5: Update page.tsx button labels (empty state)
- Line ~926: `"Upload file"` → `"Upload files"`
- Line ~937: `"Upload transcript"` → `"Upload files"`

## Todo List
- [x] 1.1 Add `initialMode` prop to UploadModal + useEffect to set mode on open
- [x] 1.2 Add `uploadMode` state to page.tsx, wire `onOpenUpload`/`onOpenUploadBook` callbacks
- [x] 1.3 Pass `initialMode={uploadMode}` to `<UploadModal>` in page.tsx
- [x] 1.4 Rename AddCoursePanel button labels + add title tooltips
- [x] 1.5 Update UploadModal tab labels + add description text per mode
- [x] 1.6 Update page.tsx empty-state button labels
- [x] 1.7 Build + verify no TypeScript errors (`npm run build`)

## Success Criteria
- ✅ Clicking "Upload files" in sidebar → modal opens on transcript tab
- ✅ Clicking "Upload sách" in sidebar → modal opens on book tab
- ✅ All labels match spec wording
- ✅ Tooltips visible on hover over sidebar buttons
- ✅ `npm run build` passes (0 TS errors)

## Security Considerations
- None — no new data flows, no user input changes
