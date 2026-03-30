# Thứ tự Implementation

> **Nguyên tắc:** Implement theo dependency order — module sau phụ thuộc module trước.
> Mỗi phase phải pass `npm run quality-gate` trước khi chuyển sang phase tiếp theo.

---

## Trạng thái: ✅ Tất cả Phase đã hoàn thành

Toàn bộ Phase 1–5 đã được implement, test, và deploy thành công.

---

## Critical Path (con đường ngắn nhất để có app chạy được)

```
1.1 DB → 1.3 Course → 2.1 Lesson → 2.3 Transcript → 3.1 Persistence → 3.2 Summary
```

AI Settings (1.2) có thể implement song song với 1.3 vì cả hai chỉ cần 1.1.

---

## Phase 1 — Foundation ✅

### 1.1 Prisma Schema & DB Setup ✅
**Files:** `prisma/schema.prisma`, `prisma/dev.db`
**Lý do:** Tất cả modules đều cần DB.
**Done when:** `npx prisma db push` thành công, models `Course` và `Lesson` tồn tại.

### 1.2 AI Settings (F-51..F-55) ✅
**Spec:** `docs/specs/ai-settings.md`
**Files:** `src/app/api/ai/models/route.ts`, `src/components/SettingsModal.tsx`
**Phụ thuộc:** 1.1
**Parallel với:** 1.3 (không phụ thuộc nhau)
**Done when:** User nhập base URL + API key + chọn model, lưu vào localStorage, hiển thị trên Header.

### 1.3 Course Management (F-01..F-07) ✅
**Spec:** `docs/specs/course-management.md`
**Files:** `src/app/api/courses/route.ts`, `src/app/api/courses/[id]/route.ts`, `src/app/api/udemy/courses/route.ts`, `src/app/api/udemy/import/route.ts`, `src/components/CourseList.tsx`, `src/components/AddCoursePanel.tsx`, `src/components/ImportModal.tsx`
**Phụ thuộc:** 1.1
**Parallel với:** 1.2 (không phụ thuộc nhau)
**Done when:** Import từ Udemy, tạo thủ công, xóa khóa học đều hoạt động; danh sách hiển thị trong sidebar.

---

## Phase 2 — Lesson & Transcript ✅

### 2.1 Lesson Management (F-08..F-10) ✅
**Spec:** `docs/specs/lesson-management.md`
**Files:** `src/app/api/courses/[id]/lessons/route.ts`, `src/components/LessonList.tsx`
**Phụ thuộc:** 1.3
**Done when:** Thêm bài học thủ công, hiển thị danh sách theo `order`, click để select.

### 2.2 Upload File Transcript (F-11..F-16) ✅
**Spec:** `docs/specs/upload-transcript.md`
**Files:** `src/app/api/courses/upload/route.ts`, `src/components/UploadModal.tsx`
**Phụ thuộc:** 2.1
**Parallel với:** 2.3 (cùng phụ thuộc 2.1, không phụ thuộc nhau)
**Done when:** Upload `.vtt`/`.srt`/`.txt`, parse đúng format, tạo bài học mới với transcript.

### 2.3 Transcript View & Edit (F-17..F-19) ✅
**Spec:** `docs/specs/transcript.md`
**Files:** `src/app/api/lessons/[id]/transcript/route.ts`, `src/components/TranscriptPanel.tsx`
**Phụ thuộc:** 2.1
**Parallel với:** 2.2 (cùng phụ thuộc 2.1, không phụ thuộc nhau)
**Done when:** Xem và edit transcript, lưu thành công, hiển thị toast.

---

## Phase 3 — AI Features ✅

### 3.1 AI Persistence Layer (F-47..F-50) ✅
**Spec:** `docs/specs/ai-persistence.md`
**Files:** `src/app/api/lessons/[id]/ai/route.ts`, `src/app/api/courses/[id]/ai/route.ts`
**Phụ thuộc:** 2.1 + 1.3
**Done when:** `GET /api/lessons/[id]/ai` và `GET /api/courses/[id]/ai` trả đúng dữ liệu.

### 3.2 AI Summary (F-20..F-25) ✅
**Spec:** `docs/specs/ai-summary.md`
**Files:** `src/app/api/ai/summary/route.ts`, `src/components/AIAssistantPanel.tsx` (tab Summary)
**Phụ thuộc:** 3.1 + 1.2
**Done when:** Tạo summary, persist vào DB, load lại khi chọn bài, nút "Tạo lại" hoạt động.

### 3.3 AI Explain (F-26..F-30) ✅
**Spec:** `docs/specs/ai-explain.md`
**Files:** `src/app/api/ai/explain/route.ts`, tab Explain trong `AIAssistantPanel`
**Phụ thuộc:** 3.1 + 1.2
**Done when:** Tạo explanation với format phân loại đúng, persist, load lại.

### 3.4 AI Chat (F-31..F-35) ✅
**Spec:** `docs/specs/ai-chat.md`
**Files:** `src/app/api/ai/chat/route.ts`, tab Chat trong `AIAssistantPanel`
**Phụ thuộc:** 1.2 (settings) + 2.3 (transcript)
**Done when:** Chat nhiều lượt, streaming hoạt động, reset khi đổi bài học.

### 3.5 AI Practice (F-36..F-41) ✅
**Spec:** `docs/specs/ai-practice.md`
**Files:** `src/app/api/ai/quiz/route.ts`, tab Practice trong `AIAssistantPanel`
**Phụ thuộc:** 3.1 + 1.2
**Done when:** Quiz/Flashcard/Bài tập được tạo, parse đúng, persist và load lại.

### 3.6 AI Roadmap (F-42..F-46) ✅
**Spec:** `docs/specs/ai-roadmap.md`
**Files:** `src/app/api/ai/roadmap/route.ts`, tab Roadmap trong `AIAssistantPanel`
**Phụ thuộc:** 3.1 + 1.3 (cần toàn bộ lessons của course)
**Done when:** Roadmap được tạo từ tất cả transcripts, persist vào `Course.roadmap`, load lại.

---

## Phase 4 — Polish & Infrastructure ✅

### 4.1 Error Handling & Loading States ✅
**Scope:** Tất cả components — loading skeleton, error messages, toast notifications.
**Done when:** Không có UI nào bị blank hoặc crash khi AI lỗi hoặc network chậm.

### 4.2 Unit Tests (coverage ≥ 80%) ✅
**Scope:** Business logic: parse functions (VTT/SRT), AI prompt builders, API route handlers.
**Done when:** 163/163 tests passing.

### 4.3 E2E Tests (smoke) ✅
**Scope:** Happy paths cho 3 flows chính.
**Done when:** Tests pass.

### 4.4 Docker & Deployment ✅
**Files:** `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`
**Done when:** `docker compose up -d --build` hoạt động, app accessible tại `localhost:3939`.

---

## Phase 5 — UX Improvements & Multi-Profile ✅ (v1.1)

### 5.1 AI Cache Guard + Force Regenerate ✅
**Scope:** Tất cả AI routes (summary, explain, quiz, roadmap) — kiểm tra DB trước khi gọi AI.
**Files:** `src/app/api/ai/summary/route.ts`, `explain/route.ts`, `quiz/route.ts`, `roadmap/route.ts`
**Done when:** Routes trả về cached result nếu có; `force: true` bypass cache.

### 5.2 Folder Upload (webkitdirectory) ✅
**Scope:** UploadModal hỗ trợ chọn thư mục.
**Files:** `src/components/UploadModal.tsx`
**Done when:** Nút "Chọn thư mục" hoạt động, lọc file theo extension.

### 5.3 AI Context Enrichment ✅
**Scope:** User messages gửi kèm lessonIndex/totalLessons.
**Files:** `src/app/page.tsx`, `src/components/AIAssistantPanel.tsx`
**Done when:** AI biết vị trí bài học trong khóa.

### 5.4 Interactive Practice Components ✅
**Scope:** QuizPlayer, FlashcardDeck, ExerciseList.
**Files:** `src/components/QuizPlayer.tsx`, `FlashcardDeck.tsx`, `ExerciseList.tsx`
**Done when:** Quiz clickable, flashcard flip, exercises accordion.

### 5.5 Multi-Profile AI Settings ✅
**Scope:** Tạo/chuyển/xóa nhiều profile AI; auto-migrate.
**Files:** `src/components/SettingsModal.tsx`, `src/components/Header.tsx`
**Done when:** Multiple profiles in localStorage; Header hiển thị active profile/model.

### 5.6 Upload Creates Course ✅
**Scope:** UploadModal tạo khóa học mới khi không có course nào được chọn.
**Files:** `src/components/UploadModal.tsx`, `src/app/api/courses/upload/route.ts`
**Done when:** Nhập tên course → upload file → course tạo mới → auto-select.

### 5.7 Bug Fixes ✅
- ImportModal: error message hiển thị đúng (trước đó `{error}` bị thiếu trong `<p>`)
- AddCoursePanel: upload button luôn enabled (revert disabled-when-no-course logic)

---

## Dependency Graph

```
Phase 1.1 (DB)
├── Phase 1.2 (Settings) ──────────────────────────────┐
│                                                       │
└── Phase 1.3 (Course)                                  │
    └── Phase 2.1 (Lesson)                              │
        ├── Phase 2.2 (Upload)    ← parallel với 2.3   │
        │                                               │
        ├── Phase 2.3 (Transcript) ← parallel với 2.2  │
        │   └── Phase 3.4 (Chat) ──── cần 1.2 + 2.3   │
        │                                               │
        └── Phase 3.1 (AI Persistence) ────────────────┤
            ├── Phase 3.2 (Summary)  ←┐                │
            ├── Phase 3.3 (Explain)  ←┤ parallel       │
            ├── Phase 3.5 (Practice) ←┘ nhau           │
            └── Phase 3.6 (Roadmap) ← cần 3.1 + 1.3   │
                                                        │
AI Settings 1.2 ────────────────────────────────────────┘
(cần cho tất cả AI routes: 3.1..3.6)

Phase 4 (Polish) ← sau Phase 3
Phase 5 (UX Improvements) ← sau Phase 4
```

---

## Phase 6 — UX Overhaul (Target: 9.5+ All Categories)

**Spec:** `docs/specs/ux-overhaul.md`
**Branch:** `feat/ux-overhaul`
**Phụ thuộc:** Phase 5

### 6A — Critical Fixes

```
6A.1 Markdown Rendering ←── standalone, no deps
6A.4 Transcript Fill Height ←── standalone, no deps
         ↓
6A.2 URL Navigation ←── depends on page.tsx refactor
         ↓
6A.3 Responsive Layout ←── depends on page.tsx refactor from 6A.2
```

#### 6A.1 Markdown Rendering cho AI Output ✅ (pending)
**Files:** `src/components/MarkdownRenderer.tsx` (NEW), `AIAssistantPanel.tsx`, `FlashcardDeck.tsx`, `ExerciseList.tsx`
**Done when:** AI output rendered as formatted markdown with syntax highlighting.

#### 6A.2 URL-Based Navigation
**Files:** `src/hooks/useUrlState.ts` (NEW), `src/app/page.tsx`
**Phụ thuộc:** 6A.1 (page.tsx changes)
**Done when:** URL search params sync with app state; refresh preserves position; Back/Forward work.

#### 6A.3 Responsive Layout
**Files:** `src/components/Sidebar.tsx` (NEW), `src/hooks/useMediaQuery.ts` (NEW), `Header.tsx`, `page.tsx`, `globals.css`
**Phụ thuộc:** 6A.2 (page.tsx changes)
**Done when:** Mobile sidebar overlay, tablet collapsible, desktop 3-panel.

#### 6A.4 Transcript Panel Fill Height
**Files:** `src/components/TranscriptPanel.tsx`, `src/app/page.tsx`
**Done when:** Transcript fills available height with independent scroll.

### 6B — Major Fixes

All 6B items are independent of each other (parallel-safe).

#### 6B.1 Search & Filter (CourseList + LessonList)
**Files:** `CourseList.tsx`, `LessonList.tsx`
**Done when:** Realtime search filter with result count.

#### 6B.2 Regenerate Confirmation Dialog
**Files:** `AIAssistantPanel.tsx`
**Done when:** AlertDialog before regenerate when cached content exists.

#### 6B.3 Lesson Deletion
**Files:** `LessonList.tsx`, `src/app/api/lessons/[id]/route.ts` (ADD DELETE), `page.tsx`
**Done when:** Delete lesson via UI + API, selection cleared if deleted.

#### 6B.4 Course Renaming
**Files:** `CourseList.tsx`, `src/app/api/courses/[id]/route.ts` (ADD PATCH)
**Done when:** Inline rename via double-click or edit icon.

#### 6B.5 Fix `lang="vi"`
**Files:** `layout.tsx`
**Done when:** `<html lang="vi">`.

#### 6B.6 Settings Validation
**Files:** `SettingsModal.tsx`
**Done when:** URL format validation, test connection, required field indicators.

#### 6B.7 Chat Leave Warning
**Files:** `page.tsx`, `AIAssistantPanel.tsx`
**Done when:** Confirm dialog when switching lesson with active chat.

### 6C — Polish

#### 6C.1 Toast System (sonner)
**Files:** `layout.tsx`, all components with feedback
**Done when:** Global toast for success/error.

#### 6C.2 Loading Skeletons
**Files:** `CourseList.tsx`, `LessonList.tsx`, `TranscriptPanel.tsx`, `AIAssistantPanel.tsx`
**Done when:** Skeleton components during data fetching.

#### 6C.3 AI Generation Progress + Cancel
**Files:** `AIAssistantPanel.tsx`
**Done when:** Animated progress with elapsed time + AbortController cancel.

#### 6C.4 Keyboard Shortcuts
**Files:** `src/hooks/useKeyboardShortcuts.ts` (NEW), components with tooltips
**Done when:** Ctrl+S, Alt+1-5, Alt+↑/↓, Ctrl+K, Escape work.

#### 6C.5 DnD File Upload
**Files:** `UploadModal.tsx`
**Done when:** Drag-and-drop dropzone with visual feedback.

#### 6C.6 Enhanced Empty States
**Files:** `page.tsx`, `src/components/OnboardingCard.tsx` (NEW)
**Done when:** Contextual empty states with action buttons + one-time onboarding.

#### 6C.7 Lesson Reorder (dnd-kit)
**Files:** `LessonList.tsx`, `src/app/api/courses/[id]/lessons/reorder/route.ts` (NEW)
**Done when:** Drag-to-reorder with optimistic UI + API persist.

#### 6C.8 Transcript Edit Mode Toggle
**Files:** `TranscriptPanel.tsx`
**Done when:** Read mode (prose) / Edit mode (textarea) toggle with unsaved warning.

### Phase 6 Dependency Graph

```
6A.1 (Markdown) ──┐
6A.4 (Transcript)  ├──→ 6A.2 (URL Nav) ──→ 6A.3 (Responsive)
                   │
                   └──→ 6B.* (all parallel) ──→ 6C.* (all parallel)
```

---

## Ghi chú

- Mỗi phase: viết spec → implement → chạy `npm run quality-gate` → commit
- Không implement Phase N+1 khi Phase N chưa pass quality gate
- Prisma schema thay đổi: `npx prisma db push` (dev) và tạo migration file (prod)
- `Course.url` là `String? @unique` — manual courses dùng `null` thay vì `""` để tránh unique constraint violation
