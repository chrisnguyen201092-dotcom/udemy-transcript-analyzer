import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CrawlSchema = z.object({
  courseUrl: z.string().url(),
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const { courseUrl, cookies } = CrawlSchema.parse(await req.json());

    const puppeteer = await import("puppeteer-extra");
    const stealth = (await import("puppeteer-extra-plugin-stealth")).default;
    
    puppeteer.default.use(stealth());

    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setCookie(...cookies);
      
      await page.goto(courseUrl, { waitUntil: "networkidle2", timeout: 60000 });

      const courseTitle = await page.title();

      const lessons = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-purpose="curriculum-item"]');
        return Array.from(items).map((item, index) => ({
          title: item.querySelector('[data-purpose="curriculum-item-title"]')?.textContent?.trim() || `Lesson ${index + 1}`,
          order: index + 1,
        }));
      });

      return NextResponse.json({ title: courseTitle, lessons });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Crawl error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to crawl course" }, { status: 500 });
  }
}
