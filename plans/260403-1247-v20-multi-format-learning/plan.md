# Inkgest v2.0 — Multi-Format Learning (Udemy + Books)

> **Plan version:** 1.0
> **Created:** 2026-04-03
> **Target:** 2026-06-30
> **Status:** ✅ Complete
> **Completed:** 2026-04-03

---

## Overview

Expand Inkgest from Udemy-only learning assistant to support books/textbooks (PDF, EPUB, DOCX, TXT, MD) with the same AI engine. v1.3 Multi-User Foundation is complete — schema has `contentType`, `author`, `isbn`, `publisher` fields, and book API routes already exist as backend-only.

## Current State Assessment

**Already implemented (backend only, no full UI integration):**
- Schema: `Course.contentType`, `author`, `isbn`, `publisher`, `Lesson.chapterNumber`, `Lesson.pageRange`, `Course.rawContent`
- Book parsing: `parse-book.ts` (PDF via pdf-parse, DOCX via mammoth, MD via H1 splitting)
- OCR: `ocr.ts` (Tesseract.js for scanned PDFs, eng+vie)
- Chapter splitting: `split-chapters.ts` (7 heuristic patterns), `split-ai.ts` (LLM fallback)
- Split patterns: `split-patterns.ts` (keyword, lesson, markdown-h1, roman, numbered, all-caps, dash-separator)
- API routes: `/api/books` (CRUD stub), `/api/books/upload`, `/api/books/split`, `/api/books/split/confirm`, `/api/books/split/lessons` (bulk delete)
- AI prompts: Full book-specific prompt set (7 types: summary, explain, chat, roadmap, quiz, flashcard, exercise) via `getSystemPrompt(type, "book")`
- UI partial: `UploadModal` has book mode, `CourseList` shows book badge, `SplitChapterDialog` exists
- Dependencies: `pdf-parse`, `epub2`, `mammoth`, `tesseract.js`, `pdf-to-png-converter` all in package.json

**Gaps to fill:**
1. EPUB parsing not implemented (library installed but no code)
2. Book metadata extraction (auto-detect author/ISBN from content)
3. UI labels adaptation incomplete (TranscriptPanel, LessonList, AIAssistantPanel)
4. No key concepts extraction (B-20, B-21)
5. No glossary feature
6. End-to-end book upload flow needs testing & polish
7. Advanced features: concept linking, knowledge graph, cross-chapter SRS (Module 20)

---

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|-------------|
| 1 | [EPUB Support & Book Parsing Hardening](./phase-01-epub-support-and-parsing-hardening.md) | ✅ Complete | 3-4d | None |
| 2 | [Book Metadata Auto-Extraction](./phase-02-book-metadata-auto-extraction.md) | ✅ Complete | 2-3d | Phase 1 |
| 3 | [UI Adaptation for Books](./phase-03-ui-adaptation-for-books.md) | ✅ Complete | 3-4d | Phase 1 |
| 4 | [End-to-End Book Flow Integration & Testing](./phase-04-e2e-book-flow-integration-and-testing.md) | ✅ Complete | 3-4d | Phase 1-3 |
| 5a | [Key Concept Extraction & Persistence](./phase-05-key-concepts-and-glossary.md#phase-5a) | ✅ Complete | 2-3d | Phase 4 |
| 5b | [Glossary Aggregation, Search & UI](./phase-05-key-concepts-and-glossary.md#phase-5b) | ✅ Complete | 2-3d | Phase 5a (product-gated) |
| 6 | [Advanced Features (Concept Linking, Knowledge Graph)](./phase-06-advanced-features.md) | ✅ Complete | 5-7d | Phase 5b |

**Total estimated effort:** 20-27 days (4-6 weeks)

---

## Dependency Graph

```
Phase 1 (EPUB + Parsing)
├── Phase 2 (Metadata) ← needs parsing working
├── Phase 3 (UI Adaptation) ← needs contentType flow working
│
└── Phase 4 (E2E Integration) ← needs Phase 1-3
    └── Phase 5a (Key Concept Extraction) ← needs full flow
        └── Phase 5b (Glossary, Search & UI) ← product-gated by 5a validation
            └── Phase 6 (Advanced) ← needs glossary data from 5b
```

Phase 2 and Phase 3 can run in **parallel** after Phase 1.
Phase 5b is **product-gated**: only proceed after validating Phase 5a is useful to users.

---

## Key Decisions

1. **Reuse Course/Lesson model** — books are courses with `contentType="book"`, chapters are lessons. No new models needed.
2. **EPUB via epub2** — already in package.json, proven library.
3. **AI prompts already done** — full book-specific prompt set exists in `prompts.ts`.
4. **Incremental delivery** — Phase 1-4 deliver a complete book MVP; Phase 5-6 are enhancements.
5. **No new DB models** for Phase 1-4 — reuse existing schema fields. Phase 5 adds `keyConcepts` and `glossary` fields.
6. **File size scope: v2.0 targets files ≤50MB** — large-file streaming deferred to v2.1. In-memory processing is acceptable for ≤50MB.
7. **Authoritative ingestion path (v2.0 UI):** stub → split preview → confirm (UploadModal → `/api/courses` + `/api/books/split` + `/api/books/split/confirm`). `/api/books/upload` is legacy/internal (used by tests, potential future direct API) — NOT the primary v2.0 UI path. Both paths share the same underlying parsing library functions (no duplication).
8. **Metadata extraction is server-side** — `POST /api/books/metadata-preview` returns extracted metadata without creating DB records; client pre-fills form. Manual override always wins.

---

## Quality Gates

Each phase must pass before proceeding:
- `npm run build` — zero errors
- `npm run lint` — zero errors
- `npm run test:run` — all tests pass
- Manual smoke test of new feature
- Docker build works: `docker compose up -d --build udemy-app`

---

## Success Criteria (v2.0)

- Users can upload and read PDF, EPUB, DOCX, TXT, MD books (≤50MB)
- Book chapters auto-created from file structure
- AI features (summary, explain, chat, quiz, flashcard, exercise, roadmap) work on book chapters
- UI clearly distinguishes books from video courses
- All format-specific labels (Sách/Chương) rendered correctly
- **v2.0 targets files ≤50MB. Large-file streaming (>50MB) is deferred to v2.1.**
