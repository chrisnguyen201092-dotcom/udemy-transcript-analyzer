# Phase 1: EPUB Support & Book Parsing Hardening

## Context Links
- Schema: `prisma/schema.prisma` (Course.contentType, Lesson.chapterNumber)
- Parsing: `src/lib/parse-book.ts`, `src/lib/ocr.ts`
- Constants: `src/lib/book-constants.ts`
- Upload route: `src/app/api/books/upload/route.ts`
- Split route: `src/app/api/books/split/route.ts`
- Package: `package.json` (epub2 already installed)
- Tests: `src/lib/__tests__/parse-book.test.ts`

## Overview
- **Priority:** HIGH — prerequisite for all other phases
- **Status:** ✅ Complete
- **Effort:** 3-4 days
- **Description:** Add EPUB parsing support, harden existing PDF/DOCX/MD parsing, improve error handling and edge cases.
- **Completed:** 2026-04-03

## Key Insights
- `epub2` is already in `package.json` but no parsing code exists
- `SUPPORTED_BOOK_EXTENSIONS` in `book-constants.ts` currently only has `.pdf`, `.docx`, `.txt`, `.md` — needs `.epub`
- `parse-book.ts` has `parsePdf()`, `parseDocx()`, `parseMarkdownChapters()` but no `parseEpub()`
- Upload route and split route handle `.pdf`, `.docx`, `.txt`, `.md` — need `.epub` cases
- epub2 extracts chapters as HTML — need HTML-to-text conversion (mammoth already available, or simple regex strip)

## Requirements

### Functional
- F1: Upload `.epub` files creates Course with `contentType="book"`
- F2: EPUB chapters automatically become Lesson records
- F3: EPUB metadata (title, author, publisher) auto-extracted
- F4: EPUB content preserves chapter structure from spine/TOC
- F5: Large EPUBs (>50MB) rejected with clear error message

### Non-Functional
- NF1: Parse time < 10s for typical EPUB (<10MB)
- NF2: v2.0 scope is ≤50MB files; in-memory processing is acceptable at this size
- NF3: Error messages in Vietnamese, user-friendly

## Architecture

```
EPUB file (base64)
  → epub2 library
  → Extract: metadata (title, author, publisher)
  → Extract: chapters (from spine order)
  → HTML → plain text (strip tags)
  → Return: { text, chapters[], metadata }
```

## Related Code Files

### Files to modify
- `src/lib/parse-book.ts` — add `parseEpub()` function
- `src/lib/book-constants.ts` — add `.epub` to `SUPPORTED_BOOK_EXTENSIONS`
- `src/app/api/books/upload/route.ts` — add `.epub` case in switch
- `src/app/api/books/split/route.ts` — add `.epub` case in switch

### Files to create
- None (add functions to existing modules to stay under 200 lines)

### Tests to create/update
- `src/lib/__tests__/parse-book.test.ts` — add EPUB parsing tests

## Implementation Steps

### Step 1: Add EPUB to supported extensions
Update `src/lib/book-constants.ts`:
```ts
export const SUPPORTED_BOOK_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md", ".epub"]);
```

### Step 2: Implement `parseEpub()` in `parse-book.ts`

```ts
export async function parseEpub(buffer: Buffer): Promise<{
  text: string;
  chapters: { title: string; content: string }[];
  metadata: { title?: string; author?: string; description?: string; language?: string; identifier?: string };
}>
```

**epub2 requires a file path, not a Buffer. Implementation must:**
1. Write buffer to a temp file: `path.join(os.tmpdir(), `epub-${Date.now()}-${Math.random().toString(36).slice(2)}.epub`)`
2. Parse with `epub2.createAsync(tempPath)` inside a `try/finally`
3. Delete temp file in `finally` block (always, even on error)
4. Set 30s timeout for parsing; reject and cleanup on timeout

**Metadata extraction from OPF:**
- `epub.metadata.title` → title
- `epub.metadata.creator` → author (may be array — join with ", ")
- `epub.metadata.description` → description
- `epub.metadata.language` → language
- `epub.metadata.identifier` → identifier (ISBN if present, otherwise leave empty)

**Spine/TOC → Lessons:**
- Iterate `epub.spine.contents` in order (preserves reading order)
- For each spine item: call `epub.getChapterRaw(item.id)` to get HTML content
- Strip HTML tags (regex `/<[^>]+>/g` or dedicated strip function) for plain text
- Map each spine item to `{ title: item.title || "Chapter N", content: strippedText }`
- Use `epub.toc` entries to resolve better chapter titles when available

**Cleanup strategy:**
- Temp file: always delete in `finally` block
- On timeout (30s): reject promise, ensure finally still runs
- On parse error: throw descriptive error, temp file still cleaned up

### Step 3: Add `.epub` case to upload route
In `src/app/api/books/upload/route.ts`, add case for `.epub`:
- Parse buffer with `parseEpub()`
- If chapters found, create one lesson per chapter
- If no chapter structure, create single lesson with full text
- Apply auto-extracted metadata to course if user didn't provide

### Step 4: Add `.epub` case to split route
In `src/app/api/books/split/route.ts`, add case for `.epub`:
- Parse buffer with `parseEpub()`
- Use chapter structure directly (higher confidence than heuristic)
- If no chapter structure, fall through to heuristic detection on full text

### Step 5: Update upload modal file extensions
In `src/components/UploadModal.tsx`, add `.epub` to `BOOK_EXTENSIONS` array and `BINARY_EXTENSIONS` set.

### Step 6: Write tests
- Unit test `parseEpub()` with mock EPUB buffer
- Integration test upload route with `.epub` extension
- Test metadata extraction
- Test chapter splitting from EPUB structure

## Todo List
- [x] Add `.epub` to `SUPPORTED_BOOK_EXTENSIONS`
- [x] Implement `parseEpub()` in `parse-book.ts` (temp-file approach, try/finally cleanup, 30s timeout)
- [x] Add `.epub` case to book upload route
- [x] Add `.epub` case to book split route
- [x] Update `UploadModal.tsx` BOOK_EXTENSIONS
- [x] Implement magic-byte validation for PDF, EPUB, DOCX
- [x] Implement ZIP decompression limits (entries ≤1000, total ≤200MB, single entry ≤50MB)
- [x] Implement archive path traversal protection
- [x] Implement HTML sanitization for EPUB chapter content
- [x] Write unit tests for EPUB parsing
- [x] Run quality gate (`npm run build && npm run lint && npm run test:run`)

## Success Criteria
- [x] `.epub` files can be uploaded and parsed
- [x] EPUB chapters automatically create lessons
- [x] EPUB metadata (title, author) extracted when available
- [x] All existing tests still pass
- [x] Build succeeds with zero errors
- [x] Docker build works

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| epub2 API changes since install | Low | Medium | Pin version, check docs |
| Large EPUB memory issues | Medium | Medium | Stream chapters, don't load all at once |
| HTML-to-text loses formatting | Low | Low | Acceptable for MVP; preserve code blocks |
| EPUB with DRM | Low | Low | Error message: "DRM-protected files not supported" |

## Security Considerations

- **File size:** Validate before parsing — reject files >50MB (MAX_BOOK_CONTENT_LENGTH = 50MB)
- **Magic-byte validation:** Check first bytes match expected format before processing:
  - PDF: `%PDF` (`25 50 44 46`)
  - EPUB: PK ZIP header (`50 4B 03 04`)
  - DOCX: PK ZIP header (`50 4B 03 04`)
  - Do NOT rely solely on file extension — validate magic bytes first
- **EPUB/DOCX decompression limits** (ZIP-based formats):
  - Max archive entries: 1000
  - Max total uncompressed size: 200MB
  - Max single entry uncompressed size: 50MB
  - Reject archives exceeding any of these limits
- **Archive path traversal:** Normalize all entry paths; reject entries containing `..` or absolute paths
- **HTML sanitization:** Strip `<script>` tags, inline event handlers (`on*` attributes) from EPUB HTML chapters before storing plain text
- **Temp file cleanup:** Always cleanup in `finally` block; set 30s timeout for parsing operations
- **File type spoofing:** Magic-byte check is mandatory — never trust extension alone
