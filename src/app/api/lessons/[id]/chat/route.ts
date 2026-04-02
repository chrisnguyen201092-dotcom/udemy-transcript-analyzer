import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { lessonId: id, userId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[chat history GET]", error);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    await prisma.chatMessage.deleteMany({
      where: { lessonId: id, userId },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[chat history DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete chat history" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id!;
    const body = ChatMessageSchema.parse(await req.json());

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        userId,
        lessonId: id,
        role: body.role,
        content: body.content,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[chat POST]", error);
    return NextResponse.json({ error: "Failed to save chat message" }, { status: 500 });
  }
});
