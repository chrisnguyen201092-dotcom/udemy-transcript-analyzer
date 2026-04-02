import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const CreateCourseSchema = z.object({
  url: z.string().optional(),
  title: z.string().min(1),
  contentType: z.enum(["course", "book"]).default("course"),
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
});

export const GET = withAuth(async (_req, { userId }) => {
  const courses = await prisma.course.findMany({
    where: { userId },
    include: { lessons: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(courses);
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const { url, title, contentType, author, isbn, publisher } = CreateCourseSchema.parse(body);

    if (url) {
      const existingCourse = await prisma.course.findFirst({
        where: { url, userId },
      });
      if (existingCourse) {
        return NextResponse.json(existingCourse, { status: 200 });
      }
    }

    const course = await prisma.course.create({
      data: {
        userId,
        url: url || `manual:${randomUUID()}`,
        title,
        contentType,
        author,
        isbn,
        publisher,
        lessons: { create: [] },
      },
      include: { lessons: true },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
});
