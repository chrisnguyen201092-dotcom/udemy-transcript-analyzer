/**
 * Unit tests for AI client utilities in @/lib/ai/client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAIClient, getCleanHeaders } from "@/lib/ai/client";

// Spy that captures every constructor call's config argument
const mockOpenAIConstructor = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    _config: unknown;
    chat = { completions: { create: vi.fn() } };
    constructor(config: unknown) {
      mockOpenAIConstructor(config);
      this._config = config;
    }
  }
  return { default: MockOpenAI };
});

describe("getCleanHeaders", () => {
  it("returns Authorization header with Bearer token", () => {
    const headers = getCleanHeaders("sk-test123");
    expect(headers["Authorization"]).toBe("Bearer sk-test123");
  });

  it("returns Content-Type application/json", () => {
    const headers = getCleanHeaders("sk-test123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("returns User-Agent as udemy-learner/1.0", () => {
    const headers = getCleanHeaders("sk-test123");
    expect(headers["User-Agent"]).toBe("udemy-learner/1.0");
  });

  it("returns exactly 3 keys (no extra headers)", () => {
    const headers = getCleanHeaders("any-key");
    expect(Object.keys(headers)).toHaveLength(3);
  });

  it("uses the provided API key verbatim", () => {
    const key = "sk-special-key-123";
    const headers = getCleanHeaders(key);
    expect(headers["Authorization"]).toBe(`Bearer ${key}`);
  });
});

describe("createAIClient", () => {
  beforeEach(() => {
    mockOpenAIConstructor.mockClear();
  });

  it("returns an object with chat.completions.create method", () => {
    const client = createAIClient("sk-test", "https://api.openai.com/v1");
    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.chat.completions).toBeDefined();
  });

  it("strips trailing slash from baseUrl", () => {
    createAIClient("sk-test", "https://api.openai.com/v1/");
    const callArgs = mockOpenAIConstructor.mock.calls[0][0] as { baseURL: string };
    expect(callArgs.baseURL).toBe("https://api.openai.com/v1");
  });

  it("passes apiKey to OpenAI constructor", () => {
    createAIClient("sk-mykey", "https://api.openai.com/v1");
    const callArgs = mockOpenAIConstructor.mock.calls[0][0] as { apiKey: string };
    expect(callArgs.apiKey).toBe("sk-mykey");
  });

  it("sets User-Agent to udemy-learner/1.0 in defaultHeaders", () => {
    createAIClient("sk-test", "https://api.openai.com/v1");
    const callArgs = mockOpenAIConstructor.mock.calls[0][0] as {
      defaultHeaders: Record<string, string | null>;
    };
    expect(callArgs.defaultHeaders["User-Agent"]).toBe("udemy-learner/1.0");
  });

  it("sets X-Stainless-Lang to null in defaultHeaders (strips telemetry)", () => {
    createAIClient("sk-test", "https://api.openai.com/v1");
    const callArgs = mockOpenAIConstructor.mock.calls[0][0] as {
      defaultHeaders: Record<string, string | null>;
    };
    expect(callArgs.defaultHeaders["X-Stainless-Lang"]).toBeNull();
  });

  it("sets all X-Stainless-* headers to null", () => {
    createAIClient("sk-test", "https://api.openai.com/v1");
    const callArgs = mockOpenAIConstructor.mock.calls[0][0] as {
      defaultHeaders: Record<string, string | null>;
    };
    const stainlessHeaders = [
      "X-Stainless-Lang",
      "X-Stainless-Package-Version",
      "X-Stainless-OS",
      "X-Stainless-Arch",
      "X-Stainless-Runtime",
      "X-Stainless-Runtime-Version",
      "X-Stainless-Retry-Count",
      "X-Stainless-Timeout",
    ];
    for (const h of stainlessHeaders) {
      expect(callArgs.defaultHeaders[h]).toBeNull();
    }
  });

  it("works with baseUrl that already lacks trailing slash", () => {
    createAIClient("sk-test", "https://custom.provider.com/api/v2");
    const callArgs = mockOpenAIConstructor.mock.calls[0][0] as { baseURL: string };
    expect(callArgs.baseURL).toBe("https://custom.provider.com/api/v2");
  });
});
