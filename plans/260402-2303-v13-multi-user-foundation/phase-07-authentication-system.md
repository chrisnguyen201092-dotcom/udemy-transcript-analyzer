# Phase 7 — Authentication System

## Context Links

- Design Guidelines §17: `docs/design-guidelines.md` (line 988+) — Multi-User & Authentication (canonical)
- PRD §6.18: `docs/prd.md` (line 322) — Authentication & User Management (M-01..M-07)
- PRD §9 Flow 0/0b: `docs/prd.md` (line 851) — Registration & Login user flows
- Current Header: `src/components/Header.tsx` — Replace profile/model button with avatar dropdown
- Current layout: `src/app/layout.tsx` — Add auth context provider

## Overview

- **Priority:** Critical — required before Dashboard (Phase 8)
- **Status:** Pending
- **Dependencies:** Phase 6 (User model + userId FK must exist)
- **Description:** Implement custom JWT auth with email/password. 6 API routes, 4 UI pages, middleware for route protection, avatar dropdown in header. All using HS256 JWT stored in HttpOnly cookies.

## Key Insights

1. **Custom JWT, NOT NextAuth.js** — simpler for SQLite/Prisma, full control over session lifecycle.
2. **Token revocation via tokenVersion** — JWT payload includes `tokenVersion`; middleware checks against DB value. Increment to revoke all sessions.
3. **LRU cache for middleware** — tokenVersion check requires DB read per request. Use in-memory LRU cache (TTL 60s) to minimize DB hits.
4. **Remember me** — same JWT mechanism, just different expiry: 24h (default) vs 30 days (remember me).
5. **No middleware.ts exists yet** — create fresh Next.js middleware file at `src/middleware.ts`.
6. **Existing hooks:** useKeyboardShortcuts, useMediaQuery, useUrlState — will add `useAuth` hook.
7. **Rate limiting:** Login 5/min per IP, registration 3/hour per IP, password reset 3/hour per IP.
8. **Password reset:** crypto.randomBytes(32), hex-encoded, hashed in DB, 1h TTL. Same success response whether email exists or not (no enumeration).

## Requirements

### Functional
- M-01: Register with email + password; bcrypt hash cost 12
- M-02: Login with email + password; JWT (HS256) in HttpOnly cookie `inkgest_session` (24h)
- M-03: Remember me (30 days) via extended JWT expiry
- M-04: Forgot password → reset token with 1h TTL
- M-05: Logout → increment tokenVersion, clear cookie
- M-06: API routes: register, login, logout, forgot-password, reset-password, me
- M-07: Authorization middleware with 404-not-403 pattern

### Non-Functional
- Password minimum 8 characters, no max length cap
- Rate limiting per IP on auth endpoints
- CSRF protection via SameSite=Strict cookie
- JWT secret from environment variable `JWT_SECRET`
- Token payload: `{ userId, email, tokenVersion, iat, exp }`

## Architecture

### JWT Flow

```
Client                    Server                      Database
  |                         |                            |
  |-- POST /api/auth/login →|                            |
  |                         |-- Find user by email -----→|
  |                         |←---- User record ----------|
  |                         |-- Verify bcrypt password    |
  |                         |-- Sign JWT (HS256)          |
  |                         |-- Set-Cookie: inkgest_session (HttpOnly, Secure, SameSite=Strict)
  |←---- 200 + user data ---|                            |
  |                         |                            |
  |-- GET /api/courses -----|                            |
  |   (cookie auto-sent)    |                            |
  |                         |-- Verify JWT signature      |
  |                         |-- Check expiry              |
  |                         |-- LRU cache check userId --|
  |                         |   (or DB: tokenVersion) --→|
  |                         |←---- tokenVersion match? --|
  |                         |-- Extract userId            |
  |                         |-- Query with userId filter  |
  |←---- Scoped data -------|                            |
```

### Route Protection Matrix

| Route | Type | Behavior |
|-------|------|----------|
| `/login` | Public | If authenticated → redirect `/dashboard` |
| `/register` | Public | If authenticated → redirect `/dashboard` |
| `/forgot-password` | Public | Always accessible |
| `/reset-password` | Public | Always accessible (token validated server-side) |
| `/` | Protected | If no session → redirect `/login?redirect=/` |
| `/dashboard` | Protected | If no session → redirect `/login?redirect=/dashboard` |
| `/settings` | Protected | If no session → redirect `/login?redirect=/settings` |
| `/api/auth/*` | Mixed | register/login/forgot/reset = public; logout/me = protected |
| `/api/*` (all other) | Protected | No session → 401 JSON response |

### Auth Cookie Spec

```
Name: inkgest_session
Value: JWT string (HS256)
HttpOnly: true
Secure: true (production) / false (localhost dev)
SameSite: Strict
Path: /
MaxAge: 86400 (24h) or 2592000 (30 days with remember-me)
```

### 6-Layer Authorization Matrix

| Layer | Where | Check | Failure |
|-------|-------|-------|---------|
| 1. Route middleware | `src/middleware.ts` | JWT valid + not expired | Redirect `/login` |
| 2. API route handler | Each `route.ts` | userId from session exists | 401 Unauthorized |
| 3. Data model | Prisma query | `entity.userId === sessionUserId` | 404 Not Found |
| 4. Record level | Prisma where clause | Record exists + owned | 404 Not Found |
| 5. Field level | Route handler | Field-level access control | Omit field |
| 6. Time-based | JWT payload | Token not expired, tokenVersion matches | 401 |

## Related Code Files

### Files to Create
- `src/middleware.ts` — Next.js middleware for route protection + JWT validation
- `src/lib/jwt.ts` — JWT sign/verify/decode helpers (HS256)
- `src/lib/auth.ts` — Replace Phase 6 stub with real `withAuth()` + `getSessionUser()`
- `src/lib/rate-limit.ts` — In-memory rate limiter (IP-based)
- `src/lib/lru-cache.ts` — Simple LRU cache for tokenVersion checks
- `src/app/api/auth/register/route.ts` — POST register
- `src/app/api/auth/login/route.ts` — POST login
- `src/app/api/auth/logout/route.ts` — POST logout
- `src/app/api/auth/forgot-password/route.ts` — POST forgot password
- `src/app/api/auth/reset-password/route.ts` — POST reset password
- `src/app/api/auth/me/route.ts` — GET current user
- `src/app/(auth)/login/page.tsx` — Login page
- `src/app/(auth)/register/page.tsx` — Register page
- `src/app/(auth)/forgot-password/page.tsx` — Forgot password page
- `src/app/(auth)/reset-password/page.tsx` — Reset password page
- `src/app/(auth)/layout.tsx` — Minimal auth layout (centered card, no sidebar)
- `src/hooks/useAuth.ts` — Client hook: check session, login/logout, refresh
- `src/components/AvatarDropdown.tsx` — User menu dropdown (profile, settings, logout)

### Files to Modify
- `src/components/Header.tsx` — Replace settings button with avatar dropdown
- `src/app/layout.tsx` — Wrap with AuthProvider context
- `src/lib/auth.ts` — Upgrade from Phase 6 stub to real JWT validation
- `.env.example` — Add JWT_SECRET, BCRYPT_ROUNDS

### Files to Delete
- None

## Implementation Steps

### Step 1: Create JWT Library (`src/lib/jwt.ts`)
1. Install dependency: `npm install jose` (lightweight JWT for Edge Runtime compatibility)
2. Create `src/lib/jwt.ts` (< 60 lines):
   - `signToken(payload: { userId, email, tokenVersion }, expiresIn?: string): Promise<string>`
   - `verifyToken(token: string): Promise<JWTPayload | null>`
   - Use HS256 algorithm with `process.env.JWT_SECRET`
   - Default expiry: 24h; remember-me: 30d

### Step 2: Create Rate Limiter (`src/lib/rate-limit.ts`)
1. Create `src/lib/rate-limit.ts` (< 50 lines):
   - In-memory Map<string, { count, resetAt }>
   - `rateLimit(key: string, limit: number, windowMs: number): { success, remaining, resetAt }`
   - Auto-cleanup expired entries

### Step 3: Create LRU Cache (`src/lib/lru-cache.ts`)
1. Create `src/lib/lru-cache.ts` (< 50 lines):
   - Simple Map-based LRU with maxSize and TTL
   - `get(key)`, `set(key, value)`, `delete(key)`
   - Used to cache User.tokenVersion (TTL 60s, max 1000 entries)

### Step 4: Upgrade auth.ts — Real withAuth (`src/lib/auth.ts`)
1. Replace Phase 6 stub with real implementation (< 80 lines):
   - `getSessionUser(req: NextRequest): Promise<{ userId, email } | null>` — extract + verify JWT from cookie
   - `withAuth(handler): NextResponse` — wrapper that calls getSessionUser, returns 401 if null
   - `requireOwnership(record: { userId }, sessionUserId: string): void` — throws 404 if mismatch
   - Check tokenVersion against DB (via LRU cache)

### Step 5: Create Auth API Routes

#### 5a. Register (`src/app/api/auth/register/route.ts`)
1. Validate: email (format), password (min 8 chars), name (optional) — Zod schema
2. Check email uniqueness
3. Hash password: `bcrypt.hash(password, 12)`
4. Create User record
5. Bootstrap protocol: if this is first user, run legacy data migration (claim NULL-userId records)
6. Sign JWT, set cookie, return user data (exclude passwordHash)
7. Rate limit: 3/hour per IP

#### 5b. Login (`src/app/api/auth/login/route.ts`)
1. Validate: email, password, rememberMe (boolean) — Zod schema
2. Find user by email (return generic error if not found — no enumeration)
3. Verify password: `bcrypt.compare(password, user.passwordHash)`
4. Sign JWT with user's tokenVersion
5. Set cookie with appropriate maxAge (24h or 30d)
6. Return user data
7. Rate limit: 5/min per IP

#### 5c. Logout (`src/app/api/auth/logout/route.ts`)
1. Extract userId from session
2. Increment `User.tokenVersion` in DB
3. Clear LRU cache entry for this userId
4. Clear cookie (set maxAge=0)
5. Return 200

#### 5d. Forgot Password (`src/app/api/auth/forgot-password/route.ts`)
1. Validate: email — Zod schema
2. Find user by email (always return same success response)
3. Generate: `crypto.randomBytes(32).toString('hex')`
4. Hash token, store in `User.resetToken` + set `User.resetTokenExp` = now + 1h
5. TODO: Send email (log to console in MVP — email service deferred)
6. Return: `{ message: "If email exists, reset link sent" }`
7. Rate limit: 3/hour per IP

#### 5e. Reset Password (`src/app/api/auth/reset-password/route.ts`)
1. Validate: token, newPassword — Zod schema
2. Hash the token from request, find user where `resetToken` matches AND `resetTokenExp > now`
3. Hash new password with bcrypt cost 12
4. Update User: new passwordHash, increment tokenVersion, clear resetToken/resetTokenExp
5. Return success (user must login again — don't auto-login after reset)

#### 5f. Me (`src/app/api/auth/me/route.ts`)
1. Extract userId from session via `getSessionUser()`
2. Find user, return profile data (exclude passwordHash, resetToken)
3. If no valid session: return 401

### Step 6: Create Next.js Middleware (`src/middleware.ts`)
1. Create `src/middleware.ts` (< 80 lines):
   - `config.matcher`: exclude `_next/static`, `_next/image`, `favicon.ico`, `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`
   - For public page routes (`/login`, `/register`, `/forgot-password`, `/reset-password`):
     - If valid JWT exists → redirect to `/dashboard`
   - For protected page routes (everything else):
     - If no valid JWT → redirect to `/login?redirect={pathname}`
   - For protected API routes (`/api/*` except public auth):
     - If no valid JWT → return 401 JSON
   - JWT verification: signature + expiry only (tokenVersion check happens in route handler via withAuth)

### Step 7: Create Auth UI Pages

#### 7a. Auth Layout (`src/app/(auth)/layout.tsx`)
1. Minimal layout: centered content, no sidebar, no header
2. Brand logo at top
3. Background: subtle gradient matching design guidelines

#### 7b. Login Page (`src/app/(auth)/login/page.tsx`)
1. Card layout: max-w-md, centered
2. Fields: email, password, remember me checkbox
3. Actions: "Dang nhap" primary button, "Quen mat khau?" link, "Dang ky" link
4. Error handling: inline field errors + toast for server errors
5. Loading: spinner on button, fields disabled
6. On success: redirect to `searchParams.redirect || '/dashboard'`

#### 7c. Register Page (`src/app/(auth)/register/page.tsx`)
1. Fields: name (optional), email, password, confirm password
2. Inline validation: email format, password strength, confirm match
3. After success: auto-login → redirect `/dashboard`

#### 7d. Forgot Password Page (`src/app/(auth)/forgot-password/page.tsx`)
1. Single email field
2. Success state: "Check your email" message (same whether email exists or not)

#### 7e. Reset Password Page (`src/app/(auth)/reset-password/page.tsx`)
1. Read `token` from URL search params
2. Fields: new password, confirm new password
3. On success: redirect to `/login` with toast "Password reset successfully"

### Step 8: Create Avatar Dropdown (`src/components/AvatarDropdown.tsx`)
1. Trigger: Avatar circle (initials or image) — use shadcn `DropdownMenu` + `Avatar`
2. Menu items: user name, email (small text), separator, Dashboard, Settings, separator, "Dang xuat"
3. Logout action: POST /api/auth/logout → redirect /login

### Step 9: Update Header (`src/components/Header.tsx`)
1. Remove: Settings button with profile/model display
2. Add: AvatarDropdown component (right side)
3. Keep: Inkgest logo, keyboard hints, ModeToggle
4. Add: AI model indicator (small badge, separate from avatar)
5. Header now receives `user` prop instead of `profileName`/`currentModel`/`onOpenSettings`

### Step 10: Create useAuth Hook (`src/hooks/useAuth.ts`)
1. `useAuth()` returns `{ user, loading, login, logout, refresh }`
2. Fetches `/api/auth/me` on mount
3. Caches user state
4. `login(email, password, rememberMe)` → POST /api/auth/login
5. `logout()` → POST /api/auth/logout → redirect /login
6. `refresh()` → re-fetch /api/auth/me

### Step 11: Update Root Layout (`src/app/layout.tsx`)
1. No AuthProvider context needed (useAuth fetches independently)
2. Layout remains server component — auth is handled by middleware + client hooks

## Todo List

- [ ] 7.1 Create `src/lib/jwt.ts` — JWT sign/verify with jose (HS256)
- [ ] 7.2 Create `src/lib/rate-limit.ts` — In-memory rate limiter
- [ ] 7.3 Create `src/lib/lru-cache.ts` — LRU cache for tokenVersion
- [ ] 7.4 Upgrade `src/lib/auth.ts` — Real withAuth + getSessionUser
- [ ] 7.5 Create `src/app/api/auth/register/route.ts` — Registration with bootstrap protocol
- [ ] 7.6 Create `src/app/api/auth/login/route.ts` — Login with JWT cookie
- [ ] 7.7 Create `src/app/api/auth/logout/route.ts` — Logout with tokenVersion increment
- [ ] 7.8 Create `src/app/api/auth/forgot-password/route.ts` — Reset token generation
- [ ] 7.9 Create `src/app/api/auth/reset-password/route.ts` — Password reset
- [ ] 7.10 Create `src/app/api/auth/me/route.ts` — Get current user
- [ ] 7.11 Create `src/middleware.ts` — Route protection middleware
- [ ] 7.12 Create `src/app/(auth)/layout.tsx` — Minimal auth layout
- [ ] 7.13 Create `src/app/(auth)/login/page.tsx` — Login page
- [ ] 7.14 Create `src/app/(auth)/register/page.tsx` — Register page
- [ ] 7.15 Create `src/app/(auth)/forgot-password/page.tsx` — Forgot password page
- [ ] 7.16 Create `src/app/(auth)/reset-password/page.tsx` — Reset password page
- [ ] 7.17 Create `src/hooks/useAuth.ts` — Auth client hook
- [ ] 7.18 Create `src/components/AvatarDropdown.tsx` — User menu dropdown
- [ ] 7.19 Update `src/components/Header.tsx` — Replace settings with avatar dropdown
- [ ] 7.20 Add `JWT_SECRET` and `BCRYPT_ROUNDS` to `.env.example`
- [ ] 7.21 Install dependencies: `jose`, `bcryptjs` (+ `@types/bcryptjs`)
- [ ] 7.22 Write tests for JWT sign/verify
- [ ] 7.23 Write tests for auth API routes (register, login, logout, me)
- [ ] 7.24 Write tests for middleware route protection
- [ ] 7.25 Run `npm run quality-gate`

## Success Criteria

- [ ] User can register with email + password
- [ ] User can login and receive HttpOnly JWT cookie
- [ ] User can logout (token revoked via tokenVersion)
- [ ] Forgot/reset password flow works end-to-end
- [ ] Protected routes redirect to /login when no session
- [ ] Public auth routes redirect to /dashboard when authenticated
- [ ] API routes return 401 for unauthenticated requests
- [ ] Avatar dropdown shows in Header with user menu
- [ ] Remember me extends session to 30 days
- [ ] Rate limiting active on auth endpoints
- [ ] All tests pass, quality gate passes

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| jose library Edge Runtime issues | Low | High | jose is designed for Edge; test in Next.js middleware |
| bcrypt slow in serverless | Medium | Low | Use bcryptjs (pure JS); cost 12 is ~250ms — acceptable |
| LRU cache memory leak | Low | Medium | Max 1000 entries + TTL 60s auto-cleanup |
| Cookie not set in dev (no HTTPS) | Medium | Medium | Set Secure=false for localhost; env-based toggle |
| Middleware runs on every request | N/A | Medium | Fast JWT verify (~1ms); tokenVersion via LRU cache |
| Password reset email not implemented | N/A | Low | Log token to console in MVP; defer email service |

## Security Considerations

- Passwords hashed with bcrypt cost 12 (never stored in plaintext)
- JWT secret from env var (minimum 32 chars); NEVER hardcoded
- HttpOnly cookie prevents XSS token theft
- SameSite=Strict prevents CSRF
- Rate limiting prevents brute force
- Reset token hashed in DB (attacker with DB access can't use tokens)
- Same response for valid/invalid email on forgot-password (no enumeration)
- tokenVersion revocation is server-side — stolen token becomes invalid after logout
- All error messages are generic ("Invalid credentials") — no field-specific hints

## Next Steps

- Phase 8: Build Dashboard page, Settings page, Onboarding flow
- Phase 8 depends on: working auth (login/register), middleware (route protection), User model (preferences)
