# Development Roadmap — Inkgest

> **Phiên bản tài liệu:** v3.4  
> **Cập nhật lần cuối:** 2026-04-03  
> **Trạng thái:** v2.0.1 HOÀN THÀNH (ALL PHASES 1-6 + UPLOAD UX IMPROVEMENT COMPLETE, 912/912 tests passing)  

---

## Tổng quan phiên bản

Inkgest phát triển qua 3 giai đoạn lớn, từ "AI-powered Udemy learner" mở rộng thành "multi-source learning hub":

| Phiên bản | Giai đoạn | Tên gọi | Trạng thái | Ngày dự kiến |
|-----------|-----------|--------|-----------|--------------|
| **v1.0–v1.2** | Phase 1–5 | Udemy Learning Assistant | ✅ Hoàn thành | 2026-03-31 |
| **v1.3** | Phase 6–8 | Multi-User Foundation | ✅ Hoàn thành | 2026-04-03 |
| **v2.0** | Phase 1–6 | Udemy + Books (Multi-Format) | ✅ HOÀN THÀNH | 2026-04-03 |
| **v2.0.1** | Upload UX | Upload UX Improvement | ✅ HOÀN THÀNH | 2026-04-03 |
| **v3.0** | Phase 7–10 | Inkgest (Multi-Source Hub) | 📋 Kế hoạch | 2026-09-30 |

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

### Trạng thái: ✅ HOÀN THÀNH

**Phạm vi:** Chuyển Inkgest từ single-user personal tool thành multi-user platform với authentication, user data isolation, per-user AI artifacts, và dashboard.

**Tính năng chính:**
- ✅ **Phase 6 COMPLETE:** Schema refactoring + User model + userId FK + LessonArtifact model
- ✅ **Phase 7 COMPLETE:** Custom JWT auth (HS256, HttpOnly cookies, bcrypt hashing), 6 API routes (register, login, logout, forgot/reset, me), 4 auth pages, avatar dropdown header, rate limiting, middleware protection
- ✅ **Phase 8 COMPLETE:** Dashboard with 5 personalized widgets (Continue Learning, SRS Due, My Courses, Study Stats, Recent Activity), Settings page (3 tabs: Account, Preferences, Data), preference migration (localStorage → DB), delete account cascade

**Modules v1.3:**
- ✅ Module 1: Schema Refactoring & Data Scoping (Phase 6)
- ✅ Module 2: Authentication & User Management (Phase 7)
- ✅ Module 3: Dashboard (Phase 7)
- ✅ Module 4: Settings Page Route (Phase 8)

**Hoàn thành:** 2026-04-03

**Build Status:** 0 errors, 0 warnings | Tests: 910/910 passing | Quality gate: ✅ PASS

**Code Review:** Codex adversarial review (xhigh effort, 5 rounds) — 8 critical findings identified and fixed:
1. JWT_SECRET fallback → fail-closed
2. Preferences String↔Object mismatch → JSON helpers
3. Dashboard stats (unweighted avg) → weighted per-course
4. Open redirect → URL validation
5. Revoked session → useEffect redirect
6. Continue learning widget → full courseId deep-link
7. Raw token logging → removed
8. Rate limit IP spoofing → getClientIp() helper

**Dependencies:**
- ✅ Requires v1.2 backend completion (Progress, SRS, Analytics)
- ✅ Phase 6–8 all complete; v1.3 release ready
- Unblocks v2.0 (books) — multi-user data scoping now in place

---

---

## v2.0: Udemy + Books (Multi-Format Learning)

### Trạng thái: ✅ HOÀN THÀNH (ALL PHASES COMPLETE - 2026-04-03)

**Phạm vi:** Mở rộng app hỗ trợ sách/giáo trình (PDF, EPUB, DOCX, TXT, MD) với cùng một AI engine. Requires v1.3 multi-user foundation.

**Tính năng chính:**
- ✅ Phase 1: EPUB Support & Book Parsing Hardening
- ✅ Phase 2: Book Metadata Auto-Extraction
- ✅ Phase 3: UI Adaptation for Books
- ✅ Phase 4: End-to-End Book Flow Integration & Testing
- ✅ Phase 5a: Key Concepts Extraction & Persistence
- ✅ Phase 5b: Glossary Aggregation, Search & UI
- ✅ Phase 6: Advanced Features (Concept Linking, Study Plan)
- ✅ Upload sách (PDF/EPUB/DOCX/TXT/MD) → tạo course (contentType="book")
- ✅ Auto chapter splitting (heuristic + AI detection)
- ✅ Book metadata (tác giả, ISBN, nhà xuất bản)
- ✅ AI prompt adaptation cho sách (loại ASR rules, thêm academic framing)
- ✅ UI adaptation (label, icon, badge phân biệt book vs course)
- ✅ Key concepts extraction per chapter
- ✅ Whole-book glossary with search/filter
- ✅ Concept cross-referencing across chapters
- ✅ Time-based study planning

**Modules v2.0:**
- ✅ Module 5: EPUB Parser
- ✅ Module 6: Book Metadata Extraction
- ✅ Module 7: UI Label Adaptation
- ✅ Module 8: Book Upload Flow
- ✅ Module 9: Key Concepts Panel (Phase 5a)
- ✅ Module 10: Glossary Panel (Phase 5b)
- ✅ Module 11: Study Plan Panel (Phase 6)
- ✅ Module 12: Concept Cross-Reference Links (Phase 6)

**Hoàn thành:** 2026-04-03

**Build Status:** 0 errors, 0 warnings | Tests: 910/910 passing | Quality gate: ✅ PASS

**Key Deliverables:**
1. **EPUB Support** — Full parsing with metadata extraction
2. **Multi-Format** — PDF, EPUB, DOCX, TXT, MD all supported
3. **Book Features** — Key concepts, glossary, study plans
4. **Seamless Integration** — All 6 AI engines work on book content
5. **UI Polish** — Contextual labels (Sách/Chương/Nội dung chương)
6. **Complete Flow** — Upload → split → learn → use AI (end-to-end)

---

## v2.0.1: Upload UX Improvement

### Trạng thái: ✅ HOÀN THÀNH

**Phạm vi:** Cải thiện UX của upload modal — phân biệt rõ giữa "Upload files" (transcript) và "Upload sách" (book). Yêu cầu v2.0 hoàn thành.

**Tính năng chính:**
- ✅ Phân biệt button sidebar: "Upload files" vs "Upload sách" với tooltip
- ✅ Modal mở trực tiếp ở tab chính xác (initialMode prop)
- ✅ Enhanced validation + error messages cho cross-mode uploads
- ✅ Server-side guard: PDF/EPUB trên transcript endpoint → 400 error

**Modules v2.0.1:**
- ✅ Module 1: UI Labels & Mode Routing
- ✅ Module 2: Validation & Error Messages

**Hoàn thành:** 2026-04-03

**Build Status:** 0 errors, 0 warnings | Tests: 912/912 passing | Quality gate: ✅ PASS

**Dependencies:**
- ✅ Requires v2.0 completion (books support)
- ✅ All phases complete; v2.0.1 release ready
- ✅ Improves UX before moving to v3.0 (multi-source)

---

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
- [x] Book upload works for PDF/EPUB/DOCX/TXT/MD
- [x] Chapter splitting accuracy > 90%
- [x] AI features work identically for books and courses
- [x] UI seamlessly handles both content types
- [x] User can import, learn, and export books end-to-end
- [x] All tests passing with >80% coverage (910/910 passing ✅)
- [x] Performance metrics met (< 3s first token for AI)

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
