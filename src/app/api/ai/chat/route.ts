import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, SOCRATIC_INSTRUCTION } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";

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
  socraticMode: z.boolean().optional().default(false),
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

    // Build system prompt — optionally inject Socratic instruction
    let systemPromptContent = getSystemPrompt("chat");
    if (parsed.socraticMode) {
      systemPromptContent += "\n\n" + SOCRATIC_INSTRUCTION;
    }

    const transcriptContext = `Dựa trên bài học sau:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung: ${lesson.transcript}`;

    // Build messages: system + transcript context + conversation history
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPromptContent },
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

    // Determine the user message content for DB persistence
    let userContent = "";
    if (parsed.messages && parsed.messages.length > 0) {
      for (let idx = parsed.messages.length - 1; idx >= 0; idx--) {
        if (parsed.messages[idx].role === "user") {
          userContent = parsed.messages[idx].content;
          break;
        }
      }
    } else if (parsed.message) {
      userContent = parsed.message;
    }

    const openaiStream = await client.chat.completions.create({
      model,
      messages: chatMessages,
      stream: true,
    });

    const { stream, fullText } = createThinkFilteredStream(openaiStream);

    // Best-effort DB persistence after stream completes
    fullText.then(async (fullAssistantResponse) => {
      if (userContent && fullAssistantResponse) {
        try {
          await prisma.chatMessage.createMany({
            data: [
              { lessonId, role: "user", content: userContent },
              { lessonId, role: "assistant", content: fullAssistantResponse },
            ],
          });
        } catch (dbError) {
          console.error("[chat] DB persistence failed:", dbError);
        }
      }
    });

    return new Response(stream, { headers: STREAM_HEADERS });
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
