# Spec: Phase 6 — UX Overhaul (Target: 9.5+ All Categories)

## Goal
Nâng cấp toàn diện trải nghiệm người dùng của Udemy Learner từ mức MVP (4.2/10) lên production-grade (9.5+/10) trên 8 tiêu chí: Visual Design, Information Architecture, Interaction Design, Content Presentation, Responsive/Adaptive, Accessibility, Error Handling & Feedback, Onboarding & Learnability.

## Phạm vi thay đổi

Chia thành 3 sub-phase theo priority:
- **6A — Critical** (Showstoppers): Markdown rendering, URL routing, Responsive layout, Transcript height
- **6B — Major** (Significant impact): Search/filter, Regenerate confirmation, CRUD gaps, lang fix, Settings validation, Chat warning
- **6C — Polish** (Enhancement): Toast system, Skeleton loading, Keyboard shortcuts, DnD upload, Empty states, Progress indicators, Lesson reorder

---

## 6A — CRITICAL FIXES

### 6A.1 Markdown Rendering cho AI Output

**User Stories:**
- Là học viên, tôi muốn nội dung AI (tóm tắt, giải thích, lộ trình) hiển thị đẹp với headings, bold, lists, code blocks thay vì raw markdown text

**Acceptance Criteria:**
- [ ] Tab Summary: AI output rendered as formatted markdown (headings, bold, italic, lists, code blocks, tables)
- [ ] Tab Explain: tương tự Summary
- [ ] Tab Roadmap: tương tự Summary
- [ ] Tab Chat: tin nhắn AI rendered markdown; tin nhắn user hiển thị plain text
- [ ] Fallback của FlashcardDeck (khi parse fail) render markdown thay vì `<pre>`
- [ ] Fallback của ExerciseList (khi parse fail) render markdown thay vì `<pre>`
- [ ] Code blocks có syntax highlighting cơ bản (tối thiểu mono font + background)
- [ ] Dark mode styling đúng cho tất cả markdown elements
- [ ] Long content không bị tràn container (overflow handling)

**Edge Cases:**
- AI trả về HTML tags trong markdown → sanitize (XSS prevention)
- AI trả về code blocks rất rộng → horizontal scroll trong code block, không break layout
- AI trả về tables → responsive table với horizontal scroll

**Thư viện:** `react-markdown` + `remark-gfm` (GFM tables, strikethrough) + `rehype-highlight` hoặc `rehype-prism-plus` (syntax highlight)

**Files thay đổi:**
- `src/components/AIAssistantPanel.tsx` — thay `whitespace-pre-wrap` bằng `<ReactMarkdown>`
- `src/components/FlashcardDeck.tsx` — fallback render
- `src/components/ExerciseList.tsx` — fallback render
- `src/components/MarkdownRenderer.tsx` — NEW: shared markdown component
- `package.json` — thêm dependencies

---

### 6A.2 URL-Based Navigation (Search Params)

**User Stories:**
- Là học viên, tôi muốn bookmark bài học đang xem để quay lại nhanh
- Là học viên, tôi muốn refresh trang mà không mất vị trí đang xem
- Là học viên, tôi muốn dùng browser Back/Forward để điều hướng

**Acceptance Criteria:**
- [ ] URL chứa search params: `?course={courseId}&lesson={lessonId}&tab={tabName}`
- [ ] Khi load trang: đọc search params → auto-select course, lesson, tab tương ứng
- [ ] Khi user chọn course/lesson/tab → update search params (không full page reload)
- [ ] Browser Back/Forward hoạt động đúng (popstate event handling)
- [ ] URL params không hợp lệ (course/lesson không tồn tại) → fallback về trạng thái trống, không crash
- [ ] Share URL cho người khác → mở đúng bài học (nếu họ có data)

**Edge Cases:**
- Course ID trong URL đã bị xóa → clear params, hiển thị empty state
- Lesson ID thuộc course khác → ignore lesson param, chỉ select course
- Tab name không hợp lệ → default về tab "summary"
- Multiple rapid navigation → debounce URL updates

**Approach:** Sử dụng `next/navigation` `useSearchParams` + `useRouter`. KHÔNG dùng dynamic routes (quá nhiều refactor). Search params là balance tốt giữa effort và UX.

**Files thay đổi:**
- `src/app/page.tsx` — thay useState bằng useSearchParams, sync state ↔ URL
- `src/hooks/useUrlState.ts` — NEW: custom hook for URL state management

---

### 6A.3 Responsive Layout

**User Stories:**
- Là học viên, tôi muốn dùng app trên điện thoại khi đi lại
- Là học viên, tôi muốn dùng app trên tablet khi nằm đọc

**Acceptance Criteria:**
- [ ] Mobile (< 768px): Sidebar ẩn mặc định, hiện qua hamburger menu (slide-in overlay)
- [ ] Mobile: Main content chiếm full width, chỉ hiện 1 panel tại 1 thời điểm (Transcript HOẶC AI)
- [ ] Mobile: Toggle button để switch giữa Transcript và AI panel
- [ ] Tablet (768px-1024px): Sidebar collapsible, main content 2-panel
- [ ] Desktop (> 1024px): Layout hiện tại (3-panel) giữ nguyên
- [ ] Sidebar overlay có backdrop + click-outside-to-close
- [ ] Hamburger icon ở Header trên mobile
- [ ] Touch-friendly: tất cả interactive elements ≥ 44px touch target

**Edge Cases:**
- Resize window từ desktop → mobile → sidebar tự collapse
- Mở sidebar overlay → scroll body bị lock
- Orientation change trên tablet → layout adapt

**Files thay đổi:**
- `src/app/page.tsx` — responsive layout logic
- `src/components/Header.tsx` — hamburger button
- `src/components/Sidebar.tsx` — NEW: extract sidebar logic, add mobile overlay
- `src/hooks/useMediaQuery.ts` — NEW: responsive breakpoint hook
- `src/app/globals.css` — responsive utilities nếu cần

---

### 6A.4 Transcript Panel Fill Height

**User Stories:**
- Là học viên, tôi muốn transcript chiếm toàn bộ không gian có sẵn để đọc thoải mái

**Acceptance Criteria:**
- [ ] TranscriptPanel chiếm toàn bộ chiều cao available (không còn `h-80` cố định)
- [ ] Scroll riêng cho transcript content (independent scroll)
- [ ] Trên mobile: transcript chiếm full viewport height (trừ header)

**Files thay đổi:**
- `src/components/TranscriptPanel.tsx` — thay `h-80` bằng `flex-1 min-h-0`
- `src/app/page.tsx` — đảm bảo parent có `flex flex-col h-full`

---

## 6B — MAJOR FIXES

### 6B.1 Search & Filter cho Course/Lesson Lists

**User Stories:**
- Là học viên có 30+ khóa học, tôi muốn tìm nhanh khóa cần xem
- Là học viên đang xem khóa 100+ bài, tôi muốn tìm bài theo tên

**Acceptance Criteria:**
- [ ] Ô tìm kiếm phía trên CourseList — filter realtime theo title (case-insensitive, diacritics-insensitive)
- [ ] Ô tìm kiếm phía trên LessonList — filter realtime theo title
- [ ] Hiện số kết quả: "X / Y khóa học" hoặc "X / Y bài học"
- [ ] Clear button (X) trong search input
- [ ] Khi search active + không có kết quả → hiện "Không tìm thấy"
- [ ] Search input compact (không chiếm quá nhiều sidebar space)
- [ ] List containers sử dụng `flex-1 min-h-0 overflow-y-auto` thay vì `max-h-64`

**Edge Cases:**
- Search text có diacritics (tiếng Việt: "Bài" vs "bai") → normalize before compare
- Rất nhiều kết quả → virtual scroll KHÔNG cần thiết (< 500 items total, DOM handles fine)

**Files thay đổi:**
- `src/components/CourseList.tsx` — thêm search input, remove `max-h-64`
- `src/components/LessonList.tsx` — thêm search input, remove `max-h-64`

---

### 6B.2 Regenerate Confirmation Dialog

**User Stories:**
- Là học viên, tôi muốn được hỏi xác nhận trước khi tạo lại nội dung AI (tốn thời gian và tiền)

**Acceptance Criteria:**
- [ ] Nút "Tạo lại" trên tất cả AI tabs (Summary, Explain, Roadmap, Practice) → hiện AlertDialog xác nhận
- [ ] Dialog text: "Nội dung hiện tại sẽ bị thay thế. Bạn có chắc muốn tạo lại?"
- [ ] Hai nút: "Hủy" (default focus) + "Tạo lại" (destructive style)
- [ ] Chỉ hiện dialog khi đã có cached content. Lần đầu generate → KHÔNG hiện dialog.

**Files thay đổi:**
- `src/components/AIAssistantPanel.tsx` — wrap regenerate actions với AlertDialog

---

### 6B.3 Lesson Deletion

**User Stories:**
- Là học viên, tôi muốn xóa bài học nhập sai hoặc không cần nữa

**Acceptance Criteria:**
- [ ] Nút xóa (trash icon) trên mỗi lesson item trong LessonList
- [ ] AlertDialog xác nhận trước khi xóa
- [ ] `DELETE /api/lessons/[id]` — xóa lesson + cascade AI data
- [ ] Sau khi xóa: nếu lesson đang selected → clear selection
- [ ] Lesson count trong CourseList cập nhật

**API Contract:**
```
DELETE /api/lessons/[id]
Response 200: { "success": true }
Errors: 404 — lesson not found
```

**Data Model Changes:** Không thay đổi schema. Xóa record từ bảng `Lesson`.

**Files thay đổi:**
- `src/components/LessonList.tsx` — thêm delete button + dialog
- `src/app/api/lessons/[id]/route.ts` — NEW: DELETE handler
- `src/app/page.tsx` — callback refresh sau delete

---

### 6B.4 Course Renaming

**User Stories:**
- Là học viên, tôi muốn đổi tên khóa học khi nhập sai hoặc muốn chỉnh lại

**Acceptance Criteria:**
- [ ] Double-click hoặc edit icon trên course title → inline edit mode
- [ ] Enter để confirm, Escape để cancel
- [ ] `PATCH /api/courses/[id]` — update title
- [ ] Title rỗng → không cho save, revert
- [ ] Header + CourseList cập nhật realtime sau rename

**API Contract:**
```
PATCH /api/courses/[id]
Request: { "title": "string" }
Response 200: { "id": "string", "title": "string" }
Errors: 400 — title empty, 404 — not found
```

**Files thay đổi:**
- `src/components/CourseList.tsx` — inline edit UI
- `src/app/api/courses/[id]/route.ts` — thêm PATCH handler

---

### 6B.5 Fix `lang="en"` → `lang="vi"`

**Acceptance Criteria:**
- [ ] `<html lang="vi">` trong layout.tsx
- [ ] Screen reader đọc tiếng Việt đúng giọng

**Files thay đổi:**
- `src/app/layout.tsx` — line 19

---

### 6B.6 Settings Validation

**User Stories:**
- Là học viên, tôi muốn biết ngay nếu cấu hình AI sai để không bị lỗi khi dùng

**Acceptance Criteria:**
- [ ] Base URL: validate format URL (phải bắt đầu `http://` hoặc `https://`)
- [ ] Base URL sai format → hiện inline error "URL không hợp lệ"
- [ ] API Key: nút "Test kết nối" → gọi `POST /api/ai/models` → hiện kết quả (✅ thành công / ❌ lỗi)
- [ ] Required fields (Base URL, API Key, Model) có asterisk (*) indicator
- [ ] Empty required field khi save → highlight field + error message

**Files thay đổi:**
- `src/components/SettingsModal.tsx` — validation logic + UI feedback

---

### 6B.7 Chat Leave Warning

**User Stories:**
- Là học viên, tôi muốn được cảnh báo trước khi mất lịch sử chat khi chuyển bài

**Acceptance Criteria:**
- [ ] Khi đang có chat messages (> 0) + user click lesson khác → hiện confirm dialog
- [ ] Dialog: "Chuyển bài sẽ xóa lịch sử chat. Tiếp tục?"
- [ ] "Tiếp tục" → switch lesson, clear chat. "Ở lại" → cancel navigation
- [ ] Nếu chat rỗng → switch bình thường, không hỏi

**Files thay đổi:**
- `src/app/page.tsx` — intercept lesson selection khi có active chat
- `src/components/AIAssistantPanel.tsx` — expose chat message count

---

## 6C — POLISH

### 6C.1 Toast Notification System

**Acceptance Criteria:**
- [ ] Global toast provider (dùng `sonner` — đã compatible với shadcn/ui)
- [ ] Toast cho: save transcript success/error, AI generation error, delete success, rename success
- [ ] Toast position: bottom-right
- [ ] Auto-dismiss: 3 giây cho success, 5 giây cho error
- [ ] Dark mode compatible

**Files thay đổi:**
- `src/app/layout.tsx` — thêm `<Toaster />`
- `package.json` — thêm `sonner`
- Tất cả components có feedback → chuyển sang `toast()`

---

### 6C.2 Loading Skeletons

**Acceptance Criteria:**
- [ ] CourseList: skeleton khi đang fetch courses
- [ ] LessonList: skeleton khi đang fetch lessons
- [ ] TranscriptPanel: skeleton khi đang load transcript
- [ ] AI tabs: skeleton khi đang load cached AI data
- [ ] Skeleton component dùng `shadcn/ui` Skeleton primitive

**Files thay đổi:**
- `src/components/CourseList.tsx`, `LessonList.tsx`, `TranscriptPanel.tsx`, `AIAssistantPanel.tsx`

---

### 6C.3 AI Generation Progress

**Acceptance Criteria:**
- [ ] Khi AI đang generate: hiện animated dots hoặc typing indicator thay vì chỉ "Đang xử lý..."
- [ ] Hiện elapsed time "Đang tạo... (12s)"
- [ ] Cancel button để hủy request đang chạy (AbortController)

**Files thay đổi:**
- `src/components/AIAssistantPanel.tsx` — progress UI + abort

---

### 6C.4 Keyboard Shortcuts

**Acceptance Criteria:**
- [ ] `Ctrl+S` — Save transcript (khi đang edit)
- [ ] `Alt+1..5` — Switch AI tabs (Summary, Explain, Chat, Roadmap, Practice)
- [ ] `Alt+↑/↓` — Navigate previous/next lesson
- [ ] `Ctrl+K` — Focus search (course hoặc lesson, tùy context)
- [ ] `Escape` — Close modal/dialog
- [ ] Shortcuts hiển thị tooltip khi hover button tương ứng
- [ ] Không conflict với browser shortcuts
- [ ] Shortcuts disabled khi đang type trong input/textarea

**Files thay đổi:**
- `src/hooks/useKeyboardShortcuts.ts` — NEW: global shortcut manager
- Các components liên quan — thêm tooltip hints

---

### 6C.5 Drag-and-Drop File Upload

**Acceptance Criteria:**
- [ ] UploadModal: dropzone cho drag-and-drop files
- [ ] Visual feedback khi dragging (border highlight, "Thả file vào đây")
- [ ] Support cả drag single files và multiple files
- [ ] Drag non-supported file types → visual warning

**Files thay đổi:**
- `src/components/UploadModal.tsx` — DnD zone

---

### 6C.6 Enhanced Empty States

**Acceptance Criteria:**
- [ ] No courses: illustration + "Bắt đầu bằng cách thêm khóa học" + quick action buttons (Import / Upload / Tạo thủ công)
- [ ] No lessons: "Khóa học trống" + action buttons (Upload transcript / Thêm bài thủ công)
- [ ] No transcript: "Chưa có transcript" + action (Upload file / Nhập thủ công)
- [ ] First-time user: brief onboarding tooltip hoặc welcome card (one-time, dismissible)

**Files thay đổi:**
- `src/app/page.tsx` — enhanced empty state panels
- `src/components/OnboardingCard.tsx` — NEW: first-time experience

---

### 6C.7 Lesson Reorder (Drag-to-Reorder)

**Acceptance Criteria:**
- [ ] Drag handle trên mỗi lesson item
- [ ] Drag-and-drop để thay đổi thứ tự
- [ ] `PATCH /api/courses/[id]/lessons/reorder` — update order field
- [ ] Optimistic UI update + rollback on error

**API Contract:**
```
PATCH /api/courses/[courseId]/lessons/reorder
Request: { "lessonIds": ["id1", "id2", "id3", ...] }
Response 200: { "success": true }
```

**Thư viện:** `@dnd-kit/core` + `@dnd-kit/sortable`

**Files thay đổi:**
- `src/components/LessonList.tsx` — DnD sortable
- `src/app/api/courses/[id]/lessons/reorder/route.ts` — NEW

---

### 6C.8 Transcript Edit Mode

**Acceptance Criteria:**
- [ ] TranscriptPanel mặc định ở **read mode** (prose-styled, dễ đọc)
- [ ] Nút "Chỉnh sửa" → switch sang **edit mode** (textarea)
- [ ] Nút "Lưu" + "Hủy" trong edit mode
- [ ] Unsaved changes indicator (dot hoặc asterisk trên nút)
- [ ] Chuyển bài khi có unsaved changes → warning dialog

**Files thay đổi:**
- `src/components/TranscriptPanel.tsx` — read/edit mode toggle

---

## Dependencies mới (package.json)

```json
{
  "react-markdown": "^9.x",
  "remark-gfm": "^4.x",
  "rehype-highlight": "^7.x",
  "sonner": "^1.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x"
}
```

## Data Model Changes

Không thay đổi Prisma schema. Tất cả thay đổi ở UI layer + 2 API endpoints mới:
- `DELETE /api/lessons/[id]`
- `PATCH /api/courses/[id]` (title update)
- `PATCH /api/courses/[id]/lessons/reorder`

## Tiêu chí hoàn thành Phase 6

- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] `npm run test` — all tests pass (existing + new)
- [ ] Lighthouse Accessibility score ≥ 90
- [ ] Tất cả acceptance criteria checked
- [ ] Manual test trên Chrome (desktop + mobile emulation)
