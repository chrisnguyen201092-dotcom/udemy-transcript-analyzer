# Phase 2: Book Metadata Auto-Extraction

## Context Links
- Schema: `prisma/schema.prisma` (Course: author, isbn, publisher)
- Upload route: `src/app/api/books/upload/route.ts`
- Parse book: `src/lib/parse-book.ts`
- PRD: `docs/prd.md` Section 6.12 (B-02: metadata fields)

## Overview
- **Priority:** MEDIUM — enhances UX but not blocking
- **Status:** ✅ Complete
- **Effort:** 2-3 days
- **Description:** Auto-extract book metadata (author, ISBN, publisher, title) from uploaded files when user doesn't provide them manually. Extraction happens **server-side** via `POST /api/books/metadata-preview` — returns metadata without creating DB records. UploadModal calls this after file selection, shows loading spinner, then pre-fills form. User can always override. EPUB metadata from OPF (Phase 1). PDF via pdf-parse info object + regex. DOCX/TXT/MD via regex scan.
- **Completed:** 2026-04-03

## Key Insights
- Course schema already has `author`, `isbn`, `publisher` fields (nullable)
- Upload route already accepts these as optional body params
- EPUB: metadata in OPF manifest (handled in Phase 1)
- PDF: metadata often in document properties (pdf-parse exposes `info` object)
- DOCX: mammoth doesn't expose metadata; need `docx` properties or regex from content
- ISBN pattern: `ISBN[-: ]?(1[03])?[-: ]?[0-9]{1,5}[-: ]?[0-9]+[-: ]?[0-9]+[-: ]?[0-9Xx]`
- For PDF/DOCX without embedded metadata, scan first 2000 chars for patterns

## Requirements

### Functional
- F1: Auto-extract title, author, publisher from PDF document properties
- F2: Auto-extract ISBN from first 5 pages of text content (regex pattern)
- F3: EPUB metadata from OPF (title, creator, publisher, identifier)
- F4: User-provided metadata always overrides auto-extracted values
- F5: Show extracted metadata in upload form for user to confirm/edit

### Non-Functional
- NF1: Extraction adds < 500ms to upload time
- NF2: No false positives for ISBN (validate checksum)

## Architecture

```
File selected in UploadModal
  → POST /api/books/metadata-preview { format, content (base64/text) }
    → Parse content (using same library functions as upload route)
    → Extract metadata:
        EPUB: OPF metadata (direct, from Phase 1 parseEpub())
        PDF: pdf-parse info object + regex scan first pages
        DOCX: regex scan first 2000 chars
        TXT/MD: regex scan first 2000 chars
    → Return { title?, author?, publisher?, isbn? } — NO DB record created
  → UploadModal shows loading spinner during request
  → Pre-fill form fields with extracted values
  → Show "(tự động phát hiện)" label next to auto-filled fields
  → Manual override always takes precedence

Fallback rules:
  - Missing ISBN → leave field empty (user fills manually)
  - Multiple author names → concatenate with ", "
  - No publisher → leave field empty (user fills manually)
```

> **Note:** `/api/books/upload` is legacy/internal (used by tests, potential future direct API). The authoritative v2.0 UI path is: UploadModal → `/api/courses` (stub) → `/api/books/split` → `/api/books/split/confirm`. Both paths share the same underlying parsing library functions — no duplication.

## Related Code Files

### Files to modify
- `src/lib/parse-book.ts` — extend return types to include metadata
- `src/app/api/books/upload/route.ts` — use extracted metadata as defaults (legacy path)
- `src/components/UploadModal.tsx` — call metadata-preview endpoint after file selection, show spinner, pre-fill form

### Files to create
- `src/lib/extract-book-metadata.ts` — metadata extraction utilities (ISBN regex, author patterns)
- `src/app/api/books/metadata-preview/route.ts` — POST endpoint: accept file content, return extracted metadata without creating DB records

### Tests to create/update
- `src/lib/__tests__/extract-book-metadata.test.ts` — ISBN regex, metadata extraction
- `src/app/api/books/__tests__/metadata-preview.test.ts` — API route tests

## Implementation Steps

### Step 1: Create metadata extraction module
Create `src/lib/extract-book-metadata.ts`:
- `extractISBN(text: string): string | null` — scan for ISBN-10/ISBN-13 patterns, validate checksum
- `extractAuthorFromText(text: string): string | null` — scan first 2000 chars for "Author:", "By:", "Tác giả:" patterns; if multiple names found, concatenate with ", "
- `extractPublisherFromText(text: string): string | null` — scan for "Publisher:", "Published by:", "NXB:", "Nhà xuất bản:" patterns

### Step 2: Extend PDF parsing to return metadata
In `parsePdf()`, access `result.info` from pdf-parse for embedded metadata:
- `info.Author`, `info.Title`, `info.Creator`

### Step 3: Extend EPUB parsing to return metadata
Already included in Phase 1's `parseEpub()` — ensure metadata struct is returned with `title`, `author`, `description`, `language`, `identifier` fields.

### Step 4: Create `POST /api/books/metadata-preview` endpoint
- Accept: `{ format: string, content: string }` (base64 for binary, plain text for txt/md)
- Decode content, run appropriate parser, extract metadata
- Return: `{ title?: string, author?: string, publisher?: string, isbn?: string }`
- **No DB writes** — pure extraction and return
- Validate with Zod; handle parse errors gracefully (return empty object, not 500)

### Step 5: Update UploadModal to use metadata-preview
In `UploadModal.tsx`:
- After file selection: POST to `/api/books/metadata-preview` with file content
- Show loading spinner (Loader2) while request is in-flight
- Pre-fill author, ISBN, publisher, title fields with response values
- Show "(tự động phát hiện)" label next to auto-filled fields
- User edits always override auto-filled values

### Step 6: Apply metadata in upload route (legacy path)
In upload route, after parsing:
- If user didn't provide author/isbn/publisher, use extracted values as defaults
- Update course record with extracted metadata

### Step 7: Write tests
- ISBN regex: valid ISBN-10, ISBN-13, edge cases, checksum validation
- Author extraction: various patterns, false positives
- metadata-preview route: returns expected metadata for PDF/EPUB/DOCX inputs

## Todo List
- [x] Create `extract-book-metadata.ts` with ISBN/author/publisher extractors
- [x] Extend `parsePdf()` return type to include metadata
- [x] Create `POST /api/books/metadata-preview` endpoint (no DB writes)
- [x] Update UploadModal: call metadata-preview, show spinner, pre-fill form
- [x] Apply auto-extracted metadata in upload route (legacy path fallback)
- [x] Write unit tests for metadata extraction
- [x] Write API tests for metadata-preview route
- [x] Run quality gate

## Success Criteria
- [x] ISBN auto-detected from book content (>80% accuracy for standard formats)
- [x] Author/publisher extracted from PDF properties when available
- [x] EPUB metadata fully extracted
- [x] User can override all auto-extracted values
- [x] All tests pass, build succeeds

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ISBN regex false positives | Medium | Low | Validate checksum; show as suggestion |
| PDF without metadata properties | High | Low | Fall back to content scanning |
| Author name format varies wildly | High | Low | Best effort; user can always edit |
