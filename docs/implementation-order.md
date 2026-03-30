# Thứ tự Implementation

> **Nguyên tắc:** Implement theo dependency order — module sau phụ thuộc module trước.
> Mỗi phase phải pass `npm run quality-gate` trước khi chuyển sang phase tiếp theo.

---

## Critical Path (con đường ngắn nhất để có app chạy được)

```
1.1 DB → 1.3 Course → 2.1 Lesson → 2.3 Transcript → 3.1 Persistence → 3.2 Summary
```

AI Settings (1.2) có thể implement song song với 1.3 vì cả hai chỉ cần 1.1.

---

## Phase 1 — Foundation (Không có dependencies)

### 1.1 Prisma Schema & DB Setup
**Files:** `prisma/schema.prisma`, `prisma/dev.db`
**Lý do:** Tất cả modules đều cần DB.
**Done when:** `npx prisma db push` thành công, models `Course` và `Lesson` tồn tại.

### 1.2 AI Settings (F-51..F-55) ← Chạy song song với 1.3
**Spec:** `docs/specs/ai-settings.md`
**Files:** `src/app/api/ai/models/route.ts`, `src/components/SettingsModal.tsx`
**Phụ thuộc:** 1.1
**Parallel với:** 1.3 (không phụ thuộc nhau)
**Done when:** User nhập base URL + API key + chọn model, lưu vào localStorage, hiển thị trên Header.

### 1.3 Course Management (F-01..F-07) ← Chạy song song với 1.2
**Spec:** `docs/specs/course-management.md`
**Files:** `src/app/api/courses/route.ts`, `src/app/api/courses/[id]/route.ts`, `src/app/api/udemy/courses/route.ts`, `src/app/api/udemy/import/route.ts`, `src/components/CourseList.tsx`, `src/components/AddCoursePanel.tsx`, `src/components/ImportModal.tsx`
**Phụ thuộc:** 1.1
**Parallel với:** 1.2 (không phụ thuộc nhau)
**Lý do:** Không phụ thuộc AI; là entry point cho mọi workflow khác.
**Done when:** Import từ Udemy, tạo thủ công, xóa khóa học đều hoạt động; danh sách hiển thị trong sidebar.

---

## Phase 2 — Lesson & Transcript (Phụ thuộc Phase 1)

### 2.1 Lesson Management (F-08..F-10)
**Spec:** `docs/specs/lesson-management.md`
**Files:** `src/app/api/courses/[id]/lessons/route.ts`, `src/components/LessonList.tsx`
**Phụ thuộc:** 1.3
**Done when:** Thêm bài học thủ công, hiển thị danh sách theo `order`, click để select.

### 2.2 Upload File Transcript (F-11..F-16) ← Chạy song song với 2.3
**Spec:** `docs/specs/upload-transcript.md`
**Files:** `src/app/api/courses/upload/route.ts`, `src/components/UploadModal.tsx`
**Phụ thuộc:** 2.1
**Parallel với:** 2.3 (cùng phụ thuộc 2.1, không phụ thuộc nhau)
**Done when:** Upload `.vtt`/`.srt`/`.txt`, parse đúng format, tạo bài học mới với transcript.

### 2.3 Transcript View & Edit (F-17..F-19) ← Chạy song song với 2.2
**Spec:** `docs/specs/transcript.md`
**Files:** `src/app/api/lessons/[id]/transcript/route.ts`, `src/components/TranscriptPanel.tsx`
**Phụ thuộc:** 2.1
**Parallel với:** 2.2 (cùng phụ thuộc 2.1, không phụ thuộc nhau)
**Done when:** Xem và edit transcript, lưu thành công, hiển thị toast.

---

## Phase 3 — AI Features (Phụ thuộc Phase 2)

### 3.1 AI Persistence Layer (F-47..F-50)
**Spec:** `docs/specs/ai-persistence.md`
**Files:** `src/app/api/lessons/[id]/ai/route.ts`, `src/app/api/courses/[id]/ai/route.ts`
**Phụ thuộc:** 2.1 + 1.3
**Lý do:** Tất cả AI features đều cần persistence — implement trước để tái dụng.
**Done when:** `GET /api/lessons/[id]/ai` và `GET /api/courses/[id]/ai` trả đúng dữ liệu.

### 3.2 AI Summary (F-20..F-25) ← Chạy song song với 3.3, 3.5
**Spec:** `docs/specs/ai-summary.md`
**Files:** `src/app/api/ai/summary/route.ts`, `src/components/AIAssistantPanel.tsx` (tab Summary)
**Phụ thuộc:** 3.1 + 1.2
**Parallel với:** 3.3, 3.5 (cùng phụ thuộc 3.1 + 1.2, không phụ thuộc nhau)
**Done when:** Tạo summary, persist vào DB, load lại khi chọn bài, nút "Tạo lại" hoạt động.

### 3.3 AI Explain (F-26..F-30) ← Chạy song song với 3.2, 3.5
**Spec:** `docs/specs/ai-explain.md`
**Files:** `src/app/api/ai/explain/route.ts`, tab Explain trong `AIAssistantPanel`
**Phụ thuộc:** 3.1 + 1.2
**Parallel với:** 3.2, 3.5 (cùng phụ thuộc 3.1 + 1.2, không phụ thuộc nhau)
**Done when:** Tạo explanation với format phân loại đúng, persist, load lại.

### 3.4 AI Chat (F-31..F-35) ← Chạy song song với 3.1
**Spec:** `docs/specs/ai-chat.md`
**Files:** `src/app/api/ai/chat/route.ts`, tab Chat trong `AIAssistantPanel`
**Phụ thuộc:** 1.2 (settings) + 2.3 (transcript)
**Parallel với:** 3.1 (Chat không cần persistence layer; chỉ cần Settings + Transcript)
**Done when:** Chat nhiều lượt, streaming hoạt động, reset khi đổi bài học.

### 3.5 AI Practice (F-36..F-41) ← Chạy song song với 3.2, 3.3
**Spec:** `docs/specs/ai-practice.md`
**Files:** `src/app/api/ai/quiz/route.ts`, tab Practice trong `AIAssistantPanel`
**Phụ thuộc:** 3.1 + 1.2
**Parallel với:** 3.2, 3.3 (cùng phụ thuộc 3.1 + 1.2, không phụ thuộc nhau)
**Done when:** Quiz/Flashcard/Bài tập được tạo, JSON parse đúng, persist và load lại.

### 3.6 AI Roadmap (F-42..F-46)
**Spec:** `docs/specs/ai-roadmap.md`
**Files:** `src/app/api/ai/roadmap/route.ts`, tab Roadmap trong `AIAssistantPanel`
**Phụ thuộc:** 3.1 + 1.3 (cần toàn bộ lessons của course)
**Done when:** Roadmap được tạo từ tất cả transcripts, persist vào `Course.roadmap`, load lại.

---

## Phase 4 — Polish & Infrastructure (Có thể chạy song song nội bộ)

### 4.1 Error Handling & Loading States ← Song song với 4.2, 4.3, 4.4
**Scope:** Tất cả components — đảm bảo loading skeleton, error messages, toast notifications đầy đủ.
**Done when:** Không có UI nào bị blank hoặc crash khi AI lỗi hoặc network chậm.

### 4.2 Unit Tests (coverage ≥ 80%) ← Song song với 4.1, 4.3, 4.4
**Scope:** Business logic: parse functions (VTT/SRT), AI prompt builders, API route handlers.
**Done when:** `npm run test:coverage` báo ≥ 80% cho `src/lib/` và `src/app/api/`.

### 4.3 E2E Tests (smoke) ← Song song với 4.1, 4.2, 4.4
**Scope:** Happy paths cho 3 flows chính: import Udemy, upload file, tạo AI summary.
**Done when:** `npm run test:e2e` pass trên Chromium.

### 4.4 Docker & Deployment ← Song song với 4.1, 4.2, 4.3
**Spec:** `.ai-workflows/06-deploy.md`
**Files:** `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`
**Done when:** `docker compose up -d --build` hoạt động, app accessible tại `localhost:3000`.

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

Phase 4.1 / 4.2 / 4.3 / 4.4 — song song nội bộ, sau Phase 3
```

### Tóm tắt parallel opportunities

| Parallel Batch | Phases | Unblock sau khi |
|---|---|---|
| Batch A | 1.2 + 1.3 | 1.1 done |
| Batch B | 2.2 + 2.3 | 2.1 done |
| Batch C | 3.1 + 3.4 | 2.3 + 1.2 done |
| Batch D | 3.2 + 3.3 + 3.5 | 3.1 done |
| Batch E | 4.1 + 4.2 + 4.3 + 4.4 | Phase 3 done |

---

## Ghi chú

- Mỗi phase: viết spec → implement → chạy `npm run quality-gate` → commit
- Không implement Phase N+1 khi Phase N chưa pass quality gate
- Prisma schema thay đổi: `npx prisma db push` (dev) và tạo migration file (prod)
- `Course.url` là `String? @unique` — manual courses dùng `null` thay vì `""` để tránh unique constraint violation
