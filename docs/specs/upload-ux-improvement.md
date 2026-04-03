# Spec: Upload UX Improvement — Clear Separation of Use Cases

## Goal

Resolve ambiguity in the upload experience by clearly separating two distinct use cases:

1. **"Upload files"** — Multi-file upload for lesson transcripts (Udemy course exports, short documents)
   - Each file = 1 lesson
   - Files grouped into a course
   - Supports: `.vtt`, `.srt`, `.txt` transcript formats

2. **"Upload sách"** — Single book file with smart chapter splitting (textbooks, long documents)
   - 1 file = multiple lessons via intelligent chapter detection
   - Full book metadata (author, ISBN, publisher)
   - Supports: `.pdf`, `.epub`, `.docx`, `.txt`, `.md`

**Current problem:** Both uploads accept PDF, causing user confusion: "Which button do I use?"

**Solution:** Rename & reorganize UI to make the intent crystal clear. Update button labels and provide clear descriptions.

## User Stories

- Às học viên, tôi muốn upload **multiple Udemy lecture transcripts** cùng lúc → tạo nhiều bài học nhanh, mỗi file = 1 bài
- Là học viên, tôi muốn upload **một quyển sách/giáo trình** → hệ thống tự tách chương thành bài học, tôi không phải tách thủ công
- Là học viên, khi hover vào nút "Upload files" hoặc "Upload sách", tôi hiểu rõ mỗi nút dùng cho trường hợp nào (qua description)
- Là học viên, tôi muốn giao diện upload **không gây nhầm lẫn** — 2 nút hoàn toàn riêng biệt, UI/copy rõ ràng

## Acceptance Criteria

### Button Labels & Placement

- [ ] Rename "Upload file" → **"Upload files"** (plural) để chỉ multi-file upload mode
- [ ] Keep "Upload sách" (unchanged) — single-file book upload mode
- [ ] Nút được sắp xếp rõ ràng trong giao diện (side-by-side hoặc stacked) với visual separation
- [ ] Mỗi nút có tooltip hoặc short description khi hover:
  - **"Upload files"**: "Upload transcript, documents. Mỗi file = 1 bài học"
  - **"Upload sách"**: "Upload sách, giáo trình. Hệ thống tự tách chương"

### Upload Modal Updates

- [ ] **"Upload files" modal** (existing flow in `upload-transcript.md`):
  - Title: "Upload File Transcript"
  - Accepted formats: `.vtt`, `.srt`, `.txt`
  - Mode: Multi-file drag-and-drop
  - Result: Each file → 1 lesson in selected course

- [ ] **"Upload sách" modal** (existing flow in `book-upload.md`):
  - Title: "Upload Sách/Giáo trình"
  - Accepted formats: `.pdf`, `.epub`, `.docx`, `.txt`, `.md`
  - Mode: Single-file upload with metadata form
  - Result: 1 file → multiple lessons (or 1 if no chapter structure)

### Clarification Text

- [ ] Landing page / initial upload UI displays clear use case descriptions:
  ```
  📄 Upload files
  Upload transcripts, documents, notes. Each file becomes one lesson.
  Perfect for: Udemy course exports, lecture recordings, articles
  
  📚 Upload sách
  Upload textbooks, books, long documents. System splits chapters into lessons.
  Perfect for: Academic textbooks, novels, comprehensive guides
  ```

- [ ] Modal headers use consistent terminology:
  - "Upload files" = "File Transcripts" / "Transcript Upload"
  - "Upload sách" = "Book/Textbook" / "Book Upload"

### No Format Overlap in UI

- [ ] ".txt" support clarified: both modes accept `.txt`, but context differs
  - "Upload files" → `.txt` treated as single lesson transcript
  - "Upload sách" → `.txt` treated as book content, may split by markdown headings (if present)
  - In modals, only show applicable formats for each mode

### Backward Compatibility

- [ ] Existing behavior unchanged — no breaking changes to API or data model
- [ ] Both `/api/courses/upload` and `/api/books/upload` endpoints continue to work
- [ ] This is purely a **UI/UX improvement** — no database schema changes needed

## Edge Cases

- **User uploads PDF to "Upload files" by mistake**: Rejected with error "PDF not supported. Use 'Upload sách' for PDFs."
- **User uploads EPUB to "Upload files" by mistake**: Same error message
- **User uploads `.txt` to "Upload sách" with no markdown headings**: Treated as single-chapter book (whole content = 1 lesson)
- **User uploads `.txt` to "Upload files"**: Treated as single transcript file = 1 lesson (existing behavior)

## UI/UX Changes

### Primary Upload Section (Dashboard or Sidebar)

**Before:**
```
[Upload file]  [Upload sách]
```
(Button labels + unclear distinction)

**After:**
```
┌─────────────────────────────┐
│  Upload Your Learning       │
├─────────────────────────────┤
│                             │
│  📄 Upload files            │  ← Plural, "files" instead of "file"
│  Upload transcripts,        │
│  documents, notes.          │
│  Each file = 1 lesson       │
│                             │
│  [Upload files Button]      │
│                             │
├─────────────────────────────┤
│                             │
│  📚 Upload sách             │  ← Icon + clear label
│  Upload textbooks,          │
│  books, guides.             │
│  Chapters → lessons auto    │
│                             │
│  [Upload sách Button]       │
│                             │
└─────────────────────────────┘
```

### Hover Tooltips

- **"Upload files"**: "Upload multiple transcripts or documents. Each file becomes one lesson."
- **"Upload sách"**: "Upload a book or textbook. Chapters are split into separate lessons automatically."

### Modal Header Text

**Upload files modal:**
```
📄 Upload File Transcript
Upload one or more transcripts (.vtt, .srt, .txt)
```

**Upload sách modal:**
```
📚 Upload Sách/Giáo trình
Upload a book or textbook (.pdf, .epub, .docx, .txt, .md)
```

## Data Model Changes

**None.** This is a UI/UX improvement only. Existing schemas and endpoints remain unchanged:
- `Course` model: `contentType` field differentiates "course" vs "book"
- `Lesson` model: `order`, `transcript` fields function as before
- Metadata fields (`author`, `isbn`, `publisher`) created in book upload, stay nullable

## API Changes

**None.** Existing endpoints continue to work:
- `POST /api/courses/upload` — handles "Upload files" (multi-file transcripts)
- `POST /api/books/upload` — handles "Upload sách" (book metadata + file extraction)

Error messages may be enhanced to redirect users:
- If `.pdf` or `.epub` posted to `/api/courses/upload`: Return `400` with message:
  ```json
  {
    "error": "PDF/EPUB not supported in transcript upload. Use 'Upload sách' instead."
  }
  ```

## Implementation Notes

### Components to Update

1. **Dashboard / Main Upload UI** (`src/components/UploadSection.tsx` or similar):
   - Replace single "Upload file" button with two distinct cards/sections
   - Add icon + description text for each upload type
   - Ensure accessible (ARIA labels, keyboard navigation)

2. **UploadModal** (`src/components/UploadModal.tsx` or split into two):
   - Option A: Single modal with mode selector (current implementation in `book-upload.md`)
   - Option B: Two separate modals, one for each flow (cleaner separation)
   - Update modal title, accepted formats, form fields based on mode

3. **Error Messages**:
   - Add validation: reject incompatible file formats per mode
   - Friendly error copy guiding user to correct upload type

4. **Documentation / Help**:
   - Update inline help text in modals
   - Consider adding a FAQ or tooltip explaining when to use which upload

### Testing Checklist

- [ ] Click "Upload files" → correct modal opens (transcript formats only)
- [ ] Click "Upload sách" → correct modal opens (book formats only)
- [ ] Attempt upload `.pdf` via "Upload files" → rejected with helpful error
- [ ] Attempt upload `.vtt` via "Upload sách" → rejected with helpful error
- [ ] Multi-file upload works in "Upload files" mode
- [ ] Single-file + metadata works in "Upload sách" mode
- [ ] Existing courses/books display correctly (backward compatible)

## Success Criteria

- ✅ User can immediately distinguish between two upload flows (via button labels + descriptions)
- ✅ No confusion about which button to use (clear use case examples)
- ✅ No format overlap in UI (each mode shows only applicable formats)
- ✅ All existing functionality preserved (backward compatible)
- ✅ API contracts unchanged (only UI changes)
- ✅ Helpful error messages if user selects wrong mode
- ✅ Accessibility maintained (screen readers, keyboard navigation)

## Related Specs

- [`upload-transcript.md`](./upload-transcript.md) — "Upload files" detailed flow
- [`book-upload.md`](./book-upload.md) — "Upload sách" detailed flow
- [`book-schema.md`](./book-schema.md) — Database schema for book support

## Next Steps

1. Implement UI changes (button labels, modal headers, descriptions)
2. Add/enhance error handling for incompatible formats
3. User test: confirm users understand the distinction
4. Deploy and monitor upload analytics (track which button is used more)
