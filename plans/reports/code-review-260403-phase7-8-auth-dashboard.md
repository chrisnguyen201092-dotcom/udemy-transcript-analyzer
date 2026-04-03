# Code Review: Inkgest v1.3 — Phase 7 (Auth) & Phase 8 (Dashboard/Settings)

**Reviewer:** code-reviewer  
**Date:** 2026-04-03  
**Files Reviewed:** 33 files  
**Overall Verdict:** PASS with concerns

---

## Executive Summary

The authentication and dashboard implementation is **well-architected and production-ready** with proper security practices. The code demonstrates strong separation of concerns, consistent Vietnamese localization, and correct shadcn/ui v4 patterns. A few security hardening items and minor issues noted below.

---

## 1. Security Review

### 1.1 JWT Implementation (`src/lib/jwt.ts`) — PASS
- HS256 with `jose` library — Edge Runtime compatible
- `JWT_SECRET` from env, throws if missing
- `TokenPayload` properly extends `JWTPayload`
- Expiration configurable (24h default, 30d for remember-me)

### 1.2 Cookie Settings — PASS
- `httpOnly: true` — prevents XSS token theft
- `secure: process.env.NODE_ENV === "production"` — HTTPS only in prod
- `sameSite: "strict"` — CSRF protection
- `path: "/"` — scoped correctly

### 1.3 Password Handling — PASS
- bcryptjs with configurable rounds (default 12)
- Password validation: min 8, max 128 chars
- No plaintext storage anywhere

### 1.4 Token Revocation — PASS
- `tokenVersion` field enables instant session invalidation
- Incremented on logout and password reset
- LRU cache (60s TTL) reduces DB load while keeping revocation responsive

### 1.5 Rate Limiting — PASS
- Registration: 5/15min per IP
- Login: 10/15min per IP
- Forgot password: 3/15min per IP
- Reset password: 5/15min per IP
- Auto-cleanup every 60s with `unref()` for clean shutdown

### 1.6 Password Reset Flow — PASS
- `randomBytes(32)` for token generation
- SHA-256 hash stored in DB (raw token never persisted)
- 1-hour expiry
- Always returns success (anti-enumeration)
- Token cleared after use

### 1.7 Issues Found

#### MEDIUM — Middleware fallback secret (`src/middleware.ts:32`)
```typescript
const secret = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
```
**Problem:** Middleware has a hardcoded fallback while `jwt.ts` throws if `JWT_SECRET` is missing. This inconsistency means middleware could accept tokens signed with a different secret than `jwt.ts` uses, or worse, in production if `JWT_SECRET` is accidentally unset, middleware silently falls back to a weak secret.

**Recommendation:** Remove the fallback. Throw or log a warning if `JWT_SECRET` is missing, matching `jwt.ts` behavior. Or import `getSecret()` from jwt.ts (but note Edge Runtime constraints — middleware runs separately).

#### LOW — IP extraction via `x-forwarded-for` only
```typescript
const ip = req.headers.get("x-forwarded-for") ?? "unknown";
```
**Note:** All rate-limit keys share `"unknown"` when no proxy header exists (direct connections). In Docker deployment behind a reverse proxy this is fine. If deployed directly, consider falling back to `req.ip` or a more robust extraction. Not critical for current Docker setup.

#### LOW — No CSRF token for state-changing POST endpoints
**Note:** `sameSite: "strict"` provides strong CSRF protection for same-site requests. Cross-origin attacks are mitigated. However, for defense-in-depth, a CSRF token could be added. Not blocking — `sameSite: strict` is sufficient for this use case.

#### LOW — Account deletion has no re-authentication requirement (`src/app/api/user/delete/route.ts`)
**Note:** Delete endpoint relies only on existing session auth. Best practice is to require password confirmation for destructive account operations. The UI has an AlertDialog confirmation, but no server-side password re-verification.

---

## 2. Error Handling Review — PASS

### Strengths
- All API routes have try/catch with consistent error shape `{ error: string | ZodIssue[] }`
- Zod validation errors return 400 with detailed issues
- 500 errors logged with `console.error("[module]", err)` — good for debugging
- Auth failures consistently return 401
- Rate limit returns 429

### Issues Found

#### LOW — Login route leaks timing on user existence
```typescript
if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
```
**Note:** When user doesn't exist, `bcrypt.compare` is skipped, making the response faster. This creates a timing side-channel for email enumeration. Mitigation: hash a dummy password when user not found. Low severity — rate limiting makes exploitation impractical.

#### INFO — Dashboard silently swallows fetch errors
```typescript
} catch {
  // Silently fail — widgets will show empty states
}
```
**Note:** Acceptable for dashboard UX, but consider logging for debugging or showing a subtle retry indicator.

---

## 3. Code Quality Review

### 3.1 TypeScript — PASS
- No `as any` or `@ts-ignore` anywhere
- Proper interface definitions for all props and API responses
- `TokenPayload extends JWTPayload` — correct type extension
- `withAuth` wrapper has proper generic typing for route params

### 3.2 DRY — PASS
- Auth logic centralized in `src/lib/auth.ts`
- Cookie settings consistent across login/register/logout/delete
- Zod schemas co-located with routes
- `getInitials()` duplicated in `AvatarDropdown` and `AccountSettings` — minor, could extract

### 3.3 Patterns Consistency — PASS
- All protected routes use `withAuth` wrapper
- All form pages follow same pattern: `useState` for fields, `handleSubmit`, loading state, error display
- Vietnamese localization consistently applied across all UI text
- Brand color `#A435F0` used consistently

### 3.4 File Organization — PASS
- `(auth)` route group for public auth pages — clean
- `(protected)` route group for dashboard/settings — clean
- Dashboard widgets in `components/dashboard/` — clean
- Settings panels in `components/settings/` — clean
- All files under 170 lines — good for 200-line limit

### Issues Found

#### LOW — Duplicate `SESSION_COOKIE` constant
`SESSION_COOKIE` is defined in `jwt.ts` and redeclared in `middleware.ts:14`. Import would be cleaner, but middleware Edge Runtime may require this duplication. Acceptable.

#### LOW — `preferences` stored as `String?` in Prisma schema
```prisma
preferences     String?   /// JSON blob for user settings
```
**Note:** `preferences` is typed as `String?` in schema but consumed as `Record<string, unknown>` in code. The API route (`/api/user/preferences`) uses `req.json()` without Zod validation — arbitrary JSON could be stored. Consider adding a Zod schema for preferences shape.

#### INFO — `data-management-settings.tsx:78` — AlertDialogTrigger wrapping Button
```tsx
<AlertDialogTrigger>
  <Button variant="destructive" ...>
```
**Note:** Per task context, shadcn v4 doesn't use `asChild` on `AlertDialogTrigger`. Verify this renders correctly — if `AlertDialogTrigger` renders as `<button>`, nesting `<Button>` creates nested buttons (invalid HTML). May need `asChild` or restructuring depending on actual shadcn v4 behavior.

---

## 4. UI/UX Review

### 4.1 Vietnamese Localization — PASS
- All user-facing text in Vietnamese
- Consistent terminology: "Đăng nhập", "Đăng ký", "Mật khẩu", "Quên mật khẩu"
- Error messages in Vietnamese on client side
- Server-side errors in English (acceptable — client translates/displays)

### 4.2 Accessibility — PASS with notes
- All form inputs have `<Label htmlFor>` associations
- `autoComplete` attributes on all inputs (email, password, name)
- Loading states disable inputs to prevent double-submit
- `focus-visible:ring-2` on avatar dropdown trigger

#### MINOR — No `aria-label` on the remember-me checkbox
The native `<input type="checkbox">` has `id="remember"` linked to a `<Label>`, which is correct. No issue.

#### MINOR — Tab navigation in settings uses custom buttons, not native tabs
Consider `aria-role="tab"`, `aria-selected`, `tabpanel` for screen readers. Low priority for MVP.

### 4.3 Responsive Design — PASS
- Auth pages: centered, max-w-md — works on mobile
- Dashboard: `grid-cols-1 md:grid-cols-2` — responsive
- Settings: max-w-3xl — reasonable
- Keyboard hints hidden on non-lg screens

### 4.4 UX Flow — PASS
- Login redirects to `?redirect=` param or `/dashboard`
- Register auto-logins and redirects to `/dashboard`
- Reset password success redirects to `/login`
- Already-authenticated users redirected from auth pages to `/dashboard`
- Empty dashboard has clear onboarding CTA

---

## 5. Performance Review

### 5.1 Database Queries — PASS with note

#### Dashboard route — potential concern
```typescript
const [courses, srsCards, lessonArtifacts, courseProgress] = await Promise.all([...]);
```
- `Promise.all` for parallel queries — good
- 4 parallel queries per dashboard load — acceptable
- `take: 5` on courses limits result set

#### NOTE — `totalCourses` in stats uses `courses.length` (capped at 5)
```typescript
stats: {
  totalCourses: courses.length, // This is min(5, actual) due to take: 5
```
**Problem:** `totalCourses` will never exceed 5 because the query has `take: 5`. Should be a separate count query.

**Recommendation:** Add `prisma.course.count({ where: { userId } })` to the `Promise.all`.

### 5.2 Caching Strategy — PASS
- LRU cache for tokenVersion: max 1000 entries, 60s TTL
- Clean Map-based implementation with proper eviction
- Delete-and-reinsert pattern for LRU ordering is correct with JS Map insertion order
- `unref()` on cleanup timer — prevents Node process hanging

### 5.3 N+1 Queries — PASS
- Dashboard uses `_count` and `include` properly, no N+1
- User profile/preferences are single queries

---

## 6. Architecture Review — PASS

### Auth Flow
```
Browser → Middleware (JWT sig check) → API Route → withAuth (tokenVersion check) → Handler
```
- Two-layer verification is correct: middleware is fast (no DB), withAuth is thorough
- `getSessionUser` does full validation with cache
- Token revocation via version increment — simple and effective

### Route Protection
- Middleware matcher excludes static assets
- Public auth pages redirect authenticated users
- Protected pages redirect to login with `?redirect=`
- API routes return 401 JSON for unauthenticated requests

### Concerns
- Middleware and `jwt.ts` have independent `getSecret()` functions — could diverge (noted in Security 1.7)

---

## 7. Summary of Issues

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | **MEDIUM** | `middleware.ts:32` | Hardcoded fallback JWT secret — inconsistent with `jwt.ts` |
| 2 | **LOW** | `api/dashboard/route.ts:74` | `totalCourses` capped at 5 due to `take: 5` |
| 3 | **LOW** | `api/user/preferences/route.ts` | No Zod validation on preferences body — arbitrary JSON stored |
| 4 | **LOW** | `api/user/delete/route.ts` | No password re-confirmation for account deletion |
| 5 | **LOW** | `api/auth/login/route.ts:43` | Timing side-channel on user existence (mitigated by rate limit) |
| 6 | **LOW** | `data-management-settings.tsx:78` | Potential nested `<button>` from AlertDialogTrigger + Button |
| 7 | **INFO** | `AvatarDropdown.tsx` + `account-settings.tsx` | Duplicated `getInitials` logic |
| 8 | **INFO** | `settings/page.tsx` | Custom tabs missing ARIA tab roles |

---

## 8. Recommendations (Priority Order)

1. **Fix middleware fallback secret** — Remove `?? "dev-secret-change-in-production"`, align with `jwt.ts` behavior
2. **Fix totalCourses count** — Add separate `prisma.course.count()` query in dashboard
3. **Add Zod schema for preferences** — Validate shape before persisting
4. **Verify AlertDialogTrigger+Button** — Check if nested buttons render correctly in shadcn v4
5. *(Future)* Add password confirmation for account deletion
6. *(Future)* Add dummy bcrypt hash for non-existent users to prevent timing attacks

---

## Verdict

**PASS** — Code is well-structured, secure, and production-ready. Issue #1 (middleware fallback secret) is the only item that should be addressed before deployment. All other items are low-severity improvements.
