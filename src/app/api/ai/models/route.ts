import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCleanHeaders } from "@/lib/ai/client";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";

const ModelsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey } = ModelsSchema.parse(await req.json());

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateBaseUrl(baseUrl);
    } catch {
      return Response.json({ error: "Invalid configuration" }, { status: 400 });
    }

    const url = `${safeBaseUrl.replace(/\/$/, "")}/models`;
    const upstream = await fetch(url, {
      headers: getCleanHeaders(apiKey),
    });

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
}
