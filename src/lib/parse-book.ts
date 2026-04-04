/**
 * Book parsing utilities for PDF, DOCX, and Markdown files.
 * Extracted for testability and reuse by /api/books/upload.
 *
 * Covers: B-04 (PDF), B-06 (DOCX), B-07 (Markdown)
 */
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { ocrPdf } from "./ocr";

/**
 * Extract text from a PDF buffer using pdf-parse v2 (PDFParse class).
 * Returns a scanned_pdf warning if text is too short (< 100 chars).
 */
export async function parsePdf(
  buffer: Buffer
): Promise<{ text: string; pages: number; warning?: string }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = result.text ?? "";
    const pages = result.total ?? 0;

    if (text.length < 100) {
      // Attempt OCR fallback for scanned (image-only) PDFs
      try {
        const ocrText = await ocrPdf(buffer);
        if (ocrText.length > 0) {
          return { text: ocrText, pages, warning: "ocr_used" };
        }
      } catch {
        // OCR failed — fall through to scanned_pdf warning
      }
      return { text, pages, warning: "scanned_pdf" };
    }
    return { text, pages };
  } finally {
    await parser.destroy();
  }
}

/**
 * Extract text and HTML from a DOCX buffer using mammoth.
 */
export async function parseDocx(
  buffer: Buffer
): Promise<{ text: string; html: string }> {
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);
  return {
    text: rawResult.value,
    html: htmlResult.value,
  };
}

/**
 * Split markdown text into chapters by H1 headings (`# Title`).
 * Returns empty array if no H1 headings found.
 * Content before the first heading is preserved as a "Preamble" chapter.
 */
export function parseMarkdownChapters(
  text: string
): { title: string; content: string }[] {
  const lines = text.split("\n");
  const chapters: { title: string; content: string }[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];
  const preambleLines: string[] = [];

  for (const line of lines) {
    // Match only H1: starts with exactly one # followed by space
    const match = line.match(/^#\s+(.+)/);
    if (match && !line.startsWith("##")) {
      // Save previous chapter if any
      if (currentTitle !== null) {
        chapters.push({
          title: currentTitle.trim(),
          content: currentLines.join("\n").trim(),
        });
      } else if (preambleLines.length > 0) {
        // Preserve preamble content before first heading
        const preambleContent = preambleLines.join("\n").trim();
        if (preambleContent.length > 0) {
          chapters.push({
            title: "Preamble",
            content: preambleContent,
          });
        }
      }
      currentTitle = match[1];
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    } else {
      // Lines before first H1 → preamble
      preambleLines.push(line);
    }
  }

  // Push last chapter
  if (currentTitle !== null) {
    chapters.push({
      title: currentTitle.trim(),
      content: currentLines.join("\n").trim(),
    });
  }

  return chapters;
}
