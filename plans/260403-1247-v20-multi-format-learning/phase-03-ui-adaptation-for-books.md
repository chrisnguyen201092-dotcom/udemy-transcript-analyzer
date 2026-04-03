# Phase 3: UI Adaptation for Books

## Context Links
- PRD: `docs/prd.md` Section 6.15 (B-13..B-16)
- Design: `docs/design-guidelines.md`
- Components: `src/components/` (CourseList, LessonList, TranscriptPanel, AIAssistantPanel, Header)
- Page: `src/app/page.tsx`

## Overview
- **Priority:** HIGH — essential for distinguishing book vs course UX
- **Status:** ✅ Complete
- **Effort:** 3-4 days
- **Description:** Adapt UI labels, icons, and badges throughout the app to distinguish book content from video courses. When `contentType === "book"`: "Khóa học" → "Sách", "Bài học" → "Chương", "Transcript" → "Nội dung chương".
- **Completed:** 2026-04-03

## Key Insights
- `CourseList.tsx` already shows book badge (📖) and uses "chương" for books — partial implementation exists
- `LessonList.tsx` has `contentType` prop and `onReSplit` for book re-splitting
- `TranscriptPanel.tsx` needs label change: "Transcript" → "Nội dung chương" (rename component reference to ContentPanel)
- `AIAssistantPanel.tsx` tab labels may need context-aware text; add "Chapter" label for book lessons
- `UploadModal.tsx` already has book mode with separate form
- `AddCoursePanel.tsx` needs "Thêm sách" option alongside "Thêm khóa học"
- All AI prompts already adapted — this phase is purely UI
- Dashboard widgets (Continue Learning, My Courses, Study Stats) need book icon/label
- Empty dashboard state: needs "Upload a book" prompt alongside "Import from Udemy"
- Settings page: no change needed (settings are user-level, not content-type-specific)

## Requirements

### Functional (from PRD B-13..B-16)
- B-13: Sidebar shows "Sách" instead of "Khóa học", "Chương" instead of "Bài học" when `contentType === "book"`
- B-14: Icon/badge distinguishes book vs course in CourseList (already partial)
- B-15: Show author, ISBN (if present) in sidebar when book selected
- B-16: TranscriptPanel (ContentPanel) shows "Nội dung chương" instead of "Transcript" for books

### Additional UI requirements
- U1: LessonList header changes: "Danh sách bài học" → "Danh sách chương" for books
- U2: AIAssistantPanel context labels: "bài học" → "chương" in tab descriptions; add "Chapter" label for book lessons
- U3: Empty states adapted: "Chưa có chương nào" for books
- U4: AddCoursePanel: add "Upload sách" shortcut button
- U5: Lesson count label: "N bài học" → "N chương" (already partial in CourseList)

### UI Surface Inventory (complete)
| Surface | Action | Notes |
|---------|--------|-------|
| CourseList | ✅ Already planned | book badge, author under title |
| LessonList | ✅ Already planned | header, empty state, count label |
| AddCoursePanel | ✅ Already planned | "Upload sách" shortcut |
| TranscriptPanel → ContentPanel | ✅ Already planned | rename label "Nội dung chương" |
| AIAssistantPanel | ✅ Already planned | "chương" labels + "Chapter" for book lessons |
| Dashboard: Continue Learning widget | Needs book icon/label when item is a book |
| Dashboard: My Courses widget | Needs 📖 icon for book items |
| Dashboard: Study Stats widget | May show "chương đã đọc" label for books |
| Dashboard: Empty state | Add "Upload a book" prompt alongside "Import from Udemy" |
| Settings page | No change needed — settings are user-level |

### Non-Functional
- NF1: No layout shift when switching between book and course
- NF2: Consistent color scheme: books use amber accent, courses use default purple

## Architecture

### Content-Type Label Map
```ts
const LABELS = {
  course: { entity: "Khóa học", lesson: "Bài học", content: "Transcript", lessons: "Danh sách bài học" },
  book:   { entity: "Sách",     lesson: "Chương",   content: "Nội dung chương", lessons: "Danh sách chương" },
};
```

Create a shared utility or hook to provide labels based on contentType.

## Related Code Files

### Files to modify
- `src/components/TranscriptPanel.tsx` — "Transcript" → "Nội dung chương" for books
- `src/components/LessonList.tsx` — header label, empty state label adaptation
- `src/components/AIAssistantPanel.tsx` — context-aware tab descriptions
- `src/components/AddCoursePanel.tsx` — add "Upload sách" shortcut
- `src/components/CourseList.tsx` — enhance book metadata display (author under title)
- `src/app/page.tsx` — pass contentType to child components that need it

### Files to create
- `src/lib/content-type-labels.ts` — shared label map utility (~30 lines)

### Tests to update
- `src/components/__tests__/TranscriptPanel.test.tsx` — test book label rendering

## Implementation Steps

### Step 1: Create content-type label utility
Create `src/lib/content-type-labels.ts`:
```ts
export type ContentTypeKey = "course" | "book";
export interface ContentLabels {
  entity: string;      // "Khóa học" | "Sách"
  lesson: string;      // "Bài học" | "Chương"
  lessons: string;     // "Danh sách bài học" | "Danh sách chương"
  content: string;     // "Transcript" | "Nội dung chương"
  addLesson: string;   // "Thêm bài học" | "Thêm chương"
  noLessons: string;   // "Chưa có bài học" | "Chưa có chương nào"
  lessonCount: (n: number) => string;  // "N bài học" | "N chương"
}
export function getLabels(contentType: string): ContentLabels;
```

### Step 2: Update TranscriptPanel (rename reference to ContentPanel)
- Accept `contentType` prop
- Use labels for panel header: "Transcript bài học" → "Nội dung chương"
- Update edit mode label accordingly
- No file rename needed — update internal labels and references only

### Step 3: Update LessonList
- Already has `contentType` prop — use labels for header, empty state, count
- Update "Thêm bài học" button text for books

### Step 4: Update AIAssistantPanel
- Accept `contentType` prop
- Adjust tooltip/description text referencing "bài học" → "chương"
- Add "Chapter" label for book lessons where relevant
- No changes to actual AI calls (prompts already handled)

### Step 5: Update CourseList
- Enhance book display: show author below title when available
- Show ISBN badge if present
- Distinct icon: 📖 for books (already done), video icon for courses

### Step 6: Update AddCoursePanel
- Add "Upload sách" button/option that opens UploadModal in book mode
- Visual distinction between "Thêm khóa học" and "Upload sách"

### Step 7: Update Dashboard widgets
- Continue Learning widget: show 📖 icon + "Chương" label for book items
- My Courses widget: show 📖 icon for book entries
- Study Stats widget: use "chương đã đọc" label when displaying book progress
- Empty dashboard state: add "Upload a book" prompt alongside "Import from Udemy"
- (Settings page: no changes needed)

### Step 8: Pass contentType through page.tsx
- Ensure `selectedCourse.contentType` is passed to all child components that need labels

## Todo List
- [x] Create `content-type-labels.ts` utility
- [x] Update TranscriptPanel (ContentPanel) with contentType-aware labels
- [x] Update LessonList header and empty states
- [x] Update AIAssistantPanel descriptions + "Chapter" label for book lessons
- [x] Enhance CourseList book metadata display
- [x] Add "Upload sách" to AddCoursePanel
- [x] Update Dashboard widgets (Continue Learning, My Courses, Study Stats)
- [x] Update Dashboard empty state with "Upload a book" prompt
- [x] Pass contentType through page.tsx to children
- [x] Update component tests
- [x] Run quality gate

## Success Criteria
- [x] When viewing a book: all labels say "Sách/Chương/Nội dung chương"
- [x] When viewing a course: all labels remain "Khóa học/Bài học/Transcript"
- [x] Book metadata (author, ISBN) visible in sidebar
- [x] No visual regression for existing course features
- [x] All tests pass, build succeeds

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing contentType prop somewhere | Medium | Low | Grep for hardcoded "Bài học"/"Transcript" strings |
| Breaking existing course UI | Low | High | Test both content types before merge |
| Inconsistent label usage | Medium | Low | Centralize in utility; code review |
