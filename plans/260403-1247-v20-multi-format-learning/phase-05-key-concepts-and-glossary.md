# Phase 5: Key Concepts & Glossary

> **Split into two slices per YAGNI principle. Phase 5b is product-gated by 5a validation.**

## Phase 5a: Key Concept Extraction & Persistence {#phase-5a}

## Context Links
- PRD: `docs/prd.md` Section 6.16 (B-20..B-21)
- Schema: `prisma/schema.prisma`
- AI prompts: `src/lib/ai/prompts.ts`
- AI routes: `src/app/api/ai/`

## Overview
- **Priority:** MEDIUM — enhancement, not blocking MVP
- **Status:** ✅ Complete
- **Effort:** 2-3 days
- **Dependencies:** Phase 4 (complete book flow must work)
- **Description:** AI extracts key concepts and definitions from each book chapter. Persist to `Lesson.keyConcepts`. Display in lesson view. AI Reading Plan enhanced with difficulty assessment per chapter.
- **Completed:** 2026-04-03

## Key Insights
- Need 1 new nullable field: `Lesson.keyConcepts` (JSON string)
- Key concepts extraction is a new AI route `/api/ai/concepts`
- Difficulty assessment added to the existing roadmap prompt output
- Glossary aggregation, search, and cross-chapter UI deferred to Phase 5b

## Requirements (Phase 5a)

### Functional (from PRD B-20, B-22, B-23)
- B-20: AI extracts terms, definitions, key concepts from each chapter → persist as `Lesson.keyConcepts`
- B-22: AI Reading Plan: optimal reading order, important chapters, skippable chapters (reuse roadmap route)
- B-23: AI assesses difficulty per chapter (beginner/intermediate/advanced) in Reading Plan output

### Additional (5a)
- F1: Key concepts displayed in lesson view (within AI panel as "Khái niệm" tab)
- F2: Key concepts auto-generated as a separate user action ("Trích xuất khái niệm" button)

### Non-Functional
- NF1: Key concept extraction < 30s per chapter
- NF2: keyConcepts JSON size < 100KB per lesson

## Architecture (Phase 5a)

### Key Concepts Extraction
```
User clicks "Trích xuất khái niệm" on a chapter
  → POST /api/ai/concepts { lessonId }
    → Load lesson transcript + course context
    → AI prompt: extract terms, definitions, relationships
    → Return JSON: { concepts: [{ term, definition, category, relatedTerms }] }
    → Persist to Lesson.keyConcepts
```

### Reading Plan Enhancement
Modify `BOOK_ROADMAP_SYSTEM_PROMPT` to include:
- Difficulty rating per chapter (beginner/intermediate/advanced)
- Suggested reading order (may differ from chapter order)
- Chapters safe to skip for experienced readers

## Related Code Files (Phase 5a)

### Schema changes
- `prisma/schema.prisma` — add `keyConcepts String?` to Lesson model

### Files to create
- `src/app/api/ai/concepts/route.ts` — POST: extract key concepts for a lesson
- `src/components/KeyConceptsPanel.tsx` — display key concepts for a chapter (~100 lines)

### Files to modify
- `src/lib/ai/prompts.ts` — add `BOOK_CONCEPTS_SYSTEM_PROMPT`; enhance `BOOK_ROADMAP_SYSTEM_PROMPT` with difficulty assessment
- `src/components/AIAssistantPanel.tsx` — add "Khái niệm" tab for book chapters (lesson-level)

### Tests to create
- `src/app/api/ai/__tests__/concepts.test.ts`

## Implementation Steps (Phase 5a)

### Step 1: Schema migration
Add to `prisma/schema.prisma`:
```prisma
model Lesson {
  // ... existing fields
  keyConcepts  String?  /// JSON: [{ term, definition, category, relatedTerms }]
}
```
Run `npx prisma db push`.

### Step 2: Create concepts extraction prompt
Add to `prompts.ts`:
```
BOOK_CONCEPTS_SYSTEM_PROMPT — extract key terms, definitions, categories from chapter text.
Output format: JSON array of { term, definition, category, relatedTerms[] }
```

### Step 3: Create `/api/ai/concepts` route
- POST with `lessonId`
- Verify lesson belongs to a book course
- Load transcript
- Call AI with concepts prompt
- Parse JSON response, validate structure
- Persist to `Lesson.keyConcepts`

### Step 4: Create `KeyConceptsPanel.tsx`
- Display concept list with definition tooltips
- Category grouping (if available)
- Loading state while extracting

### Step 5: Integrate into AIAssistantPanel
- Add "Khái niệm" tab (only visible for book `contentType`)
- Show `KeyConceptsPanel` for lesson-level view
- "Trích xuất khái niệm" trigger button

### Step 6: Enhance roadmap prompt for difficulty
Update `BOOK_ROADMAP_SYSTEM_PROMPT` with per-chapter difficulty assessment and optimal reading order.

### Step 7: Write tests and run quality gate

## Todo List (Phase 5a)
- [x] Add `keyConcepts` field to Lesson schema
- [x] Create concepts extraction AI prompt
- [x] Create `/api/ai/concepts` route
- [x] Create `KeyConceptsPanel.tsx`
- [x] Integrate "Khái niệm" tab into AIAssistantPanel (book only)
- [x] Enhance roadmap prompt with difficulty assessment
- [x] Write tests
- [x] Run quality gate
- [x] **Product validation gate:** Evaluate if key concepts feature is useful before proceeding to 5b

## Success Criteria (Phase 5a)
- [x] Key concepts extracted from book chapters with >80% relevance
- [x] UI displays concepts in lesson view with definitions
- [x] Reading Plan includes difficulty per chapter
- [x] Only shows for book contentType (not video courses)
- [x] All tests pass, build succeeds

---

## Phase 5b: Glossary Aggregation, Search & UI {#phase-5b}

> **⚠️ Product-gated: Only proceed after validating Phase 5a is useful to users.**

## Context Links
- PRD: `docs/prd.md` Section 6.16 (B-21)
- Phase 5a outputs: `Lesson.keyConcepts` data populated
- AI prompts: `src/lib/ai/prompts.ts`

## Overview
- **Priority:** LOW — enhancement, product-gated
- **Status:** ✅ Complete
- **Effort:** 2-3 days
- **Dependencies:** Phase 5a (keyConcepts data must exist and be validated useful)
- **Description:** Aggregate per-chapter key concepts into a whole-book glossary. Deduplicate across chapters via AI. Provide searchable/filterable glossary UI panel.
- **Completed:** 2026-04-03

## Requirements (Phase 5b)

### Functional (from PRD B-21)
- B-21: Aggregate key concepts from all chapters → deduplicated whole-book glossary → persist as `Course.glossary`

### Additional (5b)
- F1: Glossary accessible as a course-level view (e.g., tab in AI panel when no lesson selected)
- F2: Search/filter within glossary (client-side, no extra API call)
- F3: Glossary organized alphabetically, grouped by category

### Non-Functional
- NF1: Glossary aggregation < 60s for book with 20 chapters
- NF2: Glossary JSON size < 1MB

## Architecture (Phase 5b)

### Glossary Aggregation
```
User clicks "Tạo Bảng thuật ngữ" on book course
  → POST /api/ai/glossary { courseId }
    → Load all chapters' keyConcepts
    → If chapters missing keyConcepts → return warning (do not auto-extract)
    → AI prompt: deduplicate, merge, organize alphabetically
    → Return JSON: { glossary: [{ term, definition, chapters[], category }] }
    → Persist to Course.glossary
```

## Related Code Files (Phase 5b)

### Schema changes
- `prisma/schema.prisma` — add `glossary String?` to Course model

### Files to create
- `src/app/api/ai/glossary/route.ts` — POST: aggregate glossary for a course
- `src/components/GlossaryPanel.tsx` — searchable/filterable glossary table (~120 lines)

### Files to modify
- `src/lib/ai/prompts.ts` — add `BOOK_GLOSSARY_SYSTEM_PROMPT`
- `src/components/AIAssistantPanel.tsx` — show GlossaryPanel at course level (no lesson selected)

### Tests to create
- `src/app/api/ai/__tests__/glossary.test.ts`

## Todo List (Phase 5b)
- [x] Add `glossary` field to Course schema
- [x] Create glossary aggregation AI prompt
- [x] Create `/api/ai/glossary` route
- [x] Create `GlossaryPanel.tsx` with search/filter
- [x] Integrate GlossaryPanel into AIAssistantPanel (course-level, book only)
- [x] Write tests
- [x] Run quality gate

## Success Criteria (Phase 5b)
- [x] Glossary aggregates all concepts from all chapters, deduplicated
- [x] Glossary alphabetically sorted, searchable in UI
- [x] Only shows for book contentType
- [x] All tests pass, build succeeds

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI JSON output parsing fails | Medium | Medium | Robust parsing with fallback; retry once |
| Concepts extraction too slow for large chapters | Medium | Low | Truncate to 8000 chars; batch if needed |
| Glossary too large for single AI call | Low | Medium | Chunk into groups of 5 chapters; merge results |
| Duplicate terms across chapters | High | Low | AI deduplication in glossary prompt |
| Phase 5b never needed after 5a | Medium | Low | Product gate prevents waste |

## Security Considerations
- Validate JSON structure before persisting
- Sanitize AI output (strip any HTML/scripts)
- Content length limits on keyConcepts and glossary fields
