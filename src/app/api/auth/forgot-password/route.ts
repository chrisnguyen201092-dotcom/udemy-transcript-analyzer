/**
 * POST /api/auth/forgot-password — Generate password reset token.
 * Rate limited: 3 requests per 15 minutes per IP.
 * Always returns 200 to prevent email enumeration.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const ForgotSchema = z.object({
  email: z.string().email(),
});

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const body = ForgotSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      select: { id: true },
    });

    if (user) {
      // Generate a random token, store hashed version in DB
      const rawToken = randomBytes(32).toString("hex");
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashedToken,
          resetTokenExp: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
        },
      });

      // In production, send email with rawToken.
      // Token is NOT logged — even in dev, use DB to retrieve hashed token for debugging.
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with that email, a reset link has been sent.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[auth/forgot-password]", err);
    return NextResponse.json(
      { error: "Request failed" },
      { status: 500 }
    );
  }
}
