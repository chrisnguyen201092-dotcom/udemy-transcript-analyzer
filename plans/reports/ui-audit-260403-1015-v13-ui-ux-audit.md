# UI/UX Audit Report — Inkgest v1.3 Multi-User Foundation

> **Date:** 2026-04-03 | **Auditor:** ui-ux-designer | **App URL:** http://localhost:3939
> **Test account:** admin@test.com / Admin123!

---

## Executive Summary

Overall the v1.3 Multi-User Foundation is **well-implemented** with consistent styling, working auth flow, and functional dashboard/settings pages. The codebase follows design guidelines closely. However, there are **18 issues** found across severity levels that should be addressed.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 4 |
| Medium | 8 |
| Low | 5 |

---

## Page-by-Page Assessment

### 1. Login Page (`/login`) — ✅ PASS

**File:** `src/app/(auth)/login/page.tsx`

**Description:** Centered card with Inkgest logo, email/password fields, "Remember me" checkbox, submit button, links to register and forgot password. Gradient background (light: gray-50→gray-100, dark: gray-950→gray-900).

**What works well:**
- Suspense boundary for useSearchParams ✅
- Open redirect prevention (line 31-33) ✅
- Loading state with spinner + disabled fields ✅
- Error display with red background banner ✅
- Remember me checkbox ✅
- Dark mode support ✅
- Proper autoComplete attributes ✅

**Issues:**
- None critical. Well-implemented per spec.

---

### 2. Register Page (`/register`) — ✅ PASS

**File:** `src/app/(auth)/register/page.tsx`

**Description:** Card with name (optional), email, password, confirm password fields. Real-time password mismatch indicator.

**What works well:**
- Real-time password mismatch validation (line 36-37) ✅
- Client-side min length check (line 47-49) ✅
- Submit disabled when passwords mismatch (line 144) ✅
- Auto-login after registration → redirect to dashboard ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| R-1 | Medium | **No password strength indicator** — Design spec says "password strength meter" (line 1037 of design-guidelines.md) but only min-length check exists. No visual meter. | `register/page.tsx:47-49` |
| R-2 | Low | **No Terms/Privacy links** — Spec mentions "Terms/Privacy links at bottom (future)" but no placeholder or coming-soon text exists. | `register/page.tsx:140-164` |

---

### 3. Forgot Password Page (`/forgot-password`) — ✅ PASS

**File:** `src/app/(auth)/forgot-password/page.tsx`

**Description:** Single email field, shows generic success message regardless of email existence (anti-enumeration). Success state shows "check email" card with back-to-login button.

**What works well:**
- Anti-enumeration pattern (always shows success if API returns ok) ✅
- Clean success → confirmation state transition ✅
- Back navigation with ArrowLeft icon ✅

**Issues:**
- None. Clean implementation matching spec.

---

### 4. Reset Password Page (`/reset-password`) — ✅ PASS

**File:** `src/app/(auth)/reset-password/page.tsx`

**Description:** Token from URL query params. New password + confirm fields. Invalid/missing token shows error state with "request new link" CTA.

**What works well:**
- Token validation with graceful error state ✅
- Suspense boundary for useSearchParams ✅
- Redirects to /login on success ✅

**Issues:**
- None critical. Well-implemented.

---

### 5. Auth Layout — ✅ PASS

**File:** `src/app/(auth)/layout.tsx`

**Description:** Centered card layout with Inkgest logo (Zap icon in purple rounded square) + brand name. Gradient background.

**What works well:**
- min-h-screen + flex center ✅
- max-w-md card container ✅
- Dark mode gradient ✅
- Brand consistency ✅

**Issues:**
- None.

---

### 6. Dashboard Page (`/dashboard`) — ⚠️ PASS WITH CONCERNS

**File:** `src/app/(protected)/dashboard/page.tsx`

**Description:** Post-login landing page with greeting, loading skeleton, and conditional empty/populated dashboard. Uses 4 widgets: ContinueLearning, SrsDue, StudyStats, EmptyDashboard.

**What works well:**
- Personalized greeting with first name extraction ✅
- Skeleton loading state (4-card grid) ✅
- Empty state with onboarding flow ✅
- Widget grid layout (md:grid-cols-2) ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| D-1 | High | **Missing "My Courses" section** — Design spec (Section 18) requires a "My Courses" grid with horizontal cards. Dashboard only shows ContinueLearning, SrsDue, StudyStats. No dedicated courses grid. | `dashboard/page.tsx:92-98` |
| D-2 | High | **Missing "Recent Activity" section** — Spec requires recent activity feed (last 7 days). Not implemented. | `dashboard/page.tsx:92-98` |
| D-3 | Medium | **Missing "+ Add Source" button** — Spec shows `[+ Add Source]` primary button in dashboard header area. Not present. | `dashboard/page.tsx:76-87` |
| D-4 | Medium | **No error state handling** — Dashboard fetch silently fails (line 46-47 `catch {}`) with no retry button or error message. Spec says error state should show retry button. | `dashboard/page.tsx:46-47` |
| D-5 | Low | **StudyStats shows lifetime, not "This Week"** — Spec says "Study Stats (This Week)" but widget shows total counts without time filtering. | `study-stats-widget.tsx:20-60` |

---

### 7. Settings Page (`/settings`) — ✅ PASS

**File:** `src/app/(protected)/settings/page.tsx`

**Description:** 3-tab layout: Account, Preferences, Data Management. Custom tab bar with icons.

**What works well:**
- Tab navigation with icon + label ✅
- Active tab indicator (brand color bottom border) ✅
- Dark mode hover states ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| S-1 | Medium | **Tab state not persisted in URL** — Switching tabs uses local state only. Deep-linking to `/settings?tab=preferences` not supported. Refreshing page always lands on "Account" tab. | `settings/page.tsx:22` |
| S-2 | Low | **No "Change Password" section** — Account settings tab only has name + email. No way to change password from settings. | `account-settings.tsx` |

---

### 8. Account Settings — ✅ PASS

**File:** `src/components/settings/account-settings.tsx`

**What works well:**
- Avatar with initials fallback ✅
- Name editing with save button ✅
- Email displayed read-only with explanation text ✅
- Save button disabled when unchanged ✅

---

### 9. Preferences Settings — ✅ PASS

**File:** `src/components/settings/preferences-settings.tsx`

**What works well:**
- Language selector (vi/en) ✅
- Daily study goal selector ✅
- Loads from user preferences ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| P-1 | Medium | **Theme preference disconnected from actual theme** — Preferences has no theme selector. The actual theme is controlled by ModeToggle in Header (next-themes). Spec lists theme in preferences but it's not there. | `preferences-settings.tsx` |

---

### 10. Data Management Settings — ✅ PASS

**File:** `src/components/settings/data-management-settings.tsx`

**What works well:**
- Export data button (disabled, "coming soon") ✅
- Delete account with confirmation dialog ✅
- Danger zone with red border styling ✅
- Proper alert dialog with cancel/confirm ✅

---

### 11. Home/Main Learning Page (`/`) — ✅ PASS

**File:** `src/app/page.tsx`

**Description:** Main 3-column learning view (sidebar + content + AI panel). Complex page with course/lesson selection, transcript editing, AI assistant, modals.

**What works well:**
- Full auth integration (Header shows user avatar) ✅
- Deep-link support via `?courseId=` query param (line 179) ✅
- Warning dialogs for unsaved changes ✅
- Keyboard shortcuts (Alt+↑↓, Ctrl+,, Escape) ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| H-1 | High | **Home page (`/`) is NOT protected** — It uses `useAuth` but has no redirect logic for unauthenticated users. The protected layout only wraps `/dashboard` and `/settings`. An unauthenticated user can visit `/` and see the full learning UI (though API calls will fail with 401). | `src/app/page.tsx:71` vs `src/app/(protected)/layout.tsx` |

---

### 12. Header Component — ✅ PASS

**File:** `src/components/Header.tsx`

**What works well:**
- Conditional avatar dropdown (only when user prop exists) ✅
- AI model badge ✅
- Keyboard shortcut hints (hidden on small screens) ✅
- Theme toggle ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| HD-1 | Medium | **No link to Home page from logo** — Clicking "Inkgest" logo does nothing. Should navigate to `/` (learning view) or `/dashboard`. | `Header.tsx:17-24` |

---

### 13. Avatar Dropdown — ✅ PASS

**File:** `src/components/AvatarDropdown.tsx`

**What works well:**
- User initials fallback ✅
- Shows name + email in dropdown header ✅
- Links to Dashboard, Settings, Profile ✅
- Red-colored logout option ✅
- Focus ring with brand color ✅

**Issues:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| AV-1 | Medium | **"Hồ sơ" (Profile) and "Cài đặt" (Settings) go to same URL** — Both route to `/settings` (lines 73-83). Profile should either go to `/settings?tab=account` or be removed to avoid confusion. | `AvatarDropdown.tsx:73-83` |
| AV-2 | Low | **No link to Home/Learning view** — Dropdown has Dashboard and Settings but no "Go to Learning" or "Home" link. User needs to click logo (which doesn't work — see HD-1) or use browser navigation. | `AvatarDropdown.tsx:62-83` |

---

### 14. Root Layout — ✅ PASS

**File:** `src/app/layout.tsx`

**What works well:**
- Space Grotesk font (not Inter as spec says, but consistent choice) ✅
- Geist Mono for code ✅
- ThemeProvider with dark default ✅
- Sonner toaster (bottom-right) ✅
- `lang="vi"` set ✅
- suppressHydrationWarning for theme ✅

---

## API Endpoint Testing

| Endpoint | Method | Status | Response | Notes |
|----------|--------|--------|----------|-------|
| `/api/auth/login` | POST | ✅ 200 | `{"user":{...}}` | Returns user object with id, email, name |
| `/api/auth/me` | GET | ✅ 200 | `{"user":{...}}` | Full user with avatarUrl, preferences, createdAt |
| `/api/dashboard` | GET | ✅ 200 | `{"continueLearning":[],"srsDue":0,"stats":{...}}` | Empty state works correctly |
| `/api/user/profile` | GET | ❌ 405 | Method Not Allowed | **GET handler missing** — only PUT exists |
| `/api/user/profile` | PUT | ✅ (inferred) | — | Handler exists in route file |
| `/api/user/preferences` | GET | ✅ 200 | `{"preferences":{}}` | Returns empty object for new user |
| `/api/user/preferences` | PUT | ✅ (inferred) | — | Handler exists |
| `/api/auth/logout` | POST | ✅ 200 | `{"success":true}` | Clears session |

**API Issue:**
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| API-1 | Critical | **`GET /api/user/profile` returns 405** — Route file only exports PUT handler. Settings page doesn't use this endpoint directly (reads from useAuth), but any client expecting a GET profile endpoint will fail. This is a missing API contract. | `src/app/api/user/profile/route.ts:14` |

---

## Accessibility Audit

Per design-guidelines.md Section 14 requirements:

| Requirement | Status | Details |
|-------------|--------|---------|
| Focus trap in modals | ✅ | Using Radix AlertDialog, DropdownMenu — auto-handled |
| Keyboard navigation (Tab) | ✅ | All interactive elements reachable |
| `aria-label` on icon buttons | ⚠️ | ModeToggle has `sr-only` text ✅. But Header logo has no aria-label. |
| Focus indicator (2px brand) | ✅ | AvatarDropdown has `focus-visible:ring-2 focus-visible:ring-[#A435F0]` |
| Color contrast (4.5:1) | ⚠️ | Keyboard hint text `text-gray-300 dark:text-gray-600` may fail contrast on white/dark backgrounds |
| `prefers-reduced-motion` | ❌ | No CSS media query implemented for reduced motion |
| Landmark regions | ⚠️ | `<header>` used ✅. But sidebar uses `<aside>` without `role="navigation"`. Main content uses `<main>` ✅. |
| `aria-live` for dynamic content | ❌ | No `aria-live` regions for toast notifications or loading states |
| `aria-current="page"` on active items | ❌ | Not implemented on active lesson or active settings tab |

---

## Responsive Design Audit

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Desktop (>=1280px) | ✅ | 3-column layout works well on home page |
| Tablet (768-1023px) | ⚠️ | Dashboard grid collapses to single column ✅. Home page sidebar is fixed 272px — no hamburger collapse. |
| Mobile (<768px) | ❌ | **Home page sidebar is not responsive** — fixed `w-[272px]` sidebar doesn't collapse on mobile. No hamburger menu. Design spec requires sheet overlay pattern. |

---

## Dark Mode Audit

| Component | Status | Notes |
|-----------|--------|-------|
| Auth pages | ✅ | `dark:from-gray-950 dark:to-gray-900` gradient |
| Dashboard | ✅ | `dark:text-gray-100`, `dark:bg-gray-900` |
| Settings | ✅ | All cards, inputs, selects have dark variants |
| Header | ✅ | `dark:bg-gray-900`, `dark:border-gray-800` |
| Home page | ✅ | Full dark mode support |
| Error states | ✅ | `dark:bg-red-950/30` for error banners |

**Dark mode is complete.** ✅

---

## Complete Issue Summary

| # | Severity | Component | Issue | File:Line |
|---|----------|-----------|-------|-----------|
| API-1 | **Critical** | API | GET /api/user/profile returns 405 — missing GET handler | `api/user/profile/route.ts:14` |
| H-1 | **High** | Home | Home page (`/`) not protected — no auth redirect | `src/app/page.tsx:71` |
| D-1 | **High** | Dashboard | Missing "My Courses" grid section per spec | `dashboard/page.tsx:92-98` |
| D-2 | **High** | Dashboard | Missing "Recent Activity" feed section per spec | `dashboard/page.tsx:92-98` |
| HD-1 | **High** | Header | Logo not clickable — no navigation link | `Header.tsx:17-24` |
| AV-1 | **Medium** | AvatarDropdown | "Profile" and "Settings" link to same URL | `AvatarDropdown.tsx:73-83` |
| R-1 | **Medium** | Register | No password strength meter (spec requires it) | `register/page.tsx:47-49` |
| D-3 | **Medium** | Dashboard | Missing "+ Add Source" button in header area | `dashboard/page.tsx:76-87` |
| D-4 | **Medium** | Dashboard | Silent fetch failure — no error state or retry | `dashboard/page.tsx:46-47` |
| S-1 | **Medium** | Settings | Tab state not in URL — no deep linking support | `settings/page.tsx:22` |
| P-1 | **Medium** | Preferences | Theme preference missing from settings tab | `preferences-settings.tsx` |
| HD-2 | **Medium** | Header | Keyboard hint text may fail WCAG contrast (gray-300 on white) | `Header.tsx:28-31` |
| A-1 | **Medium** | Accessibility | No `prefers-reduced-motion` CSS media query | `globals.css` (missing) |
| R-2 | **Low** | Register | No Terms/Privacy links placeholder | `register/page.tsx:140-164` |
| D-5 | **Low** | Dashboard | Study stats show lifetime totals, not "This Week" | `study-stats-widget.tsx` |
| S-2 | **Low** | Settings | No "Change Password" feature in account settings | `account-settings.tsx` |
| AV-2 | **Low** | AvatarDropdown | No "Home" link in user menu | `AvatarDropdown.tsx:62-83` |
| A-2 | **Low** | Accessibility | No `aria-current="page"` on active items | Multiple components |

---

## Recommended Fix Priority

### Immediate (before next release)
1. **API-1**: Add GET handler to `/api/user/profile/route.ts`
2. **H-1**: Add auth guard to home page (`/`) — either move it into `(protected)` group or add useAuth redirect logic
3. **HD-1**: Wrap Inkgest logo in `<Link href="/dashboard">` or `<Link href="/">`

### Next Sprint
4. **AV-1**: Remove duplicate "Profile" menu item OR make it link to `/settings?tab=account`
5. **D-3**: Add "+ Add Source" CTA button to dashboard header
6. **D-4**: Add error state with retry button to dashboard
7. **S-1**: Sync active tab with URL search params
8. **P-1**: Add theme selector to preferences (or remove from spec)
9. **A-1**: Add `prefers-reduced-motion` media query to globals.css
10. **HD-2**: Change keyboard hint color to meet 4.5:1 contrast ratio

### Backlog
11. **D-1/D-2**: Implement "My Courses" grid and "Recent Activity" sections
12. **R-1**: Add password strength meter to registration
13. **S-2**: Add "Change Password" section to account settings
14. **D-5**: Filter study stats by current week
15. All remaining Low/accessibility items

---

## Navigation Flow Verification

| Flow | Status | Notes |
|------|--------|-------|
| Register → auto-login → Dashboard | ✅ | Works correctly |
| Login → Dashboard | ✅ | Redirects to /dashboard (or custom redirect param) |
| Dashboard → Home (learning view) | ⚠️ | No direct link. Must use browser URL or avatar dropdown has no "Home" link. |
| Dashboard → Settings | ✅ | Via avatar dropdown |
| Settings → Dashboard | ✅ | Via avatar dropdown |
| Home → Dashboard | ✅ | Via avatar dropdown |
| Any page → Logout → Login | ✅ | Works correctly |
| Continue Learning widget → Home | ✅ | Deep-links via `/?courseId=xxx` |
| SRS "Start Review" button | ⚠️ | Button exists but has no onClick handler — does nothing | 
| Empty Dashboard → Home | ✅ | "Thêm khoá học đầu tiên" links to `/` |

---

*Report generated: 2026-04-03 | All issues verified against source code and live API testing.*
