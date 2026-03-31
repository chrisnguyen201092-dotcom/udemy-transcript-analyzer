/**
 * Validates that a baseUrl is a safe OpenAI-compatible API endpoint.
 * Prevents SSRF by combining an allowlist with a pattern fallback.
 *
 * H-13: Also blocks private/local IP ranges to prevent DNS rebinding attacks.
 * DNS rebinding accepted risk: this is a local single-user app; full DNS rebinding
 * protection would require server-side hostname resolution which is out of scope.
 */

const ALLOWED_BASE_URLS = [
  "https://api.openai.com/v1/",
  "https://api.anthropic.com/v1/",
  "https://generativelanguage.googleapis.com/v1beta/",
];

// Pattern for custom OpenAI-compatible endpoints (e.g., Ollama, LM Studio, custom proxies)
// Only HTTPS is allowed in production; http is accepted in development for local tools.
const BASE_URL_PATTERN_HTTPS = /^https:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?(\/[\w./-]*)?\/?$/;
const BASE_URL_PATTERN_ANY = /^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?(\/[\w./-]*)?\/?$/;

/** Returns true if hostname resolves to a private/loopback range. */
function isPrivateHostname(hostname: string): boolean {
  // Strip IPv6 brackets
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // Loopback / unspecified
  if (host === "localhost") return true;
  if (host === "0.0.0.0") return true;
  if (host === "::1" || host === "0000:0000:0000:0000:0000:0000:0000:0001") return true;

  // IPv4 private ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number);
    if (a === 127) return true;                          // 127.x.x.x loopback
    if (a === 10) return true;                           // 10.x.x.x
    if (a === 192 && b === 168) return true;             // 192.168.x.x
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16-31.x.x
  }

  return false;
}

export function validateBaseUrl(baseUrl: string | undefined | null): string {
  if (!baseUrl) {
    return "https://api.openai.com/v1/";
  }

  if (ALLOWED_BASE_URLS.includes(baseUrl)) {
    return baseUrl;
  }

  if (!BASE_URL_PATTERN_HTTPS.test(baseUrl)) {
    // In development, also allow http for local tools (Ollama, LM Studio)
    if (process.env.NODE_ENV === "development" && BASE_URL_PATTERN_ANY.test(baseUrl)) {
      // fall through to hostname check
    } else {
      throw new Error(`Invalid baseUrl: not in allowlist and does not match safe pattern`);
    }
  }

  // H-13: Block private/local hostnames except in development (for Ollama/LM Studio)
  try {
    const parsed = new URL(baseUrl);
    if (isPrivateHostname(parsed.hostname) && process.env.NODE_ENV !== "development") {
      throw new Error(`Invalid baseUrl: private/local addresses are not allowed`);
    }
  } catch (err) {
    if ((err as Error).message.includes("private/local")) throw err;
    throw new Error(`Invalid baseUrl: could not parse URL`);
  }

  return baseUrl;
}
