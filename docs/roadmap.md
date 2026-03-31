# Lộ trình Implementation — Tối ưu & Ưu tiên

> **Tạo bởi**: AI analysis scan toàn bộ codebase + specs + PRD
> **Ngày**: 2026-03-30
> **Nguyên tắc**: Dependency-first, impact-first, không lặp công — chỉ liệt kê việc CẦN LÀM.

---

## Trạng thái hiện tại

### ✅ Codebase Stabilization & Bug Fixes (2026-03-31 → 2026-04-01) — COMPLETE
Resolved 43 validated issues across race conditions, security validation, and data integrity:
- **Race conditions:** Interactive Prisma transactions, atomic increments, WHERE-gated deletes (H-6, H-7, H-4, M-9, M-10)
- **Security hardening:** SSRF validation (private IP rejection), prompt injection guards, CSV formula injection protection (H-13, H-15, H-19, M-19, M-21, M-22)
- **Data integrity:** Timezone-aware analytics, stream AbortController cleanup, SRS interval floor (H-8, M-4, M-32)
- **Test coverage:** 829/829 passing (100%), zero regressions

**Status:** ✅ Ready for Phase 2 backend-to-UI integration without blocking issues.

---

### ✅ Đã hoàn thành (Phase 1–5): 38/38 core features + 18 backend features (F-57..F-74)
Core app hoạt động đầy đủ: Course/Lesson CRUD, Upload, Transcript, 6 AI features (Summary, Explain, Chat, Practice, Roadmap, Persistence), Multi-Profile Settings, Docker deploy.
Backend Feature Layer (v1.2): Notes, Progress Tracking, SRS, Analytics, Export, Learner Profile, Chat Persistence — tất cả đã verified COMPLETE.

### ✅ Backend Feature Layer — Verified COMPLETE (7 modules, 18 features):

| Module | Routes | Prisma Models | Trạng thái |
|--------|--------|---------------|------------|
| Lesson Notes (F-57..F-58) | `GET/PUT /api/lessons/[id]/notes`, `GET /api/courses/[id]/notes/search` | `Lesson.notes` field | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |
| Progress Tracking (F-59..F-62) | `POST/PATCH /api/lessons/[id]/progress`, `GET /api/courses/[id]/progress` | `LessonProgress`, `CourseProgress` | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |
| SRS Scheduler (F-63..F-66) | `POST /api/lessons/[id]/srs/init`, `POST .../review`, `GET .../due`, `GET /api/srs/dashboard` | `FlashcardReview` (SM-2 fields) | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |
| Learning Analytics (F-67..F-68) | `GET /api/analytics/overview`, `GET /api/analytics/course/[id]` | Phụ thuộc Progress + SRS | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |
| Export (F-69..F-70) | `POST /api/export/course/[id]`, `POST /api/export/lesson/[id]` | — | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |
| Learner Profile (F-71) | `GET/PUT /api/courses/[id]/profile` | `LearnerProfile` | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |
| Chat Persistence (F-72..F-74) | `GET/POST/DELETE /api/lessons/[id]/chat` | `ChatMessage` | ✅ Backend VERIFIED COMPLETE, UI integration pending (Giai đoạn 2) |

### ❌ Chưa implement (Phase 6 UX Overhaul):
- 6A.1 Markdown Rendering — **đã có `MarkdownRenderer.tsx`** (cần verify integration)
- 6A.2–6C.8 — Chưa hoàn thành

---

## 🎯 Lộ trình tối ưu — 4 giai đoạn

### Giai đoạn 1: UX Overhaul Critical (Phase 6A) — ƯU TIÊN CAO NHẤT
> **Lý do**: UX là bottleneck lớn nhất. App hoạt động nhưng UX chưa đạt. Mọi feature mới sẽ bị ảnh hưởng nếu UX core không tốt.

**Thứ tự (có dependency)**:

| # | Task | Dependency | Files chính | Effort |
|---|------|-----------|-------------|--------|
| 1a | ✅ Verify Markdown Rendering | — | `MarkdownRenderer.tsx`, `AIAssistantPanel.tsx` | S |
| 1b | Transcript Fill Height | — | `TranscriptPanel.tsx`, `page.tsx` | S |
| 2 | URL-Based Navigation | 1a (page.tsx changes) | `useUrlState.ts`, `page.tsx` | M |
| 3 | Responsive Layout | 2 (page.tsx refactor) | `Sidebar.tsx` (NEW), `useMediaQuery.ts`, `Header.tsx`, `page.tsx` | L |

**Parallel track (6B — chạy song song sau khi 6A.2 xong)**:

| Task | Files | Effort |
|------|-------|--------|
| Search & Filter (Course + Lesson) | `CourseList.tsx`, `LessonList.tsx` | M |
| Regenerate Confirmation Dialog | `AIAssistantPanel.tsx` | S |
| Lesson Deletion | `LessonList.tsx`, `DELETE /api/lessons/[id]`, `page.tsx` | M |
| Course Renaming | `CourseList.tsx`, `PATCH /api/courses/[id]` | M |
| Fix `lang="vi"` | `layout.tsx` | XS |
| Settings Validation | `SettingsModal.tsx` | S |
| Chat Leave Warning | `page.tsx`, `AIAssistantPanel.tsx` | S |

---

### Giai đoạn 2: Kết nối Backend → UI (Feature mới có backend sẵn)
> **Lý do**: Backend routes ĐÃ CÓ. Chỉ cần xây UI + kết nối. ROI cực cao — ít effort, nhiều giá trị.

**Thứ tự (theo impact giáo dục, dependency-aware)**:

| # | Feature | Đã có Backend | UI cần xây | Impact | Effort |
|---|---------|---------------|------------|--------|--------|
| 1 | **Chat Persistence** | `ChatMessage` model, `/api/lessons/[id]/chat` | Kết nối `AIAssistantPanel.tsx` chat tab load/save messages | 🔥 Cao — users mất chat history mỗi khi đổi lesson | S |
| 2 | **Lesson Notes** | `Lesson.notes`, `/api/lessons/[id]/notes` | Tab Notes trong `AIAssistantPanel` hoặc panel riêng | 🔥 Cao — core learning feature | M |
| 3 | **Progress Tracking** | `LessonProgress`, `CourseProgress`, routes | Checkmarks trên `LessonList`, progress bar trên `CourseList` | 🔥 Cao — motivation + orientation | M |
| 4 | **SRS Flashcard Review** | `FlashcardReview` + SM-2 in `srs.ts`, routes | SRS mode trong `FlashcardDeck.tsx` (due cards, quality rating) | 🔥🔥 Rất cao — spaced repetition = learning effectiveness core | L |
| 5 | **Pre-Assessment** | `LearnerProfile`, `/api/courses/[id]/profile` | Modal/form khi mở course lần đầu, feed vào AI prompts | 🔥 Cao — personalization nền tảng | M |
| 6 | **Export** | `/api/export/course/[id]`, `/api/export/lesson/[id]` | Download buttons trên AI panels | 🔶 Trung bình — convenience | S |
| 7 | **Learning Analytics** | `/api/analytics/*` | Dashboard page/panel mới | 🔶 Trung bình — insight | L |

---

### Giai đoạn 3: UX Polish (Phase 6C)
> **Lý do**: Polish sau khi core features hoạt động. Nâng UX từ 7→9.5.

| Task | Files | Effort |
|------|-------|--------|
| Toast System (sonner) | `layout.tsx`, all components | M |
| Loading Skeletons | `CourseList`, `LessonList`, `TranscriptPanel`, `AIAssistantPanel` | M |
| AI Generation Progress + Cancel | `AIAssistantPanel.tsx` (AbortController) | M |
| Keyboard Shortcuts | `useKeyboardShortcuts.ts` (NEW) | M |
| DnD File Upload | `UploadModal.tsx` | S |
| Enhanced Empty States + Onboarding | `page.tsx`, `OnboardingCard.tsx` | M |
| Lesson Reorder (dnd-kit) | `LessonList.tsx`, `/api/courses/[id]/lessons/reorder` | M |
| Transcript Edit Mode Toggle | `TranscriptPanel.tsx` | S |

---

### Giai đoạn 4: AI Quality Upgrade (từ improvement-plan.md)
> **Lý do**: Nâng chất lượng giáo dục. Cần Pre-Assessment + Progress data trước.

| # | Improvement | Điểm hiện tại → Mục tiêu | Dependency |
|---|-------------|--------------------------|------------|
| 1 | Chat → True Socratic Method | 6.5 → 9.5 | Chat Persistence (GĐ2) |
| 2 | Explain → Adaptive Depth (theo learner level) | 7.0 → 9.5 | Pre-Assessment (GĐ2) |
| 3 | Roadmap → True Personalization (dùng LearnerProfile) | 7.0 → 9.5 | Pre-Assessment (GĐ2) |
| 4 | Summary → Calibrated length (research-backed) | 7.5 → 9.5 | — |
| 5 | Transcript → Search/highlight/timestamps | 6.0 → 9.5 | UX Overhaul (GĐ1) |

---

## Dependency Graph tổng thể

```
GĐ1: UX Overhaul Critical
├── 6A.1 Markdown ──┐
├── 6A.4 Transcript  ├──→ 6A.2 URL Nav ──→ 6A.3 Responsive
│                    │
│                    └──→ 6B.* (parallel)
│
GĐ2: Backend→UI Connection (parallel với 6B/6C sau khi 6A xong)
├── Chat Persistence (standalone)
├── Lesson Notes (standalone)
├── Progress Tracking (standalone)
├── SRS Review (needs flashcards working ✅)
├── Pre-Assessment (standalone)
├── Export (standalone)
└── Analytics (needs Progress + SRS)
│
GĐ3: UX Polish (6C — all parallel)
│
GĐ4: AI Quality (needs GĐ2: Pre-Assessment + Progress + Chat Persistence)
├── Socratic Chat ← Chat Persistence
├── Adaptive Explain ← Pre-Assessment
├── Personal Roadmap ← Pre-Assessment
├── Calibrated Summary (standalone)
└── Rich Transcript ← UX Overhaul
```

---

## Effort Estimation

| Giai đoạn | Tasks | Total Effort | Parallel Potential |
|-----------|-------|--------------|--------------------|
| GĐ1 UX Critical | 4 sequential + 7 parallel | ~3–4 ngày | Cao (6B all parallel) |
| GĐ2 Backend→UI | 7 features | ~5–7 ngày | Rất cao (hầu hết standalone) |
| GĐ3 UX Polish | 8 tasks | ~3–4 ngày | Rất cao (all parallel) |
| GĐ4 AI Quality | 5 upgrades | ~3–5 ngày | Trung bình (prompt changes) |
| **Tổng** | **~24 tasks** | **~14–20 ngày** | |

---

## Quality Gate mỗi giai đoạn

```bash
npm run quality-gate    # Phải pass trước khi chuyển giai đoạn
npm run build           # Zero TypeScript errors
npm run lint            # Zero lint warnings
npm run test            # 163+ tests passing
```

---

## Ghi chú quan trọng

1. **Backend đã verified COMPLETE** — Tất cả 7 backend feature modules (Notes, Progress, SRS, Analytics, Export, Learner Profile, Chat Persistence) đã được audit và xác nhận hoạt động đầy đủ. Chi tiết xem Phase 7 trong `implementation-order.md`.

2. **Docs đã được cập nhật toàn bộ (2026-03-31):**
   - ✅ `features.md` — Rewrite toàn bộ: 21 modules, 56 features, 7 Prisma models, ~42 API routes
   - ✅ `prd.md` — Cập nhật Sections 5, 6, 8.2, 8.3, 8.4, 11 (thêm 7 modules mới F-57..F-74, schema 7 models, ~42 routes)
   - ✅ `implementation-order.md` — Thêm Phase 7 (7 modules) + Full dependency graph
   - ✅ `roadmap.md` — Cập nhật trạng thái từ "cần verify" → "VERIFIED COMPLETE"

3. **SRS là high-impact nhất** — SM-2 algorithm đã implement (`src/lib/srs.ts`), FlashcardReview model đã có, routes đã có. Chỉ cần UI integration → spaced repetition hoạt động ngay.

4. **Pre-Assessment là nền tảng cho personalization** — LearnerProfile model + route đã có. Kết nối vào AI prompts sẽ nâng điểm giáo dục cho Explain, Roadmap, Practice.

5. **Prisma schema: 7 models** — Course, Lesson, LessonProgress, CourseProgress, FlashcardReview, LearnerProfile, ChatMessage.
