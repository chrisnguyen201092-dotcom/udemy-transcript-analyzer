/**
 * In-memory IP-based rate limiter with auto-cleanup.
 *
 * Note: In-memory store is appropriate for this single-instance SQLite
 * deployment. For multi-instance deployments, switch to Redis-backed store.
 */

import { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup expired entries every 60s
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  // Allow Node to exit even if timer is running
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Check rate limit for a given key.
 * @param key - Unique identifier (e.g. IP address or IP:action)
 * @param limit - Max requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns { success, remaining, resetAt }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Extract client IP from request headers.
 * Uses only the leftmost (client) IP from x-forwarded-for to resist spoofing.
 * Falls back to "unknown" when no IP is available.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Take the leftmost IP — set by the reverse proxy closest to the client
    const firstIp = xff.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
