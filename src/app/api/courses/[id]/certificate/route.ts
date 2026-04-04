import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { checkCertificateEligibility, getTimezoneFromRequest } from "@/lib/progress-helpers";

// ─── GET /api/courses/[id]/certificate ────────────────────────────────────────
// Returns existing certificate or eligibility preview if not yet issued.

export const GET = withAuth(async (req, { userId, params }) => {
  try {
    const courseId = params?.id ?? "";
    const timezone = getTimezoneFromRequest(req);

    const existing = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) {
      return NextResponse.json({ certificate: existing, eligible: true });
    }

    // Not yet issued — return eligibility status so the UI can show a CTA
    const eligibility = await checkCertificateEligibility(userId, courseId, timezone);
    return NextResponse.json({ certificate: null, ...eligibility });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get certificate" }, { status: 500 });
  }
});

// ─── POST /api/courses/[id]/certificate ───────────────────────────────────────
// Issues a new certificate when all mastery conditions are met.

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const courseId = params?.id ?? "";
    const timezone = getTimezoneFromRequest(req);

    // Guard: don't re-issue
    const existing = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) {
      return NextResponse.json({ certificate: existing }, { status: 200 });
    }

    // Check all conditions
    const eligibility = await checkCertificateEligibility(userId, courseId, timezone);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: eligibility.reason, ...eligibility },
        { status: 422 }
      );
    }

    const certificate = await prisma.certificate.create({
      data: {
        userId,
        courseId,
        completionPct: eligibility.completionPct,
        masteryPct: eligibility.masteryPct,
        avgQuizScore: eligibility.avgQuizScore,
        totalDaysStudied: eligibility.totalDaysStudied,
      },
    });

    return NextResponse.json({ certificate }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to issue certificate" }, { status: 500 });
  }
});
