import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ModelsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey } = ModelsSchema.parse(await req.json());

    const url = `${baseUrl.replace(/\/$/, "")}/models`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Provider returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // OpenAI-compatible: { data: [{ id, ... }] }
    const models: string[] = (data?.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter(Boolean)
      .sort();

    return NextResponse.json({ models });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Models fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
