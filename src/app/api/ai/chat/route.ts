import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, SOCRATIC_INSTRUCTION, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatSchema = z.object({
  lessonId: z.string(),
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

export const POST = withAuth(async (req, { userId }) => {
  try {
    const parsed = ChatSchema.parse(await req.json());
    const { lessonId, apiKey, baseUrl, model } = parsed;

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateBaseUrl(baseUrl);
    } catch {
      return Response.json({ error: "Invalid configuration" }, { status: 400 });
    }

    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, course: { userId } },
      include: { course: true },
    });

    if (!lesson?.transcript) {
      return NextResponse.json({ error: "No transcript available" }, { status: 400 });
    }

    const client = createAIClient(apiKey, safeBaseUrl);
    const contentType = (lesson.course.contentType ?? "course") as ContentType;

    let systemPromptContent = getSystemPrompt("chat", contentType);
    if (parsed.socraticMode) {
      systemPromptContent += "\n\n" + SOCRATIC_INSTRUCTION;
    }

    const transcriptContext = `Dựa trên bài học sau:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung: ${lesson.transcript}`;

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPromptContent },
      { role: "user", content: transcriptContext },
      { role: "assistant", content: "Đã nhận nội dung bài học. Bạn muốn hỏi gì về bài này?" },
    ];

    if (parsed.messages && parsed.messages.length > 0) {
      for (const msg of parsed.messages) {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    } else if (parsed.message) {
      chatMessages.push({ role: "user", content: `Câu hỏi: ${parsed.message}` });
    }

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

    fullText
      .then(async (fullAssistantResponse) => {
        if (userContent && fullAssistantResponse) {
          try {
            await prisma.chatMessage.createMany({
              data: [
                { userId, lessonId, role: "user", content: userContent },
                { userId, lessonId, role: "assistant", content: fullAssistantResponse },
              ],
            });
          } catch (dbError) {
            console.error("[chat] DB persistence failed:", dbError);
          }
        }
      })
      .catch((err) => {
        console.error("[chat] Stream error, skipping DB persistence:", err);
      });

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[AI Route Error]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
