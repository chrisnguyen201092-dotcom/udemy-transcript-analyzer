# Phase 6: Advanced Features (Concept Linking, Knowledge Graph, Cross-Chapter SRS)

## Context Links
- PRD: `docs/prd.md` Section 6.17 (B-24..B-33)
- Phase 5 output: keyConcepts, glossary
- SRS: `src/lib/srs.ts`, `src/app/api/srs/`
- Progress: `src/app/api/courses/[id]/progress/route.ts`

## Overview
- **Priority:** LOW — nice-to-have enhancements for v2.0 release
- **Status:** ✅ Complete
- **Effort:** 5-7 days
- **Dependencies:** Phase 5b (needs glossary aggregation data and routes from Phase 5b)
- **Description:** Advanced book features: concept cross-referencing between chapters, knowledge graph visualization, cross-chapter SRS, and progress-aware study planning.
- **Completed:** 2026-04-03

## Key Insights
- These features build on the glossary data and routes from Phase 5b (which is product-gated)
- Knowledge graph requires client-side rendering library (consider: vis.js, d3-force, or react-flow)
- Cross-chapter SRS extends existing SRS system (SM-2 algorithm already in `srs.ts`)
- Progress-aware replanning can reuse roadmap route with additional context
- YAGNI principle: implement only what delivers clear user value; defer the rest to v3.0

### Scope Decision (YAGNI)
Split into **v2.0 scope** and **deferred to v3.0+**:

**v2.0 (implement):**
- B-24: Concept cross-reference (AI detects related concepts across chapters)
- B-25: UI "Xem thêm ở chương..." links
- B-32: Time-based study plan ("Tôi có 2 tuần" → AI plan)

**Deferred to v3.0+:**
- B-26, B-27: Interactive knowledge graph (high effort, low immediate value)
- B-28: Difficulty-based quiz generation
- B-29: Cross-chapter SRS (complex scheduling changes)
- B-30, B-31: Book-Udemy cross-linking (requires v3.0 multi-source)
- B-33: Progress-aware replanning (needs more usage data)

## Requirements (v2.0 scope only)

### Functional
- B-24: AI detects related concepts across chapters and stores cross-references
- B-25: UI shows "Xem thêm ở chương N" links within AI output or concept panel
- B-32: User inputs available time → AI generates day-by-day reading schedule
- F1: Cross-references stored in glossary JSON (add `relatedChapters` field per concept)
- F2: Study plan route: POST /api/ai/study-plan { courseId, availableDays, hoursPerDay }

### Non-Functional
- NF1: Cross-reference detection < 60s for 20-chapter book
- NF2: Study plan generation < 30s
- NF3: Cross-reference links don't slow down chapter browsing

## Architecture

### Concept Cross-Referencing
```
After glossary generation (Phase 5):
  → AI analyzes all chapter keyConcepts
  → For each concept: identify which other chapters reference same/related concept
  → Store as: concept.relatedChapters = [{ chapterId, chapterTitle, relationship }]
  → Update Course.glossary with enriched data
```

### Cross-Reference UI
```
In KeyConceptsPanel or AI output:
  → Render "Xem thêm:" links for concepts with cross-references
  → Click link → navigate to referenced chapter (change selectedLesson)
  → Highlight relevant section (optional, best-effort)
```

### Time-Based Study Plan
```
POST /api/ai/study-plan
  → Input: courseId, availableDays, hoursPerDay
  → Load: chapters, difficulty (from roadmap), word counts
  → AI generates: day-by-day schedule with chapter assignments
  → Output: { days: [{ day, chapters: [{ id, title, estimatedMinutes }], goals }] }
  → Display in a dedicated panel or modal
```

## Related Code Files

### Files to create
- `src/app/api/ai/study-plan/route.ts` — time-based study plan
- `src/components/StudyPlanPanel.tsx` — display study plan with day-by-day schedule
- `src/components/ConceptCrossRefLinks.tsx` — inline cross-reference links

### Files to modify
- `src/lib/ai/prompts.ts` — add `BOOK_STUDY_PLAN_SYSTEM_PROMPT`
- `src/app/api/ai/glossary/route.ts` — enhance with cross-reference detection
- `src/components/KeyConceptsPanel.tsx` — add cross-reference links
- `src/components/GlossaryPanel.tsx` — show related chapters per concept
- `src/components/AIAssistantPanel.tsx` — add "Kế hoạch đọc" tab/button for books

## Implementation Steps

### Step 1: Enhance glossary with cross-references
Modify glossary aggregation prompt to also detect:
- Same concept appearing in multiple chapters
- Related concepts (prerequisite, builds-on, contrasts-with)
- Store as `relatedChapters` array per concept in glossary JSON

### Step 2: Create cross-reference UI component
`ConceptCrossRefLinks.tsx` (~60 lines):
- Takes a concept with `relatedChapters` array
- Renders clickable links: "Xem thêm ở: Chương 3, Chương 7"
- Click → triggers navigation to that chapter

### Step 3: Integrate cross-ref links into KeyConceptsPanel
- Under each concept definition, show cross-reference links if available
- Use amber color for book cross-references (consistent with book theme)

### Step 4: Create study plan prompt
```
BOOK_STUDY_PLAN_SYSTEM_PROMPT:
- Input: book chapters with difficulty + word count + available time
- Output: day-by-day schedule, estimated reading time per chapter
- Consider: prerequisites, difficulty progression, review sessions
```

### Step 5: Create `/api/ai/study-plan` route
- POST with `courseId`, `availableDays`, `hoursPerDay`
- Load all chapters with metadata
- Call AI for schedule generation
- Return structured JSON plan

### Step 6: Create StudyPlanPanel UI
`StudyPlanPanel.tsx` (~130 lines):
- Input form: "Bạn có bao nhiêu ngày?", "Mỗi ngày bao nhiêu giờ?"
- Display: calendar-like day view with chapter assignments
- Each day: chapter list, estimated time, goals
- Mark completed days (integrate with progress)

### Step 7: Write tests and quality gate

## Todo List
- [x] Enhance glossary prompt with cross-reference detection
- [x] Create `ConceptCrossRefLinks.tsx`
- [x] Integrate cross-ref links into KeyConceptsPanel and GlossaryPanel
- [x] Create study plan AI prompt
- [x] Create `/api/ai/study-plan` route
- [x] Create `StudyPlanPanel.tsx` with time input form
- [x] Integrate study plan into AIAssistantPanel for books
- [x] Write tests
- [x] Run quality gate

## Success Criteria
- [x] Glossary shows related chapters per concept
- [x] Clicking cross-reference link navigates to correct chapter
- [x] Study plan generates realistic schedule based on available time
- [x] Study plan respects chapter difficulty and prerequisites
- [x] Only visible for book contentType
- [x] All tests pass, build succeeds

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI cross-references inaccurate | Medium | Low | Best-effort; user can ignore |
| Study plan overestimates reading speed | Medium | Low | Use conservative estimates; show as suggestion |
| Too many cross-references cluttering UI | Medium | Low | Show top 3 per concept; "show more" toggle |

## Deferred Features (v3.0+)

The following features are **explicitly out of scope for v2.0**:

| Feature | Reason for Deferral |
|---------|-------------------|
| B-26, B-27: Knowledge graph | High effort (new viz library), low immediate ROI |
| B-28: Difficulty-based quiz | Needs more SRS usage data to calibrate |
| B-29: Cross-chapter SRS | Complex scheduling changes to SM-2; risk of regression |
| B-30, B-31: Book-Udemy linking | Requires v3.0 multi-source architecture |
| B-33: Progress-aware replanning | Needs usage data from real book learning sessions |

## Next Steps (after v2.0)
- Collect usage analytics on book features
- Prioritize deferred features based on user feedback
- Plan v3.0 multi-source architecture that unifies books, YouTube, web, code
