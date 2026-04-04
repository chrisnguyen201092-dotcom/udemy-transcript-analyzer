import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const UpdateSchema = z.object({
  title: z.string().min(1).max(200),
});

export const PUT = withAuth(async (req, { userId, params }) => {
  const id = params?.id ?? "";
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Verify lesson belongs to a course owned by this user
  const lesson = await prisma.lesson.findFirst({
    where: { id, course: { userId } },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.lesson.update({
    where: { id },
    data: { title: parsed.data.title },
  });
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_req, { userId, params }) => {
  const id = params?.id ?? "";
  // Verify lesson belongs to a course owned by this user
  const lesson = await prisma.lesson.findFirst({
    where: { id, course: { userId } },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.lesson.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
