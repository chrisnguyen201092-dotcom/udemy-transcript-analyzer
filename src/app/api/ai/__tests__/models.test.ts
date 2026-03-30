/**
 * Integration tests for POST /api/ai/models.
 * External fetch is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(),
  getCleanHeaders: vi.fn((apiKey: string) => ({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "udemy-learner/1.0",
  })),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST as modelsPost } from "@/app/api/ai/models/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/models", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ai/models", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when baseUrl is invalid", async () => {
    const req = makeRequest({ baseUrl: "not-a-url", apiKey: "sk-test" });
    const res = await modelsPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when apiKey is missing", async () => {
    const req = makeRequest({ baseUrl: "https://api.openai.com/v1" });
    const res = await modelsPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when apiKey is empty string", async () => {
    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "" });
    const res = await modelsPost(req);

    expect(res.status).toBe(400);
  });

  it("forwards provider non-ok status back to client", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "bad-key" });
    const res = await modelsPost(req);

    expect(res.status).toBe(401);
  });

  it("returns sorted model ids on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "gpt-4o", object: "model" },
          { id: "gpt-3.5-turbo", object: "model" },
          { id: "gpt-4o-mini", object: "model" },
        ],
      }),
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    const res = await modelsPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.models).toEqual(["gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"]);
  });

  it("models list is alphabetically sorted", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "z-model" },
          { id: "a-model" },
          { id: "m-model" },
        ],
      }),
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    const res = await modelsPost(req);
    const json = await res.json();

    expect(json.models[0]).toBe("a-model");
    expect(json.models[json.models.length - 1]).toBe("z-model");
  });

  it("returns empty models array when data is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    const res = await modelsPost(req);
    const json = await res.json();

    expect(json.models).toEqual([]);
  });

  it("handles missing data property (returns empty array)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // no data field
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    const res = await modelsPost(req);
    const json = await res.json();

    expect(json.models).toEqual([]);
  });

  it("strips trailing slash from baseUrl before appending /models", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "model-1" }] }),
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1/", apiKey: "sk-test" });
    await modelsPost(req);

    const fetchUrl = mockFetch.mock.calls[0][0];
    expect(fetchUrl).toBe("https://api.openai.com/v1/models");
    expect(fetchUrl).not.toContain("//models");
  });

  it("calls fetch with clean Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-mykey" });
    await modelsPost(req);

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.headers["Authorization"]).toBe("Bearer sk-mykey");
  });

  it("filters out falsy model ids", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "valid-model" },
          { id: "" }, // empty string — should be filtered
          { id: null }, // null — should be filtered
        ],
      }),
    });

    const req = makeRequest({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    const res = await modelsPost(req);
    const json = await res.json();

    expect(json.models).toEqual(["valid-model"]);
  });
});
