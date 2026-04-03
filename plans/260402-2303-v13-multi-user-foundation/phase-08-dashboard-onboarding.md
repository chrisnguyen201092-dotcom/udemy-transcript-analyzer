# Phase 8 — Dashboard & Onboarding

## Context Links

- Design Guidelines §18: `docs/design-guidelines.md` (line 1079+) — Dashboard Page Design (canonical)
- Design Guidelines §19: `docs/design-guidelines.md` (line 1307+) — Preference Migration
- PRD §6.19: `docs/prd.md` (line 334) — Dashboard (D-01..D-06)
- PRD §6.21: `docs/prd.md` (line 356) — Settings Page Route (S-01..S-06)
- PRD §9 Flow 0: `docs/prd.md` (line 851) — Registration → Dashboard flow
- Current SettingsModal: `src/components/SettingsModal.tsx` — Migrate to full page route
- Current page.tsx: `src/app/page.tsx` — Main learning page (stays as-is)

## Overview

- **Priority:** High — completes v1.3 user experience
- **Status:** Pending
- **Dependencies:** Phase 7 (auth system must be working: login, register, middleware, useAuth)
- **Description:** Build Dashboard as post-login landing page with personalized widgets, migrate Settings from modal to full page route, implement first-time user onboarding, and refactor navigation for multi-user context.

## Key Insights

1. **Dashboard is the new landing page** — after login, users land on `/dashboard` instead of `/` (learning page).
2. **5 widget sections** per design guidelines: Greeting, Continue Learning, SRS Due, My Courses, Study Stats, Recent Activity.
3. **Data contract is well-defined** — design guidelines §18 specifies exact data sources, fallbacks, loading/error states for each widget.
4. **Settings migration** — SettingsModal (localStorage-based) → SettingsPage (DB-based) with 3 tabs: Account, Preferences, Data Management.
5. **Preference migration** — one-time bind-and-clear from localStorage to User.preferences JSON column.
6. **Course.lastAccessedAt** — new field needed for "Continue Learning" and "My Courses" sort order.
7. **Empty dashboard state** — first-time users see onboarding CTA with illustration and "how it works" steps.
8. **Responsive** — 2-column grid (xl+), single column (md-), compact chips (sm).
9. **shadcn/ui components available:** card, avatar, dropdown-menu, badge, button, skeleton — all needed for dashboard.
10. **No new shadcn installs needed** for dashboard; may need `progress` component for progress bars.

## Requirements

### Functional
- D-01: Landing page `/dashboard` with Welcome message, Continue Learning, SRS Due, Stats, Activity
- D-02: Continue Learning: 3-5 recent courses/lessons with progress bar
- D-03: SRS Due widget: flashcard count due today + "Start Review" button
- D-04: Study Stats: total time, streak, lessons completed, flashcards mastered
- D-05: Recent Activity feed: last 7 days of actions
- D-06: Dashboard responsive on desktop/tablet/mobile
- S-01: Settings full page route `/settings` (not modal)
- S-02: Account section: email, profile info, avatar
- S-03: Preferences: AI model, theme, language, daily study goal
- S-04: Data Management: export all, delete account, usage stats
- U-06: Preference migration localStorage → DB (bind-and-clear)

### Non-Functional
- Dashboard page load < 500ms (aggregated API query)
- Widgets show skeleton loading states during data fetch
- All widgets have defined empty states
- Settings page preserves existing AI profile functionality
- Onboarding shown once per user (tracked in User.preferences)

## Architecture

### Dashboard Data Flow

```
/dashboard (page.tsx)
    |
    |-- GET /api/dashboard ──→ Server aggregates:
    |                          ├── User greeting (name + time of day)
    |                          ├── Continue Learning (last accessed course + progress)
    |                          ├── SRS Due (COUNT flashcardReview WHERE due)
    |                          ├── My Courses (top 8 by lastAccessedAt)
    |                          ├── Study Stats (weekly aggregates)
    |                          └── Recent Activity (derived from timestamps)
    |
    └── Render widgets with data
```

### Dashboard API Response Schema

```typescript
interface DashboardData {
  greeting: {
    userName: string;
    timeOfDay: "morning" | "afternoon" | "evening";
  };
  continueLearning: {
    courseId: string;
    courseTitle: string;
    lastLessonId: string;
    lastLessonTitle: string;
    progressPct: number;
    totalLessons: number;
    completedLessons: number;
  } | null;
  srsDue: {
    dueCount: number;
    currentStreak: number;
  };
  myCourses: Array<{
    id: string;
    title: string;
    contentType: string;
    progressPct: number;
    lessonCount: number;
    lastAccessedAt: string;
  }>;
  studyStats: {
    weeklyTimeMs: number;
    weeklyLessonsCompleted: number;
    weeklyCardsReviewed: number;
    currentStreak: number;
  };
  recentActivity: Array<{
    type: "lesson_completed" | "quiz_finished" | "srs_review" | "course_added";
    title: string;
    timestamp: string;
    meta?: Record<string, unknown>;
  }>;
}
```

### Settings Page Architecture

```
/settings (page.tsx)
    |
    ├── AccountSettings — email, name, avatar
    ├── PreferencesSettings — AI model, theme, language, study goal
    └── DataManagementSettings — export, delete account, usage
```

### Route Structure

```
src/app/
├── (auth)/                    # Public auth pages (Phase 7)
│   ├── layout.tsx             # Minimal centered layout
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (protected)/               # Protected pages with main layout
│   ├── layout.tsx             # Header + sidebar layout
│   ├── dashboard/page.tsx     # Dashboard (Phase 8)
│   └── settings/page.tsx      # Settings (Phase 8)
├── page.tsx                   # Learning page (existing, stays)
└── layout.tsx                 # Root layout (existing)
```

**Note:** The existing `page.tsx` (learning page at `/`) also needs protection. It can stay at root level but middleware handles auth redirect. Alternatively, move to `(protected)/` route group. Decision: keep at `/` for URL stability, middleware handles protection.

## Related Code Files

### Files to Create
- `src/app/api/dashboard/route.ts` — GET aggregated dashboard data
- `src/app/api/user/preferences/route.ts` — GET/PUT user preferences
- `src/app/api/user/preferences/migrate/route.ts` — POST localStorage migration
- `src/app/api/user/profile/route.ts` — GET/PUT user profile (name, avatar)
- `src/app/api/user/delete/route.ts` — DELETE account (cascade)
- `src/app/(protected)/layout.tsx` — Protected layout with Header
- `src/app/(protected)/dashboard/page.tsx` — Dashboard page
- `src/app/(protected)/settings/page.tsx` — Settings page
- `src/components/dashboard/continue-learning-widget.tsx` — Continue Learning card
- `src/components/dashboard/srs-due-widget.tsx` — SRS Due card
- `src/components/dashboard/my-courses-widget.tsx` — My Courses grid
- `src/components/dashboard/study-stats-widget.tsx` — Study Stats card
- `src/components/dashboard/recent-activity-widget.tsx` — Activity feed
- `src/components/dashboard/empty-dashboard.tsx` — First-time user onboarding
- `src/components/settings/account-settings.tsx` — Account tab
- `src/components/settings/preferences-settings.tsx` — Preferences tab
- `src/components/settings/data-management-settings.tsx` — Data tab
- `src/lib/preference-migration.ts` — Client-side localStorage → DB migration logic

### Files to Modify
- `prisma/schema.prisma` — Add `lastAccessedAt DateTime?` to Course model
- `src/components/Header.tsx` — Accept user prop, show avatar (from Phase 7)
- `src/app/page.tsx` — Update to work within protected context; update Course fetch to set lastAccessedAt
- `src/app/api/lessons/[id]/ai/route.ts` — Update Course.lastAccessedAt on lesson view
- `src/app/api/courses/route.ts` — Include lastAccessedAt in response
- `src/components/SettingsModal.tsx` — Deprecate (keep for backward compat, link to /settings)

### Files to Delete
- None immediately (SettingsModal deprecated but kept during transition)

## Implementation Steps

### Step 1: Schema Addition — Course.lastAccessedAt
1. Add `lastAccessedAt DateTime?` to Course model in `prisma/schema.prisma`
2. Run `npx prisma db push`
3. Add lastAccessedAt update logic to lesson view API routes

### Step 2: Create Dashboard API Route (`src/app/api/dashboard/route.ts`)
1. Extract userId from session via `getSessionUser()`
2. Parallel queries with `Promise.all()`:
   - User record (name for greeting)
   - Last accessed course + its progress (Continue Learning)
   - FlashcardReview count WHERE nextReviewAt <= now (SRS Due)
   - Top 8 courses by lastAccessedAt (My Courses)
   - Weekly aggregates: lesson completions, SRS reviews, time spent (Study Stats)
   - Recent timestamps for activity feed (Recent Activity)
3. Compute time-of-day greeting from server time
4. Return DashboardData JSON
5. Keep route < 120 lines; extract query helpers to separate file if needed

### Step 3: Create Dashboard Page (`src/app/(protected)/dashboard/page.tsx`)
1. Client component with useAuth hook for user check
2. Fetch `/api/dashboard` on mount
3. Render greeting section + widget grid
4. Loading: skeleton cards for each widget
5. Error: toast + retry button
6. Responsive: CSS grid `grid-cols-1 md:grid-cols-2` for widgets

### Step 4: Create Dashboard Widgets (each < 80 lines)

#### 4a. Continue Learning (`src/components/dashboard/continue-learning-widget.tsx`)
- Card with course title, last lesson, progress bar, "Resume" button
- Click → navigate to `/?source={courseId}&lesson={lessonId}`
- Empty state: hidden (widget not rendered)

#### 4b. SRS Due (`src/components/dashboard/srs-due-widget.tsx`)
- Card with due count badge, streak display
- "Start Review" button → navigate to `/review` (future) or SRS dashboard
- Empty: "No cards due — great job!" with checkmark icon

#### 4c. My Courses (`src/components/dashboard/my-courses-widget.tsx`)
- Horizontal scroll or grid of course cards
- Each: title (2-line truncate), progress bar, lesson count, last accessed
- "View All" link → navigate to `/` (learning page)
- Click card → navigate to `/?source={courseId}`
- Empty: onboarding CTA "Add your first course"

#### 4d. Study Stats (`src/components/dashboard/study-stats-widget.tsx`)
- Card with 4 metrics: time (formatted), lessons completed, cards reviewed, streak
- Weekly period label "This Week"
- Empty: "Start learning to see stats"

#### 4e. Recent Activity (`src/components/dashboard/recent-activity-widget.tsx`)
- List of activity items with icon, title, relative timestamp
- Max 10 items, last 7 days
- Empty: "No recent activity"

### Step 5: Create Empty Dashboard (`src/components/dashboard/empty-dashboard.tsx`)
1. Full-width card with illustration placeholder
2. Welcome message: "Welcome to Inkgest!"
3. Description: "Learn smarter with AI"
4. CTA: "Add your first course" (primary, large)
5. "How it works" 3-step strip: Add Source → AI Summarizes → Practice & Review

### Step 6: Create User Preferences API Routes

#### 6a. GET/PUT Preferences (`src/app/api/user/preferences/route.ts`)
- GET: return User.preferences JSON parsed
- PUT: validate with Zod, update User.preferences, return updated

#### 6b. Migrate Preferences (`src/app/api/user/preferences/migrate/route.ts`)
- POST: receive localStorage data, merge into User.preferences, return success
- One-time operation per user

#### 6c. User Profile (`src/app/api/user/profile/route.ts`)
- GET: return name, email, avatarUrl
- PUT: update name, avatarUrl (email change deferred)

#### 6d. Delete Account (`src/app/api/user/delete/route.ts`)
- DELETE: cascade delete all user data, clear session, return success
- Require password confirmation in request body

### Step 7: Create Settings Page (`src/app/(protected)/settings/page.tsx`)
1. Tab layout with 3 tabs: Account, Preferences, Data Management
2. Use shadcn Tabs component for navigation
3. Each tab renders its settings component

### Step 8: Create Settings Tab Components

#### 8a. Account Settings (`src/components/settings/account-settings.tsx`)
- Display: email (read-only for now), name (editable), avatar (display/placeholder)
- Save button per field or unified save
- Avatar upload: deferred to future (show initials placeholder)

#### 8b. Preferences Settings (`src/components/settings/preferences-settings.tsx`)
- AI model selection: migrate from SettingsModal multi-profile UI
- Theme: light/dark/system (existing ModeToggle logic)
- Language: Vietnamese/English toggle (future, placeholder)
- Daily study goal: numeric input (minutes)
- All saved to User.preferences via PUT /api/user/preferences

#### 8c. Data Management Settings (`src/components/settings/data-management-settings.tsx`)
- Export all data: button → GET /api/export/user (download JSON)
- Delete account: button → confirmation dialog → DELETE /api/user/delete
- Data usage stats: courses count, lessons count, total AI artifacts, storage estimate

### Step 9: Create Preference Migration Client Logic (`src/lib/preference-migration.ts`)
1. `migratePreferencesIfNeeded(userId: string)`:
   - Check `localStorage.getItem('inkgest_migrated')`
   - If not migrated: collect all preference keys from localStorage
   - POST to `/api/user/preferences/migrate`
   - On success: set `localStorage.setItem('inkgest_migrated', userId)`, delete all migrated keys
   - If migrated with different userId: skip (prevents cross-account bleed)
2. Call from useAuth hook on successful login/register

### Step 10: Create Protected Layout (`src/app/(protected)/layout.tsx`)
1. Server component layout for protected pages (dashboard, settings)
2. Renders Header with user context
3. Main content area with padding
4. No sidebar (dashboard/settings are full-width pages)

### Step 11: Create Onboarding Flow
1. First-time detection: check `User.preferences.onboardingComplete !== true`
2. On dashboard load: if first-time → show empty dashboard with onboarding CTA
3. After user adds first course: set `onboardingComplete = true`
4. No separate onboarding wizard — just the empty dashboard state + CTA

### Step 12: Update Existing Routes for lastAccessedAt
1. In lesson AI routes and lesson view routes: update `Course.lastAccessedAt = new Date()`
2. In courses GET: include lastAccessedAt in response, order by it

## Todo List

- [x] 8.1 Add `lastAccessedAt DateTime?` to Course model in schema
- [x] 8.2 Run `npx prisma db push`
- [x] 8.3 Create `src/app/api/dashboard/route.ts` — Dashboard data API
- [x] 8.4 Create `src/app/(protected)/layout.tsx` — Protected page layout
- [x] 8.5 Create `src/app/(protected)/dashboard/page.tsx` — Dashboard page
- [x] 8.6 Create `src/components/dashboard/continue-learning-widget.tsx`
- [x] 8.7 Create `src/components/dashboard/srs-due-widget.tsx`
- [x] 8.8 Create `src/components/dashboard/my-courses-widget.tsx`
- [x] 8.9 Create `src/components/dashboard/study-stats-widget.tsx`
- [x] 8.10 Create `src/components/dashboard/recent-activity-widget.tsx`
- [x] 8.11 Create `src/components/dashboard/empty-dashboard.tsx`
- [x] 8.12 Create `src/app/api/user/preferences/route.ts` — GET/PUT preferences
- [x] 8.13 Create `src/app/api/user/preferences/migrate/route.ts` — Preference migration
- [x] 8.14 Create `src/app/api/user/profile/route.ts` — User profile
- [x] 8.15 Create `src/app/api/user/delete/route.ts` — Delete account
- [x] 8.16 Create `src/app/(protected)/settings/page.tsx` — Settings page
- [x] 8.17 Create `src/components/settings/account-settings.tsx`
- [x] 8.18 Create `src/components/settings/preferences-settings.tsx`
- [x] 8.19 Create `src/components/settings/data-management-settings.tsx`
- [x] 8.20 Create `src/lib/preference-migration.ts` — localStorage migration client logic
- [x] 8.21 Update useAuth to call preference migration on login/register
- [x] 8.22 Update lesson view routes to set Course.lastAccessedAt
- [x] 8.23 Deprecate SettingsModal (add redirect banner to /settings)
- [x] 8.24 Write tests for dashboard API route
- [x] 8.25 Write tests for settings API routes
- [x] 8.26 Write tests for preference migration
- [x] 8.27 Run `npm run quality-gate`

## Success Criteria

- [x] Dashboard loads at `/dashboard` after login with personalized widgets
- [x] Continue Learning shows last accessed course + lesson with progress
- [x] SRS Due shows correct count of flashcards due today
- [x] My Courses displays user's courses sorted by last accessed
- [x] Study Stats shows weekly aggregated metrics
- [x] Recent Activity shows last 7 days of actions
- [x] First-time user sees empty dashboard with onboarding CTA
- [x] Settings page at `/settings` with 3 tabs (Account, Preferences, Data)
- [x] Preferences migrated from localStorage to DB on first login
- [x] Delete account cascades all user data
- [x] Dashboard responsive: 2-col (desktop), 1-col (tablet/mobile)
- [x] All widgets show skeleton loading and proper empty states
- [x] All tests pass, quality gate passes

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Dashboard API slow (many queries) | Medium | Medium | Use Promise.all for parallel queries; index key columns |
| Preference migration data loss | Low | High | Bind-and-clear: only delete localStorage after DB write confirmed |
| SettingsModal regression | Medium | Low | Keep SettingsModal functional during transition; deprecate gradually |
| Route group conflicts with existing / | Low | Medium | Keep page.tsx at root; use (protected) group only for new pages |
| Dashboard empty state not engaging | Medium | Low | Follow design guidelines illustration + CTA pattern |

## Security Considerations

- Dashboard API only returns data for authenticated user (userId from session)
- Delete account requires password confirmation
- Preference migration validates userId matches session
- Export data scoped to authenticated user only
- No admin or cross-user data access from dashboard
- Rate limit on delete account (prevent abuse)

## Next Steps

- After Phase 8: v1.3 complete — multi-user foundation ready
- Future: Phase 9 (UX Overhaul) can proceed independently
- Future: Email service integration for password reset
- Future: Avatar upload with file storage
- Future: Full SRS review page at `/review`
