# Phase 4: Security & Validation

**Issues:** H-13, H-14, H-15, H-19, M-4, M-19, M-21, M-22, M-32
**Files:** `validateBaseUrl.ts`, `SettingsModal.tsx`, `AIAssistantPanel.tsx`, `page.tsx`, `ai/models/route.ts`, export routes, book API routes, `split-ai.ts`, `srs.ts`
**Priority:** High + Medium

## Issues

- **H-13:** `validateBaseUrl` doesn't block localhost/private IPs or DNS rebinding. Pattern allows `https://localhost`, `https://127.0.0.1`.
- **H-14:** API keys stored in localStorage as plaintext. Low risk for local app but still bad practice.
- **H-15:** Frontend forwards arbitrary `baseUrl`/`apiKey` from settings to API. Server should validate, not trust client.
- **H-19:** Book endpoints (split, split/confirm, etc.) accept any courseId — don't verify `contentType === "book"`.
- **M-4:** `ai/models/route.ts` — no timeout on upstream model discovery fetch. Hanging provider blocks the request indefinitely.
- **M-19:** Export routes CSV — no formula injection protection. Fields starting with `=`, `+`, `-`, `@` can execute in spreadsheets.
- **M-21:** Export routes body parsing — `req.json()` without Zod validation; manual type assertion instead.
- **M-22:** `split-ai.ts` — book content injected into AI prompt unsanitized. Self-use only risk but still worth basic sanitization.
- **M-32:** `srs.ts` — `calculateSM2` can return `interval = 0` when `repetitions >= 2` and `interval * easinessFactor` rounds to 0. Causes infinite review loop.

## Implementation Steps

### H-13: Block private/local URLs in validateBaseUrl
1. In `validateBaseUrl.ts`, after pattern match passes, parse URL and check hostname:
   - Block: `localhost`, `127.x.x.x`, `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`, `[::1]`, `0.0.0.0`
   - Allow: `http://localhost` only if env `NODE_ENV === "development"` (for Ollama/LM Studio)
2. Also block `http://` URLs in production (already handled by pattern requiring `https://`)
3. Note: DNS rebinding is accepted risk for local app — document it

### H-14: Note accepted risk for localStorage
1. For local single-user app, localStorage is acceptable. Add a code comment documenting this decision.
2. Optional improvement: use sessionStorage instead (keys cleared on tab close)
3. Do NOT over-engineer encryption — it's security theater for client-side JS

### H-15: Server-side settings validation
1. AI API routes already call `validateBaseUrl()` — this is sufficient for baseUrl
2. Ensure ALL AI routes (chat, explain, summary, quiz, roadmap, models) call `validateBaseUrl` — audit and add if missing
3. apiKey validation: ensure non-empty string check exists in Zod schemas

### H-19: Verify contentType on book endpoints
1. In `books/split/route.ts` and `books/split/confirm/route.ts`: after finding the course, verify `course.contentType === "book"`, return 400 if not
2. In `books/split/lessons/route.ts`: same check
3. Select `contentType` field in the findUnique calls

### M-4: Add timeout to model discovery
1. In `ai/models/route.ts`, add `AbortSignal.timeout(10000)` to the upstream fetch:
   ```ts
   const upstream = await fetch(url, {
     headers: getCleanHeaders(apiKey),
     signal: AbortSignal.timeout(10_000),
   });
   ```
2. Catch `TimeoutError` / `AbortError` → return 504

### M-19: CSV formula injection protection
1. In both export routes' `escapeCSVField` function, prefix dangerous chars:
   ```ts
   function escapeCSVField(value: string): string {
     let safe = value;
     if (/^[=+\-@\t\r]/.test(safe)) {
       safe = "'" + safe; // tab prefix prevents formula execution
     }
     const escaped = safe.replace(/"/g, '""');
     return `"${escaped}"`;
   }
   ```
2. Apply to both `export/course/[id]/route.ts` and `export/lesson/[id]/route.ts`

### M-21: Add Zod validation to export routes
1. In both export routes, replace manual type assertion with Zod schema:
   ```ts
   const ExportSchema = z.object({
     type: z.enum([...VALID_TYPES]),
     format: z.enum([...VALID_FORMATS]),
   });
   ```
2. Wrap `req.json()` in try-catch for malformed JSON → return 400

### M-22: Basic content sanitization in split-ai.ts
1. In `split-ai.ts`, truncate book content to reasonable limit before injecting into prompt
2. Strip any prompt injection patterns (e.g., `<<<`, `>>>`, system prompt markers)
3. Low priority — self-use only

### M-32: Floor interval to minimum 1 day
1. In `srs.ts` `calculateSM2`, after computing `newInterval`, add: `newInterval = Math.max(1, newInterval)`
2. This ensures interval never drops to 0 from rounding

## Success Criteria
- [x] `validateBaseUrl` rejects localhost/private IPs (except dev mode for Ollama)
- [x] All AI routes validate baseUrl server-side
- [x] Book endpoints reject non-book courseIds
- [x] Model discovery times out after 10s
- [x] CSV exports safe from formula injection
- [x] Export routes use Zod validation
- [x] SRS interval always >= 1 day

**Status:** ✅ COMPLETE
