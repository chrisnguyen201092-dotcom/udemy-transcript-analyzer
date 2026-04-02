import OpenAI from "openai";

/**
 * Creates a proxy-safe OpenAI client that strips SDK-injected headers
 * which trigger WAF/reverse-proxy 403 blocks.
 *
 * The OpenAI Node SDK sends these headers by default:
 *   - User-Agent: "OpenAI/JS 6.x.x" (looks like a bot → blocked by Cloudflare)
 *   - X-Stainless-Lang, X-Stainless-Package-Version, X-Stainless-OS,
 *     X-Stainless-Arch, X-Stainless-Runtime, X-Stainless-Runtime-Version,
 *     X-Stainless-Retry-Count (telemetry → blocked by strict WAF rules)
 *
 * Setting a header to `null` in `defaultHeaders` removes it entirely (SDK feature).
 *
 * Use this everywhere instead of `new OpenAI(...)` directly.
 */
export function createAIClient(apiKey: string, baseUrl: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl.replace(/\/$/, ""),
    defaultHeaders: {
      // Override bot-looking User-Agent with a clean one
      "User-Agent": "inkgest/1.0",
      // Strip all X-Stainless-* telemetry headers (null = omit entirely)
      "X-Stainless-Lang": null,
      "X-Stainless-Package-Version": null,
      "X-Stainless-OS": null,
      "X-Stainless-Arch": null,
      "X-Stainless-Runtime": null,
      "X-Stainless-Runtime-Version": null,
      "X-Stainless-Retry-Count": null,
      "X-Stainless-Timeout": null,
    },
  });
}

/**
 * Creates clean headers for raw fetch calls (e.g. /models endpoint).
 * Use when calling provider APIs without the OpenAI SDK.
 */
export function getCleanHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "inkgest/1.0",
  };
}
