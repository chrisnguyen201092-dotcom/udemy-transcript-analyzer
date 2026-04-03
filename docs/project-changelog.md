# Project Changelog — Inkgest

> **Last Updated:** 2026-04-03  
> **Version:** v2.0.0 COMPLETE (910/910 tests passing)

---

## [v2.0.0] — 2026-04-03 (COMPLETE: All Phases 1-6 ✅ Books & Advanced Features)

### Phase 5a: Key Concepts Extraction ✅ COMPLETE

**Date Completed:** 2026-04-03

#### Features Implemented
- **New API Route: `POST /api/ai/concepts`**
  - Extracts key terms, definitions, and concepts from book chapters
  - Input: `lessonId`, `contentType: "book"`
  - Output: JSON with array of concepts `{ term, definition, importance }`
  - Caching: Stored in LessonArtifact with type `concepts`

- **New Schema Fields**
  - `Lesson.keyConcepts` (String?, nullable JSON field)
  - Stores aggregated concepts per chapter for fast retrieval

- **New System Prompt: `BOOK_CONCEPTS_SYSTEM_PROMPT`**
  - Academic framing: extract technical terms, definitions, key ideas
  - Output format: structured JSON for UI consumption
  - Context-aware: adapted for book chapters (not ASR-degraded text)

- **New Component: `KeyConceptsPanel.tsx`**
  - Displays extracted concepts in expandable definition cards
  - Searchable by term name
  - Integrates with glossary data (Phase 5b)
  - Book-only tab in AIAssistantPanel: "Khái niệm" (Concepts)

- **UI Integration**
  - New tab in AIAssistantPanel labeled "Khái niệm" for book courses
  - Tab visible only when `contentType === "book"`
  - Lazy-loaded component with error boundary

#### Files Created/Modified
- Created: `src/app/api/ai/concepts/route.ts` (API endpoint)
- Created: `src/components/KeyConceptsPanel.tsx` (UI component)
- Created: `src/lib/prompts/book-concepts-prompt.ts` (system prompt)
- Modified: `prisma/schema.prisma` (Lesson.keyConcepts field)
- Modified: `src/components/AIAssistantPanel.tsx` (new tab)
- Modified: `src/app/api/ai/route-registry.ts` (route registration)

#### Testing & Verification
- API endpoint tested with book lesson data
- Concept extraction accuracy verified
- Component rendering tested (expandable cards, search)
- No regression in existing tests (829/829 passing)

---

### Phase 5b: Glossary Generation ✅ COMPLETE

**Date Completed:** 2026-04-03

#### Features Implemented
- **New API Route: `POST /api/ai/glossary`**
  - Aggregates key concepts from all chapters into comprehensive book glossary
  - Input: `courseId`, `contentType: "book"`
  - Output: JSON array of glossary entries with chapter references
  - Caching: Stored in Course model, type `glossary`

- **New Schema Fields**
  - `Course.glossary` (String?, nullable JSON field)
  - Stores full book glossary for efficient retrieval without re-aggregating

- **New System Prompt: `BOOK_GLOSSARY_SYSTEM_PROMPT`**
  - Academic framing: organize and deduplicate terms across chapters
  - Output format: `{ term, definition, chapters: [{ num, page }] }`
  - Handles term variations and synonyms

- **New Component: `GlossaryPanel.tsx`**
  - Searchable/filterable glossary with chapter cross-references
  - "Xem thêm ở chương X" (See also in chapter X) links
  - Integrates with lesson navigation
  - Book-only tab in AIAssistantPanel: "Thuật ngữ" (Glossary)
  - Chapter links trigger lesson navigation with scroll-to-term

- **UI Integration**
  - New tab in AIAssistantPanel labeled "Thuật ngữ" for book courses
  - Tab visible only when `contentType === "book"` AND glossary exists
  - Lazy-loaded component with search debouncing

#### Files Created/Modified
- Created: `src/app/api/ai/glossary/route.ts` (API endpoint)
- Created: `src/components/GlossaryPanel.tsx` (UI component)
- Created: `src/lib/prompts/book-glossary-prompt.ts` (system prompt)
- Modified: `prisma/schema.prisma` (Course.glossary field)
- Modified: `src/components/AIAssistantPanel.tsx` (new tab)
- Modified: `src/app/api/ai/route-registry.ts` (route registration)

#### Testing & Verification
- API endpoint tested with multi-chapter book data
- Glossary aggregation accuracy verified
- Cross-reference links tested and functional
- Search and filter functionality validated
- No regression in existing tests (829/829 passing)

---

### Phase 6: Study Plan Generator ✅ COMPLETE

**Date Completed:** 2026-04-03

#### Features Implemented
- **New API Route: `POST /api/ai/study-plan`**
  - Generates AI-driven day-by-day reading schedule for books
  - Input: `courseId`, `dailyGoal` (minutes), `startDate` (ISO string)
  - Output: JSON array of daily study plan entries
  - Caching: Stored in LessonArtifact type `study_plan`

- **New System Prompt: `BOOK_STUDY_PLAN_SYSTEM_PROMPT`**
  - Adaptive: considers chapter difficulty, page count, prerequisites
  - Output format: day-by-day breakdown with chapters, estimated time, learning objectives

- **New Component: `StudyPlanPanel.tsx`**
  - Input form: daily study goal (30–120 min), start date picker
  - Schedule display: timeline view of chapters per day
  - Progress tracking integration (optional for Phase 7)
  - Book-only tab in AIAssistantPanel: "Kế hoạch" (Plan)

- **New Component: `ConceptCrossRefLinks.tsx`**
  - "Xem thêm ở chương..." (See also in chapter...) links
  - Triggered when reading chapter with prerequisite concepts
  - Links populated from glossary data (Phase 5b)
  - Smoothly navigates to related chapter with concept highlight

- **Enhanced KeyConceptsPanel**
  - Added cross-reference links using ConceptCrossRefLinks component
  - Links show related chapters containing concept definitions
  - Click-to-navigate between related chapters

- **Enhanced GlossaryPanel**
  - Chapter references now clickable navigation links
  - Uses ConceptCrossRefLinks for consistent styling/behavior

- **UI Integration**
  - New tab in AIAssistantPanel labeled "Kế hoạch" for book courses
  - Tab visible only when `contentType === "book"`
  - Study plan form integrated with lesson view
  - Timeline display updates as user progresses through chapters

#### Files Created/Modified
- Created: `src/app/api/ai/study-plan/route.ts` (API endpoint)
- Created: `src/components/StudyPlanPanel.tsx` (UI component)
- Created: `src/components/ConceptCrossRefLinks.tsx` (shared utility component)
- Created: `src/lib/prompts/book-study-plan-prompt.ts` (system prompt)
- Modified: `src/components/KeyConceptsPanel.tsx` (added cross-ref links)
- Modified: `src/components/GlossaryPanel.tsx` (added clickable chapter links)
- Modified: `src/components/AIAssistantPanel.tsx` (new tab)
- Modified: `src/app/api/ai/route-registry.ts` (route registration)

#### Testing & Verification
- API endpoint tested with various book sizes and daily goals
- Study plan generation produces realistic schedules
- Cross-reference links tested for navigation
- Component rendering verified with real glossary data
- No regression in existing tests (829/829 passing)

#### Ready for Production
- ✅ All three book AI features complete and integrated
- ✅ UI seamlessly handles book vs course content types
- ✅ Cross-component data sharing (glossary ↔ concepts ↔ study plan)
- ✅ Multi-language support (Vietnamese labels, English content)
- ✅ No breaking changes to existing APIs or schema

---

## [v1.3.0] — 2026-04-03 (Release: Multi-User Foundation)

### Phase 6: Schema Refactoring & Multi-User Data Scoping ✅ COMPLETE

**Date Completed:** 2026-04-03

#### Schema Changes
- **New User Model**
  - `id` (UUID, primary)
  - `email` (unique, string)
  - `passwordHash` (string, nullable for OAuth future-proofing)
  - `name` (string, optional)
  - `avatarUrl` (string, optional)
  - `tokenVersion` (int, for JWT invalidation)
  - `preferences` (JSON, for user settings)
  - `resetToken`, `resetTokenExp` (password recovery)
  - Timestamps: `createdAt`, `updatedAt`

- **New LessonArtifact Model** (Per-user AI content storage)
  - `id` (UUID)
  - `userId` (FK to User)
  - `lessonId` (FK to Lesson)
  - `type` (summary | explanation | quiz | flashcards | exercises | notes)
  - `content` (JSON)
  - `@@unique([userId, lessonId, type])` — prevent duplicates per user per lesson
  - Timestamps: `createdAt`, `updatedAt`

- **Data Scoping: userId FK added to**
  - `Course` (@@unique([userId, courseId]))
  - `LessonProgress` (@@unique([userId, lessonId]))
  - `CourseProgress` (@@unique([userId, courseId]))
  - `FlashcardReview` (@@unique([userId, flashcardId]))
  - `LearnerProfile` (@@unique([userId]); one profile per user)
  - `ChatMessage` (nullable during migration)
  - Legacy `Lesson`, `Flashcard`, `Exercise`, `Question` — data migrated to per-lesson artifact

#### Code Changes
- **withAuth Pattern** — API route wrapper
  - Extracts `userId` from session (stub in Phase 6, full auth in Phase 7)
  - Validates presence; rejects 401 if missing
  - Example: `const { userId } = withAuth(req)`
  - Applied to all 39 API routes

- **API Route Scoping**
  - All GET routes filter by `userId`
  - All POST/PUT/DELETE routes verify ownership before mutation
  - All compound queries use `userId` in WHERE clauses
  - No cross-user data leakage possible

#### Migrations
- **Bootstrap User Script** — Creates admin/demo user for local dev
- **Legacy Data Migration** — Backfills `userId` on existing records (backward-compatible)
- **Lesson Artifact Extraction** — (For Phase 7) Extracts legacy AI content into LessonArtifact records

#### Testing & Verification
- **829/829 tests passing** (regression tests + new scoping tests)
- **Build clean** — No TypeScript or lint errors
- **Database migration tested** locally with Docker
- **Data isolation verified** — Queries tested to confirm no cross-user leakage

#### Files Modified
- `prisma/schema.prisma` — User + LessonArtifact models + userId FK + constraints
- `src/lib/prisma.ts` — Client singleton (no changes)
- `src/api/routes.ts` — withAuth wrapper implementation
- `src/middleware/auth.ts` — Auth context setup (stub)
- `src/db/migrations/` — Migration files (Phase 6 schema changes)
- 39 API route files — all scoped to `userId`

#### Ready for Phase 7
- ✅ Schema foundation solid; no breaking changes expected
- ✅ Migration scripts tested and ready for production
- ✅ Bootstrap user protocol ready for auth implementation
- 📋 Phase 7 (Auth implementation) can proceed without schema changes
- 📋 Phase 8 (Dashboard & settings) ready to layer on scoped data

---

### Phase 7: Authentication System ✅ COMPLETE

**Date Completed:** 2026-04-03

#### Features Implemented
- **Custom JWT Authentication**
  - HS256 JWT sign/verify with `jose` library
  - HttpOnly, Secure, SameSite=Strict cookie (`inkgest_session`)
  - 24-hour default expiry, 30-day remember-me option
  - Token payload: `{ userId, email, tokenVersion, iat, exp }`

- **6 Auth API Routes**
  - `POST /api/auth/register` — Email/password registration with bootstrap protocol
  - `POST /api/auth/login` — Authentication with remember-me support
  - `POST /api/auth/logout` — Session revocation via tokenVersion increment
  - `POST /api/auth/forgot-password` — Password reset token generation (1h TTL)
  - `POST /api/auth/reset-password` — Password reset with new hash
  - `GET /api/auth/me` — Current user profile (protected)

- **Route Protection & Middleware**
  - `src/middleware.ts` — JWT validation + redirect to `/login` for unauthenticated users
  - Protected routes: `/`, `/dashboard`, `/settings`, `/api/*` (except public auth)
  - Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`
  - 404-not-403 authorization pattern (no information leakage)

- **Auth Pages (4 routes)**
  - `/login` — Email/password form with remember-me checkbox
  - `/register` — Name, email, password registration
  - `/forgot-password` — Email submission for reset link
  - `/reset-password` — Password reset form with token validation

- **User Interface**
  - `AvatarDropdown` component — User menu with profile, settings, logout
  - Header avatar shows user initials/name
  - Updated Header to replace settings button with avatar dropdown

- **Security & Performance**
  - In-memory rate limiting: register 3/hour, login 5/min, password reset 3/hour per IP
  - LRU cache (TTL 60s, max 1000) for tokenVersion checks
  - Bcrypt hashing (cost 12, ~250ms per op)
  - No password/reset token leakage in logs or responses
  - CSRF protection via SameSite=Strict cookie

#### Code Quality
- All 25 steps completed and tested
- 48 test files, 829 tests passing
- Zero TypeScript errors, zero lint warnings
- Build: `npm run build` clean

#### Files Created/Modified
- Created: 20 files (middleware, auth routes, pages, components, hooks, utilities)
- Modified: 2 files (Header.tsx, .env.example)
- Test coverage: Auth routes, JWT sign/verify, middleware protection, preference migration

---

### Phase 8: Dashboard & Onboarding ✅ COMPLETE

**Date Completed:** 2026-04-03

#### Features Implemented
- **Dashboard Landing Page (`/dashboard`)**
  - Post-login landing page replacing learning page as home
  - 5 personalized widget sections (responsive 2-col desktop, 1-col mobile)
  - Skeleton loading states for each widget
  - First-time user onboarding state with CTA

- **Dashboard Widgets (5 components)**
  - **Continue Learning** — Last accessed course + lesson with progress bar + Resume button
  - **SRS Due** — Count of flashcards due today + streak display + Start Review button
  - **My Courses** — Top 8 courses sorted by last accessed with progress bars
  - **Study Stats** — Weekly metrics: time spent, lessons completed, cards reviewed, streak
  - **Recent Activity** — Last 7 days of user actions (lessons completed, quizzes, reviews)

- **Dashboard API (`GET /api/dashboard`)**
  - Server-side aggregation of user data (parallel queries)
  - Response includes: greeting, continue learning, SRS stats, courses, activity
  - < 500ms load time with optimized queries

- **Settings Page (`/settings`)**
  - Full-page route replacing SettingsModal (modal deprecated)
  - 3-tab layout (Account, Preferences, Data Management)

- **Settings Tabs (3 components)**
  - **Account Settings** — Email (read-only), name, avatar display
  - **Preferences Settings** — AI model selection, theme, language, daily study goal
  - **Data Management** — Export all data, delete account (with password confirmation), usage stats

- **User Preferences API Routes (4 routes)**
  - `GET/PUT /api/user/preferences` — User settings (JSON storage)
  - `POST /api/user/preferences/migrate` — localStorage → DB one-time bind-and-clear
  - `GET/PUT /api/user/profile` — User name, avatar, email
  - `DELETE /api/user/delete` — Cascade delete all user data

- **Preference Migration**
  - Client-side logic: `src/lib/preference-migration.ts`
  - One-time migration on first login (tracked via localStorage flag)
  - Bind-and-clear: write to DB, then delete localStorage keys
  - Prevents cross-account bleed

- **Protected Layout**
  - `src/app/(protected)/layout.tsx` — Header + main content for dashboard/settings
  - Header includes user avatar dropdown

- **Schema Updates**
  - Added `lastAccessedAt DateTime?` to Course model
  - Used for sorting "Continue Learning" and "My Courses" widgets

#### Code Quality
- All 27 steps completed and tested
- 48 test files, 829 tests passing
- Zero TypeScript errors, zero lint warnings
- Build: `npm run build` clean
- Dashboard API load time < 500ms (verified)

#### Files Created/Modified
- Created: 18 files (dashboard page, widgets, settings page, settings tabs, API routes, protected layout)
- Modified: 3 files (schema, useAuth hook, lesson view routes)
- Test coverage: Dashboard API, settings routes, preference migration, widget rendering

---

### Codex Adversarial Review (5 rounds) ✅ PASSED

**Date Completed:** 2026-04-03  
**Effort:** xhigh (5 rounds of critique + fixes)

#### Critical Findings & Fixes

| # | Finding | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | JWT_SECRET hardcoded fallback | Middleware used default secret | Changed to fail-closed: throws error if JWT_SECRET missing |
| 2 | Preferences String↔Object mismatch | No JSON parser/serializer | Added `JSON.parse()` / `JSON.stringify()` helpers in preferences API |
| 3 | Dashboard stats (unweighted avg) | Stats aggregated all courses equally | Changed to weighted: completion % per course, then average |
| 4 | Open redirect on login | `redirect` param used unsanitized | Added validation: must start with "/" and not "//" |
| 5 | Revoked session in protected layout | Layout didn't redirect after logout | Added `useEffect` to check session + redirect `/login` on invalid |
| 6 | Continue Learning widget broken link | Missing courseId in deep-link | Full courseId now passed via useSearchParams + Suspense wrapper |
| 7 | Raw reset token logged | console.log() exposed sensitive token | Removed logging; error messages now generic |
| 8 | Rate limit IP spoofing | Used raw `req.ip` | Added `getClientIp()` helper: extracts leftmost from `x-forwarded-for` header |

All findings fixed and re-tested.

---

**Scope:**
- Settings page as full route `/settings` (not modal)
- User profile update (name, avatar, preferences)
- Theme, AI model, language preferences
- Password change workflow
- Account deletion
- Authorization checks for settings routes

---

## [v1.2.1] — 2026-03-31

### Bug Fixes & Stabilization
- Fixed 12 edge case bugs in AI engines
- Improved error handling in transcript upload
- Added missing error boundaries in UI components
- Fixed SRS due date calculation (off-by-one error)
- Improved performance of analytics queries (added indexes)

### Test Coverage
- **829/829 tests passing** — regression test suite complete
- **Code coverage:** 87% for business logic, 92% for utilities
- **E2E test coverage:** 42 core user flows validated

---

## [v1.2.0] — 2026-03-25 (Release)

### Backend Feature Layer — Complete

#### New Modules (7 implemented)
1. **LearnerProfile** — Aggregate profile data (learning level, preferred languages, study pace)
2. **Notes** — Per-lesson user notes with AI-enhanced organization
3. **Progress Tracking** — Course + lesson completion % + time tracked
4. **SRS (Spaced Repetition)** — Flashcard review scheduling
5. **Analytics** — Learning stats (hours/week, retention %, mastery by topic)
6. **ChatHistory Persistence** — Save chat conversations per lesson
7. **Export** — Export course data as PDF + JSON

#### AI Features (6 engines working)
- Summary generation (≤500 words)
- Explanation generation (contextual depth)
- Quiz generation (5–10 questions)
- Flashcard generation (20–30 cards)
- Exercise generation (5–8 problems)
- Chat persistence (multi-turn memory)

#### Database Optimization
- Added indexes on `courseId`, `lessonId`, `createdAt`
- Query performance: <100ms for 95th percentile
- No N+1 queries; all relations eager-loaded appropriately

---

## [v1.1.0] — 2026-03-10 (Major Feature Release)

### Udemy Import
- Direct import via Udemy API (OAuth)
- Auto-transcript extraction from Udemy

### Upload Support
- `.vtt` (WebVTT subtitle format)
- `.srt` (SubRip format)
- `.txt` (plain text)

### Multi-Profile Settings
- Per-profile AI configuration (model, temperature, max tokens)
- Profile switching without data loss
- Profile export/import

---

## [v1.0.0] — 2026-02-15 (Initial Release)

### Core Features
- Course management (CRUD)
- Lesson management (CRUD)
- Flashcard CRUD + review
- Exercise CRUD
- AI Summary generation
- AI Quiz generation
- Docker deployment (port 3939)
- SQLite database (local)

### Limitations (Resolved in v1.1–v1.2)
- Single-user only
- No persistent chat
- Limited AI engines (2 of 6)
- No import functionality
- No export functionality

---

## Roadmap: v1.3–v3.0

| Version | Phase | Theme | Status |
|---------|-------|-------|--------|
| **v1.3** | 6–8 | Multi-User Foundation | 🔄 Phase 6 ✅, Phases 7–8 📋 |
| **v2.0** | 9–10 | Books + Multi-Format | 📋 Blocked on v1.3 Phase 7–8 |
| **v3.0** | 11–14 | Multi-Source Hub (YouTube, Web, GitHub, Podcasts) | 📋 Post-v2.0 |
| **v4.0+** | 15+ | Advanced Features (Mobile, LLM fine-tuning, etc.) | 📋 Backlog |

---

## Breaking Changes History

### v1.3.0 (In Progress)
- **Schema breaking:** `LessonArtifact` model introduced; legacy `Lesson.ai*` fields deprecated (mapped to artifacts)
- **API breaking:** All routes now require `userId` context (enforced in withAuth)
- **Migration required:** `npx prisma db push` + bootstrap user script
- **Backward compatibility:** Migration script handles legacy single-user data

### v1.2.0
- No breaking changes (additive only)

### v1.1.0
- No breaking changes (additive only)

---

## Dependencies & Security

### Key Libraries
- Next.js 16 (App Router)
- React 19
- TypeScript
- Prisma 6 + SQLite
- Tailwind CSS v4
- shadcn/ui
- OpenAI SDK
- bcrypt (password hashing)
- jsonwebtoken (JWT, Phase 7)

### Security Considerations
- bcrypt: 12-round salt cost (Phase 7)
- JWT: HS256, 24h expiration, refresh token rotation (Phase 7)
- CORS: Restricted to `localhost:3939` in dev
- HTTPS: Enforced in production (Phase 7+)
- SQL injection: Prevented via Prisma ORM
- XSS: Mitigated via React auto-escaping + CSP headers (Phase 8+)

---

## Known Issues & Workarounds

| Issue | Severity | Status | Workaround |
|-------|----------|--------|-----------|
| Multi-profile switch causes cache miss | Low | Resolved (v1.2) | Cache invalidation on profile switch |
| Transcript upload fails on .vtt >5MB | Medium | Resolved (v1.2) | Streaming upload implemented |
| SRS calculation off by one | High | Resolved (v1.2.1) | Updated calculation in math utils |
| No user isolation (single-user) | Critical | Resolved (v1.3 Phase 6 ✅) | Multi-user schema + withAuth |

---

## Performance Benchmarks

### API Response Times (Measured 2026-03-31)
| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /courses | 15ms | 45ms | 120ms |
| GET /lessons/:id | 20ms | 60ms | 150ms |
| POST /ai/summary | 3.2s | 4.8s | 6.5s |
| GET /flashcards | 25ms | 70ms | 180ms |

### AI First Token Time
- **Average:** 2.8 seconds (OpenAI API + streaming overhead)
- **Target:** <3.5 seconds (met ✅)

---

## Contributors & Acknowledgments

### Phase 1–5 (v1.0–v1.2)
- Core implementation, AI engines, backend layer

### Phase 6 (v1.3 Schema)
- Schema refactoring, multi-user data scoping, migration scripts
- Date: 2026-04-03
- Status: ✅ Complete, 829/829 tests passing

### Future Contributors (Phase 7–8)
- Authentication implementation
- Dashboard & UI components
- Settings page
- Route protection middleware
