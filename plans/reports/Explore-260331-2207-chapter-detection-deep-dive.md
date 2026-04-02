# Deep Dive: Chapter Detection & Splitting Logic

**Report Date:** 2026-03-31  
**Status:** ✅ Complete Analysis  
**Scope:** Chapter boundary detection, split APIs, Prisma schema, UI components, tests

---

## 1. DETECTION LOGIC CODE

### Core File: `src/lib/split-chapters.ts` (326 lines)

#### 5 Detection Patterns (Priority Order)

1. **KEYWORD HEADINGS** (Highest Priority)
   - Pattern: `/^(chapter|chương|phần|part)\s+\d+/i`
   - Examples: "CHAPTER 5", "Chương 3", "PHẦN 2", "Part 1"
   - **Vietnamese PDF optimizations:**
     - BARE keyword: `/^(chapter|chương|phần|part)\s+\d+[.):]?\s*$/i`
     - Auto-merges subtitle from next line if bare + no blank gap + subtitle valid (≤120 chars)
     - Prevents consuming body text from full titles like "CHƯƠNG 1. TỔNG QUAN VỀ..."

2. **NUMBERED HEADINGS** 
   - Pattern: `/^\d+(?:\.\d+)*[.)]\s+\S/`
   - Examples: "1. Title", "1.1 Subtitle", "1) Section"

3. **MARKDOWN H1** (Single # only)
   - Pattern: `/^# (.+)$/`
   - Ignores H2+ (`##` etc)

4. **ALL CAPS SHORT LINES**
   - Conditions: ≤60 chars trimmed, ≥1 uppercase letter, NO lowercase
   - Prevents false positives

5. **FALLBACK**
   - If no headings found: single chapter "Untitled" with all content
   - Triggered when `headings.length === 0`

#### Key Functions & Guards

- `detectChapters(text)` → DetectedChapter[]
- `findHeadings(lines)` → HeadingMatch[] (applies priority, returns first family with ≥2)
- `applyKeywordGuards(headings, lines)` → TWO GUARDS:
  - **MONOTONIC**: Discard headings with chapterNum ≤ previous (kills TOC repeats)
  - **MINIMUM CONTENT**: Discard headings with 0 body lines (kills TOC stubs), except subtitle-merged ones

#### Confidence Mechanism

**NO explicit scoring.** Uses:
- Pattern priority (keyword > markdown > numbered > caps)
- Heuristic threshold: ≥2 headings → "heuristic", else → "fallback"
- Short flag: wordCount < 200 → warning
- Monotonic + minimum-content guards filter TOC entries/stubs

---

### Parse Book Module: `src/lib/parse-book.ts` (112 lines)

- **PDF**: pdf-parse v2 → text extraction; scanned PDF detection (< 100 chars); OCR fallback
- **DOCX**: mammoth → raw text + HTML conversion
- **Markdown**: Split on `#` (H1 only); preserve preamble
- **TXT**: Passed as-is to detectChapters()

---

### Constants: `src/lib/book-constants.ts`

- MAX_BOOK_CONTENT_LENGTH = 50 MB (base64) ≈ 37 MB raw
- SUPPORTED_BOOK_EXTENSIONS = {.pdf, .docx, .txt, .md}

---

## 2. SPLIT PREVIEW API: `POST /api/books/split`

**File:** `src/app/api/books/split/route.ts` (157 lines)

#### Request Schema (Zod)

```
bookId: string (required)
format: string (.pdf | .docx | .txt | .md)
content: string (base64 for binary, plain text for txt/md)
toc?: string | null (optional, UNUSED)
pageHeaders?: string[] (optional, UNUSED)
splitConfig?: { useAI?: boolean, minChapterWords?: number }
```

#### Response (200 OK)

```
{
  method: "heuristic" | "fallback",
  chapters: [
    { index: number, title: string, wordCount: number, content: string }
  ],
  warnings: string[]
}
```

#### Pipeline

1. Validate (Zod) → file size check → format validation
2. Verify book exists
3. Parse content (format-specific)
4. Detect chapters → determine method (≥2 → "heuristic", else → "fallback")
5. Flag short chapters (< 200 words)
6. Return response

#### Error Responses

- 400: Invalid format/bookId/content/too large
- 404: Book not found
- 500: Parse error

---

## 3. SPLIT CONFIRM API: `POST /api/books/split/confirm`

**File:** `src/app/api/books/split/confirm/route.ts` (81 lines)

#### Request Schema (Zod)

```
bookId: string (required)
chapters: [ { index: number, title: string, content: string, 
              chapterNumber: number, pageRange?: string } ]
```

#### Response (200 OK)

```
{
  created: [ { id: string, title: string, order: number, 
               chapterNumber: number } ],
  courseId: string
}
```

#### Pipeline

1. Validate request
2. Verify book exists
3. **Conflict check**: if course.lessons.count() > 0 → return **409 Conflict**
   - ⚠️ RE-SPLIT NOT SUPPORTED — user must delete lessons first
4. Build lesson data from chapters (order: 1+, transcript: content)
5. Atomic $transaction() → create all or none
6. Return created lessons

#### Error Responses

- 400: Invalid schema
- 404: Book not found
- 409: **Book already has lessons** ← BLOCKER FOR RE-SPLIT
- 500: DB error

---

## 4. PRISMA SCHEMA

**File:** `prisma/schema.prisma`

### Course Model

```
id: String @id
title: String
contentType: String
author: String?
isbn: String?
publisher: String?
lessons: Lesson[] (1-to-many, CASCADE)
progress: CourseProgress?
learnerProfile: LearnerProfile?
```

### Lesson Model

```
id: String @id
courseId: String (FK → Course, CASCADE)
title: String
order: Int
chapterNumber: Int?
pageRange: String?
transcript: String?
summary, explanation, quiz, flashcards, exercises, notes: String?
progress: LessonProgress?
flashcardReviews: FlashcardReview[]
chatMessages: ChatMessage[]
```

**Key Constraints:**
- CASCADE delete on Course → deletes all Lessons
- No unique constraint on (courseId, order) — allows duplicates
- Nullable fields (chapterNumber, pageRange, transcript)

---

## 5. UI FOR SPLIT PREVIEW

**STATUS: NOT FOUND** ⚠️

Searched `src/components/` — no ChapterPreviewModal or SplitPreview component.

Likely locations to check:
- `src/components/ImportModal.tsx`
- `src/app/` routes
- Or not yet implemented

Expected features (from spec):
- List chapters with index, title, word count
- Inline edit titles
- "Short" badge
- Merge/delete actions
- Warnings (PDF scan, AI, etc.)
- Confirm/Cancel buttons

---

## 6. TESTS: `src/app/api/books/__tests__/split.test.ts` (412 lines)

### Coverage

**POST /api/books/split** (20 tests):
- Validation (9): missing bookId, invalid format, empty content, book not found
- Heuristic (3): returns chapters, passes content, includes content
- Fallback (2): 1 chapter → "fallback" method + warning
- Short chapters (1): warning emitted
- Format handling (1): all 4 formats accepted
- Edge cases (4): empty chapters, whitespace, AI fallback

**POST /api/books/split/confirm** (11 tests):
- Validation (4): missing bookId, empty chapters, book not found, existing lessons
- Lesson creation (4): creates records, order sequential, pageRange/chapterNumber/transcript passed
- Edge cases (2): nullable pageRange, DB error

**Total: 31 tests** ✅ Happy path, validation, errors, edge cases covered

⚠️ **NOT TESTED:**
- AI fallback (not implemented)
- Re-split recovery (not implemented)
- Confidence scoring (not implemented)

---

## UNIMPLEMENTED FEATURES (From Spec)

1. **AI Fallback (B-18)**: Parameter `splitConfig.useAI` accepted but never called
2. **Re-split (B-19a)**: Returns 409 Conflict; no re-split endpoint
3. **PDF Page Tracking**: No startPage/endPage in response
4. **EPUB Support**: Spec mentions, not implemented
5. **Nested Heading Handling**: No validation for top-level-only
6. **TOC to AI**: Parameter accepted, unused
7. **Confidence Scoring**: No 0-1 confidence returned

---

## KEY FINDINGS FOR IMPROVEMENTS

### Detection Accuracy Issues

1. **No font-size parsing**: Spec mentions PDF metadata font sizes; not implemented
2. **No page break detection**: Fallback in spec not coded
3. **No confidence scoring**: Binary heuristic/fallback decision
4. **Short chapter logic**: Threshold (< 200 words) is context-naive

### Re-split Recovery Gap

1. **409 Conflict blocks re-splitting**: No delete-before-resplit mechanism
2. **No atomic re-split**: Can't delete old lessons + create new in one transaction
3. **No version tracking**: Can't tell which split version is current
4. **No split history**: No audit trail

### Spec Compliance Gaps

- EPUB, nested headings, TOC processing, confidence scoring all absent
- AI fallback feature flag present but unused
- Page tracking metadata not populated by API

---

## FILE PATHS (Key References)

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/split-chapters.ts` | 326 | Core detection: 5 patterns + 2 guards |
| `src/lib/parse-book.ts` | 112 | Parsers: PDF, DOCX, Markdown, TXT |
| `src/lib/book-constants.ts` | 11 | Size/format limits |
| `src/app/api/books/split/route.ts` | 157 | Split preview endpoint |
| `src/app/api/books/split/confirm/route.ts` | 81 | Split confirm endpoint |
| `src/app/api/books/__tests__/split.test.ts` | 412 | 31 tests (comprehensive) |
| `prisma/schema.prisma` | 119 | Course/Lesson models |
| `docs/specs/book-chapter-splitting.md` | 237 | Full spec (B-17, B-18, B-19) |

---

## RECOMMENDATIONS

1. **Implement ChapterPreviewModal component** (UI missing)
2. **Add re-split recovery**: New endpoint to delete + re-split atomically
3. **Confidence scoring**: Return 0-1 confidence per chapter
4. **AI fallback**: Wire up splitConfig.useAI → AI API when heuristic fails
5. **Page tracking**: Populate startPage/endPage for all formats
6. **Vietnamese testing**: Verify subtitle-merge + monotonic guard work with real PDFs
