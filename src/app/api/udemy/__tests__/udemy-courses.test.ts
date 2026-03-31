/**
 * Integration tests for POST /api/udemy/courses.
 * External fetch is mocked — no real Udemy API calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST as udemyCourses } from "@/app/api/udemy/courses/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/udemy/courses", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/udemy/courses", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when cookie is missing", async () => {
    const req = makeRequest({});
    const res = await udemyCourses(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when cookie is empty string", async () => {
    const req = makeRequest({ cookie: "" });
    const res = await udemyCourses(req);

    expect(res.status).toBe(400);
  });

  it("returns 401 when Udemy API returns 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const req = makeRequest({ cookie: "invalid-token" });
    const res = await udemyCourses(req);

    // M-5: route now passes through Udemy's status code
    expect(res.status).toBe(401);
  });

  it("returns 403 when Udemy API returns 403", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const req = makeRequest({ cookie: "some-token" });
    const res = await udemyCourses(req);

    // M-5: route now passes through Udemy's status code
    expect(res.status).toBe(403);
  });

  it("returns mapped course list on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 123, title: "JavaScript Basics", url: "/course/js", num_lectures: 20 },
          { id: 456, title: "React Advanced", url: "/course/react", num_lectures: 35 },
        ],
      }),
    });

    const req = makeRequest({ cookie: "valid-token" });
    const res = await udemyCourses(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.courses).toHaveLength(2);
    expect(json.count).toBe(2);
  });

  it("maps course fields correctly (id, title, url, num_lectures)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 999, title: "My Course", url: "/course/my", num_lectures: 10 },
        ],
      }),
    });

    const req = makeRequest({ cookie: "valid-token" });
    const res = await udemyCourses(req);
    const json = await res.json();

    expect(json.courses[0]).toMatchObject({
      id: 999,
      title: "My Course",
      url: "/course/my",
      num_lectures: 10,
    });
  });

  it("defaults num_lectures to 0 when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 1, title: "Course", url: "/c" }], // no num_lectures
      }),
    });

    const req = makeRequest({ cookie: "valid-token" });
    const res = await udemyCourses(req);
    const json = await res.json();

    expect(json.courses[0].num_lectures).toBe(0);
  });

  it("returns empty courses array when results is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const req = makeRequest({ cookie: "valid-token" });
    const res = await udemyCourses(req);
    const json = await res.json();

    expect(json.courses).toEqual([]);
    expect(json.count).toBe(0);
  });

  it("sends Authorization Bearer header to Udemy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const req = makeRequest({ cookie: "my-cookie-token" });
    await udemyCourses(req);

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1].headers["Authorization"]).toBe("Bearer my-cookie-token");
  });
});
