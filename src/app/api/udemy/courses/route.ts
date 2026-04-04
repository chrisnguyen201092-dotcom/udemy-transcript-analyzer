import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const Schema = z.object({
  cookie: z.string().min(1),
});

// M-29: validate pagination URLs stay on www.udemy.com over HTTPS
function validateNextUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.udemy.com" && parsed.protocol === "https:") return url;
    return null;
  } catch {
    return null;
  }
}

export const POST = withAuth(async (req) => {
  try {
    const { cookie } = Schema.parse(await req.json());

    const headers = {
      Authorization: `Bearer ${cookie}`,
      "Content-Type": "application/json",
      "X-Udemy-Client-Id": "udemy-app",
    };

    // M-29: paginate through all enrolled courses (users may have 100+)
    const allCourses: { id: number; title: string; url: string; num_lectures: number }[] = [];
    let nextUrl: string | null =
      "https://www.udemy.com/api-2.0/users/me/subscribed-courses/" +
      "?page_size=100&ordering=-last_accessed&fields[course]=id,title,url,num_lectures";
    const MAX_PAGES = 10; // safety cap to prevent infinite loops
    let page = 0;

    while (nextUrl && page < MAX_PAGES) {
      const res: Response = await fetch(nextUrl, {
        headers,
        // Next.js 16: opt out of caching
        cache: "no-store",
      });

      if (!res.ok) {
        // Report error only on the first page; subsequent pages fail silently
        if (page === 0) {
          const text = await res.text();
          console.error("Udemy API error:", res.status, text);
          // M-5: differentiate error messages by HTTP status code
          const status = res.status;
          if (status === 401 || status === 403) {
            return NextResponse.json(
              { error: `Udemy trả về ${status}. Kiểm tra lại access_token.` },
              { status }
            );
          }
          if (status === 429) {
            return NextResponse.json(
              { error: "Udemy rate limit. Thử lại sau." },
              { status: 429 }
            );
          }
          return NextResponse.json(
            { error: `Udemy trả về lỗi ${status}` },
            { status }
          );
        }
        break;
      }

      const data: { results?: unknown[]; next?: string | null } = await res.json();
      const results = (data.results ?? []) as Array<{
        id: number;
        title: string;
        url: string;
        num_lectures: number;
      }>;

      allCourses.push(
        ...results.map((c) => ({
          id: c.id,
          title: c.title,
          url: c.url,
          num_lectures: c.num_lectures ?? 0,
        }))
      );

      // M-29: validate next page URL before following it
      nextUrl = data.next ? validateNextUrl(data.next) : null;
      page++;
    }

    return NextResponse.json({ courses: allCourses, count: allCourses.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
});
