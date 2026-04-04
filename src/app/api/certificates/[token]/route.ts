import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET /api/certificates/[token] ────────────────────────────────────────────
// Public endpoint — no auth required. Used by employers/third parties to verify
// a certificate's authenticity via the verifyToken printed on the certificate.

export const GET = async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  try {
    const { token } = await params;

    const certificate = await prisma.certificate.findUnique({
      where: { verifyToken: token },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true, contentType: true } },
      },
    });

    if (!certificate) {
      return NextResponse.json({ valid: false, error: "Certificate not found" }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      certificate: {
        issuedAt: certificate.issuedAt,
        learnerName: certificate.user.name,
        courseTitle: certificate.course.title,
        courseType: certificate.course.contentType,
        completionPct: certificate.completionPct,
        masteryPct: certificate.masteryPct,
        avgQuizScore: certificate.avgQuizScore,
        totalDaysStudied: certificate.totalDaysStudied,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
};
