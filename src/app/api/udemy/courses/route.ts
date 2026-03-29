import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Schema = z.object({
  cookie: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { cookie } = Schema.parse(await req.json());

    // Udemy enrolled courses API — page size 100, sorted by last accessed
    const url =
      "https://www.udemy.com/api-2.0/users/me/subscribed-courses/" +
      "?page_size=100&ordering=-last_accessed&fields[course]=id,title,url,num_lectures";

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cookie}`,
        "Content-Type": "application/json",
        "X-Udemy-Client-Id": "udemy-app",
      },
      // Next.js 16: opt out of caching
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Udemy API error:", res.status, text);
      return NextResponse.json(
        { error: `Udemy trả về ${res.status}. Kiểm tra lại access_token.` },
        { status: 400 }
      );
    }

    const data = await res.json();
    const courses = (data.results ?? []).map(
      (c: { id: number; title: string; url: string; num_lectures: number }) => ({
        id: c.id,
        title: c.title,
        url: c.url,
        num_lectures: c.num_lectures ?? 0,
      })
    );

    return NextResponse.json({ courses, count: courses.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
