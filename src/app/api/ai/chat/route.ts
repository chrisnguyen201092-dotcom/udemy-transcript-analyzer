import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatSchema = z.object({
  lessonId: z.string(),
  // Support both: legacy single message OR full history array
  message: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
}).refine(
  (d) => d.message || (d.messages && d.messages.length > 0),
  { message: "Either 'message' or 'messages' must be provided" }
);

export async function POST(req: NextRequest) {
  try {
    const parsed = ChatSchema.parse(await req.json());
    const { lessonId, apiKey, baseUrl, model } = parsed;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson?.transcript) {
      return NextResponse.json(
        { error: "No transcript available" },
        { status: 400 }
      );
    }

    const client = createAIClient(apiKey, baseUrl);

    const transcriptContext = `Dựa trên bài học sau:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung: ${lesson.transcript}`;

    // Build messages: system + transcript context + conversation history
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: getSystemPrompt("chat") },
      { role: "user", content: transcriptContext },
      { role: "assistant", content: "Đã nhận nội dung bài học. Bạn muốn hỏi gì về bài này?" },
    ];

    if (parsed.messages && parsed.messages.length > 0) {
      // Full history mode: append all conversation turns
      for (const msg of parsed.messages) {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    } else if (parsed.message) {
      // Legacy single-message mode (backward compat)
      chatMessages.push({ role: "user", content: `Câu hỏi: ${parsed.message}` });
    }

    const stream = await client.chat.completions.create({
      model,
      messages: chatMessages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const streamData = new ReadableStream({
      async start(controller) {
        let inThink = false;
        let buffer = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (!content) continue;

          buffer += content;

          // Process buffer: strip <think>...</think> blocks
          let output = "";
          let i = 0;
          while (i < buffer.length) {
            if (!inThink) {
              const openIdx = buffer.indexOf("<think>", i);
              if (openIdx === -1) {
                // No more <think> tags — flush rest and clear buffer
                output += buffer.slice(i);
                buffer = "";
                break;
              } else {
                // Flush up to the <think>
                output += buffer.slice(i, openIdx);
                inThink = true;
                i = openIdx + 7; // skip "<think>"
              }
            } else {
              const closeIdx = buffer.indexOf("</think>", i);
              if (closeIdx === -1) {
                // Still inside think block, keep rest in buffer for next chunk
                buffer = buffer.slice(i);
                i = buffer.length;
                break;
              } else {
                inThink = false;
                i = closeIdx + 8; // skip "</think>"
              }
            }
          }

          if (output) {
            controller.enqueue(encoder.encode(output));
          }
        }

        // Flush any remaining non-think buffer content
        if (buffer && !inThink) {
          controller.enqueue(encoder.encode(buffer));
        }

        controller.close();
      },
    });

    return new Response(streamData, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[chat]", msg);
    return NextResponse.json(
      { error: `Failed to process chat: ${msg}` },
      { status: 500 }
    );
  }
}
