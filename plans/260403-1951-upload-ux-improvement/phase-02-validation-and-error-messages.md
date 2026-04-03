# Phase 2: Validation & Error Messages

## Context
- Spec: `docs/specs/upload-ux-improvement.md` → "Edge Cases" section
- Current: transcript mode rejects non-.vtt/.srt/.txt via `isAcceptedTranscript()` + drag-drop toast. Book mode uses `isAcceptedBook()`.
- Missing: no cross-mode error guidance (e.g., "Use 'Upload sách' for PDFs")

## Priority: Medium | Status: ✅ COMPLETE

## Key Insights
- Client-side validation already exists (`isAcceptedTranscript`, `isAcceptedBook` in UploadModal.tsx L57-67)
- Drag-drop rejection toast exists (L262) but message is generic
- API-side validation in `/api/courses/upload` currently accepts any file type posted — could add server-side guard too
- Spec requests: if PDF/EPUB dropped on transcript mode → "Use 'Upload sách' instead"

## Related Code Files

### Files to modify:
1. **`src/components/UploadModal.tsx`** — enhance rejection toast messages
2. **`src/app/api/courses/upload/route.ts`** — add server-side guard for PDF/EPUB

### Test files to verify:
3. **`src/app/api/courses/__tests__/upload.test.ts`** — add test for PDF rejection
4. **`src/app/api/books/__tests__/upload.test.ts`** — verify no regression

## Implementation Steps

### Step 1: Enhance client-side rejection messages in UploadModal
**Transcript drag-drop rejection (L262):**
```
Before: "${rejectedCount} file bị bỏ qua (chỉ hỗ trợ .vtt, .srt, .txt)"
After:  "${rejectedCount} file bị bỏ qua. Chỉ hỗ trợ .vtt, .srt, .txt. Dùng 'Upload sách' cho PDF/EPUB."
```

**Transcript file picker:** Currently `accept=".vtt,.srt,.txt"` (L713) blocks at OS level — good, no change needed.

### Step 2: Add server-side guard in /api/courses/upload
- In route handler, check each file's extension
- If `.pdf` or `.epub` detected, return 400:
```json
{
  "error": "PDF/EPUB không hỗ trợ trong transcript upload. Dùng 'Upload sách' để upload PDF/EPUB."
}
```

### Step 3: Update/add tests
- Add test case in `upload.test.ts`: POST with a `.pdf` file → expect 400 + error message
- Run existing book tests to verify no regression

## Todo List
- [x] 2.1 Update drag-drop rejection toast in UploadModal to mention "Upload sách" alternative
- [x] 2.2 Add server-side PDF/EPUB guard in `/api/courses/upload/route.ts`
- [x] 2.3 Add test: transcript upload with PDF → 400 error
- [x] 2.4 Run existing tests: `npm run test -- --reporter=verbose`
- [x] 2.5 Build + verify: `npm run build`

## Success Criteria
- ✅ Dropping PDF on transcript zone shows helpful redirect message
- ✅ POST PDF to `/api/courses/upload` returns 400 with guidance message
- ✅ All existing tests still pass (912/912 ✓)
- ✅ New tests for PDF rejection pass

## Security Considerations
- Server-side validation prevents bypassing client-side file type checks
