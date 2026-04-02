# Phase 3: Udemy Import Hardening

**Issues:** H-12, H-20, H-17, M-29
**Files:** `api/udemy/import/route.ts`, `api/udemy/courses/route.ts`
**Priority:** High + Medium

## Issues

- **H-12:** Network I/O (`fetchTranscript`) inside Prisma interactive transaction (line 125). Long-running fetches can hold DB lock, cause timeout.
- **H-20:** Re-import deletes ALL existing lessons (line 110) before re-creating. If pagination fails mid-way, user loses data with no recovery.
- **H-17:** Caption URLs from Udemy API fetched without origin validation. Could redirect to internal hosts (SSRF via caption URL).
- **M-29:** `udemy/courses` route uses `page_size=100` with no pagination (line 14-15). Users with >100 courses see truncated list.

## Implementation Steps

### H-12 + H-20: Move network I/O outside transaction, soft-replace lessons
1. **Restructure import flow** in `udemy/import/route.ts`:
   - Phase A (outside tx): Fetch all curriculum items + transcripts into memory array
   - Phase B (inside tx): Upsert course, delete old lessons, create new lessons — pure DB ops only
2. This also partially fixes H-20: if network fails, no DB changes occur
3. **Additional safeguard for H-20**: Before deleting old lessons, verify we fetched at least 1 lecture. If `lectures.length === 0`, return error instead of deleting everything.
4. Add a minimum threshold check: if new lecture count < 50% of existing lesson count, warn/abort (prevents partial pagination from wiping data)

### H-17: Validate caption URLs
1. Add origin validation for caption URLs before calling `fetchTranscript`:
   ```ts
   function isAllowedCaptionUrl(url: string): boolean {
     try {
       const parsed = new URL(url);
       return parsed.protocol === "https:" && 
              (parsed.hostname.endsWith(".udemy.com") || parsed.hostname.endsWith(".udemycdn.com"));
     } catch { return false; }
   }
   ```
2. In the transcript fetch loop, skip URLs that don't pass validation
3. Log skipped URLs for debugging

### M-29: Paginate course listing
1. In `udemy/courses/route.ts`, add pagination loop similar to import's curriculum fetch:
   ```ts
   let nextPage: string | null = initialUrl;
   while (nextPage) {
     const res = await fetch(nextPage, { headers, cache: "no-store" });
     // ... accumulate results
     nextPage = validateUdemyNextUrl(data.next);
   }
   ```
2. Reuse the existing `validateUdemyNextUrl` pattern from import route (or extract to shared util)
3. Add safety cap (e.g., max 10 pages = 1000 courses) to prevent infinite loops

## Success Criteria
- [x] Import doesn't hold DB transaction during network fetches
- [x] Re-import with 0 fetched lectures returns error, doesn't delete existing lessons
- [x] Re-import with <50% of existing count returns warning
- [x] Caption URLs from non-Udemy origins are rejected
- [x] Course listing fetches all enrolled courses (not just first 100)

**Status:** ✅ COMPLETE
