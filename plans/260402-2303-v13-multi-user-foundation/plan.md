# Inkgest v1.3 — Multi-User Foundation

> **Status:** ✅ Implementation Complete — Codex Approved | **Priority:** Critical | **Est:** ~4 weeks
> **Phases:** 6 (Schema), 7 (Auth), 8 (Dashboard & Onboarding)

---

## Overview

Transform Inkgest from single-user personal tool into multi-user platform with authentication, per-user data isolation, and personalized dashboard.

## Key Documents

- PRD: `docs/prd.md` (sections 6.18–6.21)
- Design: `docs/design-guidelines.md` (sections 17–19, canonical)
- Implementation order: `docs/implementation-order.md` (Phase 6–8)
- Features: `docs/features.md` (Modules 1–4, 25 features)
- Schema: `prisma/schema.prisma`

## Phases

| # | Phase | Status | File | Est |
|---|-------|--------|------|-----|
| 6 | Schema Refactoring & Data Scoping | ✅ Complete | [phase-06](phase-06-schema-refactoring.md) | ~1 week |
| 7 | Authentication System | ✅ Complete | [phase-07](phase-07-authentication-system.md) | ~2 weeks |
| 8 | Dashboard & Onboarding | ✅ Complete | [phase-08](phase-08-dashboard-onboarding.md) | ~1 week |

## Dependency Graph

```
Phase 6 (Schema) ──→ Phase 7 (Auth) ──→ Phase 8 (Dashboard)
   6.1 User model        7.1 JWT lib          8.1 Dashboard page
   6.2 LessonArtifact    7.2 Auth routes      8.2 Settings page
   6.3 userId FK all      7.3 Middleware       8.3 Onboarding
   6.4 Migration script   7.4 Auth UI pages    8.4 Nav refactor
   6.5 API route updates  7.5 Header avatar
```

## Key Constraints

- SQLite: no ALTER COLUMN — use create-copy-rename for migrations
- Custom JWT (HS256), NOT NextAuth.js
- bcrypt cost 12, HttpOnly/Secure/SameSite=Strict cookie
- 404-not-403 pattern for authorization
- Files < 200 lines, kebab-case naming
- Settings = full `/settings` route, NOT modal
- All existing API routes must add userId scoping

## Risk Summary

| Risk | Mitigation |
|------|-----------|
| SQLite migration complexity | Phased approach: nullable userId first, then backfill |
| Breaking existing API routes | Backward-compat wrapper; update routes incrementally |
| LessonArtifact data migration | Script with verification + rollback backup table |
| Session performance (DB hit/req) | LRU cache for User record (TTL 60s) |

## Success Criteria

- [x] All models have userId FK, data isolated per user
- [x] JWT auth working: register, login, logout, forgot/reset password
- [x] Protected routes redirect to /login; public routes accessible
- [x] Dashboard shows personalized widgets after login
- [x] Settings page at /settings replaces SettingsModal
- [x] Legacy data claimed by bootstrap user on first registration
- [x] All existing tests pass + new auth/dashboard tests added (829/829 passing)
- [x] `npm run quality-gate` passes (0 errors, 0 warnings)

## Codex Adversarial Review Results ✅ Fixed

8 critical findings identified and resolved:
1. ✅ JWT fallback secret hardcoded → fail closed (JWT_SECRET required)
2. ✅ Preferences String↔Object mismatch → JSON helpers added
3. ✅ Dashboard stats (unweighted avg) → weighted per-course completion
4. ✅ Open redirect on login → validate redirect URL pattern
5. ✅ Revoked session in protected layout → useEffect redirect to /login
6. ✅ Continue learning widget broken link → full courseId deep-link + Suspense
7. ✅ Raw reset token logging → removed console.log sensitive data
8. ✅ Rate limiting IP spoofing → getClientIp() extracts leftmost from x-forwarded-for
