import { NextResponse } from "next/server";
import { z } from "zod";
import { getCleanHeaders } from "@/lib/ai/client";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

const ModelsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export const POST = withAuth(async (req) => {
  try {
    const { baseUrl, apiKey } = ModelsSchema.parse(await req.json());

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateBaseUrl(baseUrl);
    } catch {
      return Response.json({ error: "Invalid configuration" }, { status: 400 });
    }

    const url = `${safeBaseUrl.replace(/\/$/, "")}/models`;
    let upstream: Response;
    try {
      // M-4: 10s timeout prevents hanging on slow/unreachable providers
      upstream = await fetch(url, {
        headers: getCleanHeaders(apiKey),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (fetchErr) {
      const isTimeout =
        fetchErr instanceof DOMException && fetchErr.name === "TimeoutError";
      if (isTimeout) {
        return Response.json({ error: "provider_timeout" }, { status: 504 });
      }
      throw fetchErr;
    }

    if (!upstream.ok) {
      return Response.json({ error: "provider_error" }, { status: 502 });
    }

    const data = await upstream.json();

    // OpenAI-compatible: { data: [{ id, ... }] }
    const models: string[] = (data?.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter(Boolean)
      .sort();

    return NextResponse.json({ models });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[AI Route Error]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
