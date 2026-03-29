import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { z } from "zod";

const CreateCourseSchema = z.object({
  url: z.string().optional(),
  title: z.string().min(1),
});

export async function GET() {
  const courses = await prisma.course.findMany({
    include: { lessons: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, title } = CreateCourseSchema.parse(body);

    if (url) {
      const existingCourse = await prisma.course.findFirst({
        where: { url },
      });
      if (existingCourse) {
        return NextResponse.json(existingCourse, { status: 200 });
      }
    }

    const course = await prisma.course.create({
      data: {
        url: url || `manual:${randomUUID()}`,
        title,
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
}
