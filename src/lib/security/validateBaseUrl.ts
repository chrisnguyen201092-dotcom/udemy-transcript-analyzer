/**
 * Validates that a baseUrl is a safe OpenAI-compatible API endpoint.
 * Prevents SSRF by combining an allowlist with a pattern fallback.
 */

const ALLOWED_BASE_URLS = [
  "https://api.openai.com/v1/",
  "https://api.anthropic.com/v1/",
  "https://generativelanguage.googleapis.com/v1beta/",
];

// Pattern for custom OpenAI-compatible endpoints (e.g., Ollama, LM Studio, custom proxies)
const BASE_URL_PATTERN = /^https:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?(\/[\w./-]*)?\/?$/;

export function validateBaseUrl(baseUrl: string | undefined | null): string {
  if (!baseUrl) {
    return "https://api.openai.com/v1/";
  }

  if (ALLOWED_BASE_URLS.includes(baseUrl)) {
    return baseUrl;
  }

  if (BASE_URL_PATTERN.test(baseUrl)) {
    return baseUrl;
  }

  throw new Error(`Invalid baseUrl: not in allowlist and does not match safe pattern`);
}
