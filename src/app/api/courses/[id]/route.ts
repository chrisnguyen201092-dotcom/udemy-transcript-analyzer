import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req, { userId, params }) => {
  const id = params?.id ?? "";
  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  return NextResponse.json(course);
});

export const PATCH = withAuth(async (req, { userId, params }) => {
  const id = params?.id ?? "";
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const existing = await prisma.course.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const course = await prisma.course.update({
    where: { id },
    data: { title },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(course);
});

export const DELETE = withAuth(async (_req, { userId, params }) => {
  const id = params?.id ?? "";
  const existing = await prisma.course.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
