import type { Lesson, CourseData } from "@/lib/types";

export async function crawlCourse(
  courseUrl: string,
  cookies: Array<{ name: string; value: string; domain: string }>
): Promise<CourseData> {
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

    return { title: courseTitle, lessons };
  } finally {
    await browser.close();
  }
}

export async function getLessonTranscript(
  courseUrl: string,
  lessonIndex: number,
  cookies: Array<{ name: string; value: string; domain: string }>
): Promise<string> {
  const puppeteer = await import("puppeteer-extra");
  const stealth = (await import("puppeteer-extra-plugin-stealth")).default;
  
  puppeteer.default.use(stealth());

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setCookie(...cookies);

    const lessonsSelector = await page.evaluate((idx) => {
      const items = document.querySelectorAll('[data-purpose="curriculum-item"]');
      const targetItem = items[idx];
      const link = targetItem?.querySelector("a");
      return link?.getAttribute("href") || null;
    }, lessonIndex);

    if (!lessonsSelector) throw new Error("Lesson not found");

    await page.goto(lessonsSelector, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector('[data-purpose="transcript-body"]', { timeout: 10000 });

    const transcript = await page.evaluate(() => {
      const el = document.querySelector('[data-purpose="transcript-body"]');
      return el?.textContent?.trim() || "";
    });

    return transcript;
  } finally {
    await browser.close();
  }
}
