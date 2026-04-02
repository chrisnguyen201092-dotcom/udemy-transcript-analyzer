# Development Roadmap — Inkgest

> **Phiên bản tài liệu:** v3.1  
> **Cập nhật lần cuối:** 2026-04-03  
> **Trạng thái:** Đang phát triển (Phase 6 Complete, Phase 7–8 Ready)  

---

## Tổng quan phiên bản

Inkgest phát triển qua 3 giai đoạn lớn, từ "AI-powered Udemy learner" mở rộng thành "multi-source learning hub":

| Phiên bản | Giai đoạn | Tên gọi | Trạng thái | Ngày dự kiến |
|-----------|-----------|--------|-----------|--------------|
| **v1.0–v1.2** | Phase 1–5 | Udemy Learning Assistant | ✅ Hoàn thành | 2026-03-31 |
| **v1.3** | Phase 6–8 | Multi-User Foundation | 🔄 Đang triển khai (Phase 6 ✅) | 2026-05-15 |
| **v2.0** | Phase 9–10 | Udemy + Books (Multi-Format) | 📋 Chờ v1.3 Phase 7–8 | 2026-06-30 |
| **v3.0** | Phase 11–14 | Inkgest (Multi-Source Hub) | 📋 Kế hoạch | 2026-09-30 |

---

## v1.0–v1.2: Udemy Learning Assistant

### Trạng thái: ✅ HOÀN THÀNH

**Phạm vi:** Core features cho import Udemy + tạo khóa học từ file local + 6 AI engines + multi-profile settings.

**Chính thức thực hiện:**
- ✅ Quản lý khóa học & bài học (CRUD)
- ✅ Import Udemy (API + transcript auto)
- ✅ Upload file transcript (`.vtt`, `.srt`, `.txt`)
- ✅ AI Summary, Explain, Chat, Practice (Quiz/Flashcard/Exercises), Roadmap
- ✅ AI Cache & Persistence (Database)
- ✅ Multi-Profile AI Settings
- ✅ Backend Feature Layer (Notes, Progress, SRS, Analytics, Export, Learner Profile, Chat Persistence)
- ✅ Docker deployment (port 3939)

**Milestone hoàn thành:**
- 2026-03-30: Tất cả 38 core features + 18 backend features hoàn thành
- 2026-03-31: Codebase stabilization, 829/829 tests passing

---

## v1.3: Multi-User Foundation (Authentication & Dashboard)

### Trạng thái: 🔄 ĐANG TRIỂN KHAI (Phase 6 Complete)

**Phạm vi:** Chuyển Inkgest từ single-user personal tool thành multi-user platform với authentication, user data isolation, per-user AI artifacts, và dashboard.

**Tính năng chính:**
- ✅ **Phase 6 COMPLETE:** Schema refactoring + User model + userId FK + LessonArtifact model
- ✅ User model (email, passwordHash, name, avatarUrl, tokenVersion, preferences, resetToken, resetTokenExp)
- ✅ LessonArtifact model (per-user AI content: summary, explanation, quiz, flashcards, exercises, notes)
- ✅ Multi-user data scoping (userId FK on Course, LessonProgress, CourseProgress, FlashcardReview, LearnerProfile, ChatMessage)
- ✅ Compound unique constraints with userId (@@unique([userId, courseId]), @@unique([userId, lessonId, type]), etc.)
- ✅ withAuth pattern (API route wrapper extracting userId from session)
- ✅ All 39 API routes scoped by userId
- ✅ Migration scripts (bootstrap user, legacy data migration, lesson artifact extraction)
- ✅ 829/829 tests passing, build clean
- 📋 Custom JWT authentication (HS256, HttpOnly cookies, bcrypt hashing) — Phases 7–8
- 📋 Dashboard with Continue Learning, SRS Due, Stats, Activity widgets — Phase 7
- 📋 Settings page upgrade (full route `/settings` instead of modal) — Phase 8

**Modules v1.3:**
- ✅ Module 1: Schema Refactoring & Data Scoping (Phase 6 — COMPLETE)
- 📋 Module 2: Authentication & User Management (7 features) — Phase 7
- 📋 Module 3: Dashboard (6 features) — Phase 7
- 📋 Module 4: Settings Page Route (6 features) — Phase 8

**Dự kiến hoàn thành:** 2026-05-15

**Milestones:**
- ✅ 2026-04-03: Phase 6 complete — Schema refactoring + data scoping + migration ready
- 📋 2026-04-15: Phase 7 — Auth routes + dashboard complete
- 📋 2026-04-30: Phase 8 — Settings page + route protection complete
- 📋 2026-05-15: v1.3 release (multi-user beta)

**Dependencies:**
- ✅ Requires v1.2 backend completion (Progress, SRS, Analytics)
- ✅ Phase 6 foundation complete; Phases 7–8 can proceed in parallel
- Blocks v2.0 (books) until user data scoping is in place (READY NOW)

---

## v2.0: Udemy + Books (Multi-Format Learning)

### Trạng thái: 🔄 ĐANG TRIỂN KHAI

**Phạm vi:** Mở rộng app hỗ trợ sách/giáo trình (PDF, EPUB, DOCX) với cùng một AI engine. Requires v1.3 multi-user foundation.

**Tính năng chính:**
- 📋 Upload sách (PDF/EPUB/DOCX/TXT/MD) → tạo course (contentType="book")
- 📋 Auto chapter splitting (heuristic + AI detection)
- 📋 Book metadata (tác giả, ISBN, nhà xuất bản)
- 📋 AI prompt adaptation cho sách (loại ASR rules, thêm academic framing)
- 📋 UI adaptation (label, icon, badge phân biệt book vs course)

**Modules v2.0:**
- Module 5: Upload Sách (Book upload & parsing)
- Module 13: Auto Chapter Splitting
- Module 18: AI Prompt Adaptation cho Sách
- Module 19: UI Adaptation cho Sách
- Module 20: Tính năng nâng cao (concept linking, knowledge graph, cross-chapter SRS)

**Dự kiến hoàn thành:** 2026-06-30

**Milestones:**
- 2026-05-16: v1.3 release + begin book upload MVP
- 2026-06-01: Upload & chapter splitting complete
- 2026-06-15: AI adaptation + UI complete
- 2026-06-30: Advanced features + v2.0 release candidate

---

## v3.0: Inkgest — Multi-Source Learning Hub

### Trạng thái: 📋 KẾ HOẠCH

**Vision:** Inkgest hỗ trợ **tất cả loại nội dung học tập** dưới một giao diện duy nhất. Requires v2.0 book support.
- ✅ Udemy (v1.0)
- ✅ Books (v2.0)
- 📋 **YouTube** (v3.0)
- 📋 **Web/URL Content** (v3.0)
- 📋 **GitHub/Code Repos** (v3.0)
- 📋 **Podcast/Audio** (v3.0)

**Tính năng chính v3.0:**
- 📋 Module 21: YouTube Import (URL → auto-transcript → course)
- 📋 Module 22: Web/URL Import (scrape → analyze → course)
- 📋 Module 23: GitHub Import (README + docs + code → course)
- 📋 Module 24: Audio/Podcast (upload + Whisper transcription → course)
- 📋 AI engine unified: prompt tự động điều chỉnh theo `contentType` (youtube, web, code, podcast)
- 📋 UI unified: sidebar, labels, icons tích hợp tất cả loại nội dung

**Dự kiến hoàn thành:** 2026-09-30

**Milestones:**
- 2026-07-01: YouTube & Web import MVP
- 2026-07-30: GitHub import + auto-analysis
- 2026-08-15: Audio/Podcast transcription
- 2026-09-01: Cross-source analytics
- 2026-09-30: v3.0 release candidate (Inkgest public beta)

---

## Phase Priority Matrix

| Phase | Phạm vi | Dependency | Priority | Effort | Impact |
|-------|--------|-----------|----------|--------|--------|
| **Phase 1–5** | Udemy core | — | 🔴 DONE | ✅ | 🔥🔥🔥 |
| **Phase 6–8** | Multi-User Foundation (v1.3) | Phase 1–5 | 🔴 CRITICAL | 3–4w | 🔥🔥🔥 |
| **Phase 9–10** | Books (v2.0) | Phase 6–8 | 🟠 HIGH | 4–6w | 🔥🔥 |
| **Phase 11–14** | Multi-Source (v3.0) | Phase 9–10 | 🟡 MEDIUM | 10–14w | 🔥 |

---

## Current Progress

### ✅ v1.0–v1.2 Status: 100% COMPLETE

```
Functionality              | Status | Tests
--------------------------|--------|-------
Core CRUD                  | ✅     | 829/829 ✓
Udemy Import              | ✅     | —
Upload (Transcript)       | ✅     | —
AI Engines (6)            | ✅     | —
Persistence + Cache       | ✅     | —
Multi-Profile             | ✅     | —
Backend Layer (7 modules) | ✅     | —
Docker Deploy             | ✅     | —
```

### 🔄 v1.3 Status: 33% (Phase 6/3 Complete)

**Phase 6 (Schema & Data Scoping) — COMPLETE**
```
Module 1: Schema Refactoring          | ✅     | 829/829 ✓
- User model                          | ✅     | —
- LessonArtifact model                | ✅     | —
- userId FK + scoping                 | ✅     | —
- withAuth pattern                    | ✅     | —
- All 39 API routes scoped            | ✅     | —
- Migration scripts                   | ✅     | —
```

**Phase 7–8 (Auth & Dashboard & Settings) — Not Started**
```
Module 2: Authentication              | 📋     | —
Module 3: Dashboard                   | 📋     | —
Module 4: Settings Page               | 📋     | —
```

**Next focus:** Phase 7 (Auth routes + Dashboard) → Phase 8 (Settings page + route protection)

### 📋 v2.0 Status: 0% (Blocked on v1.3 Phase 7–8 completion)

---

## Resource & Timeline

### Development Team

| Role | Effort | Timeline |
|------|--------|----------|
| Coder | ~8–10w per phase | Phase 6–9 |
| Tester | ~3–4w per phase | Phase 6–9 |
| Designer/PM | ~2–3w per phase | Phase 6–9 |

### Key Dependencies

1. **v1.0–v1.2 completion** ✅ → v2.0 can start
2. **UX Overhaul (Phase 6)** → v2.0 requires good UX
3. **Books MVP** → v3.0 roadmap planning
4. **Multi-source API prep** → YouTube, GitHub, Web scraping libraries

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Scope creep in v2.0 | Focus on MVP only; save advanced features for v3.0+ |
| API rate limits (YouTube, GitHub) | Implement caching; use alternative APIs if needed |
| Transcription costs (Whisper) | Batch processing; optional feature behind flag |
| Complex content parsing | Start with heuristic; add AI refinement in Phase 2 |

---

## Success Criteria per Phase

### v1.3 Success Criteria
- [ ] Schema refactoring complete with User model + userId FK + LessonArtifact
- [ ] Authentication system working (register, login, logout, password reset)
- [ ] All user data properly scoped by userId
- [ ] Dashboard showing Continue Learning, SRS Due, Stats, Activity
- [ ] Settings page working as full route `/settings`
- [ ] Route protection + authorization middleware in place
- [ ] Bootstrap user protocol working (legacy data cutover)
- [ ] All tests passing with >80% coverage
- [ ] v1.3 release with multi-user support

### v2.0 Success Criteria
- [ ] Book upload works for PDF/EPUB/DOCX
- [ ] Chapter splitting accuracy > 90%
- [ ] AI features work identically for books and courses
- [ ] UI seamlessly handles both content types
- [ ] User can import, learn, and export books end-to-end
- [ ] All tests passing with >80% coverage
- [ ] Performance metrics met (< 3s first token for AI)

### v3.0 Success Criteria
- [ ] YouTube, Web, GitHub, Audio imports all functional
- [ ] Unified AI engine handles all content types
- [ ] UI seamlessly integrates 5+ source types
- [ ] User can learn from multiple sources in same course/dashboard
- [ ] Cross-source analytics (e.g., "compare learnings from YouTube vs book")
- [ ] All tests passing; performance optimized
- [ ] Public beta release with 50+ simultaneous active users

---

## Backlog (Beyond v3.0)

These features are out of scope for v3.0 but planned for v4.0+:

- [ ] **Live Instructor Mode** — real-time Q&A with instructor via Inkgest
- [ ] **Peer Learning** — share courses/notes with other learners (local network)
- [ ] **Mobile App** — iOS/Android versions
- [ ] **Cloud Sync** — cloud backup + cross-device sync (separate from multi-user platform)
- [ ] **LLM Fine-tuning** — train custom models on user's learning data
- [ ] **Advanced Analytics** — learning curve prediction, intervention alerts
- [ ] **Integration with LMS** — sync with Moodle, Canvas, Blackboard
- [ ] **Localization** — translations beyond Vietnamese

---

## How to Use This Roadmap

1. **For Users:** Check current version against feature list to know what's available
2. **For Developers:** Use as guide for priority and task dependencies
3. **For PMs:** Reference for sprint planning and milestone tracking
4. **For QA:** Validate features against success criteria per phase

---

## Maintenance & Updates

- **Updated on:** 2026-04-03 (Phase 6 completion recorded)
- **Next review:** After Phase 7 completion (2026-04-15)
- **Feedback channel:** GitHub issues / Product discussions
