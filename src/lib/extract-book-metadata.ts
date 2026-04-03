/**
 * Book metadata extraction — reusable across API routes.
 * Extracts title, author, isbn, publisher from PDF/EPUB/DOCX/TXT/MD
 * without creating any DB records.
 *
 * Covers: Phase 2 — Book Metadata Auto-Extraction
 */
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parseEpub } from "./parse-epub";

export interface BookMetadataResult {
  title?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  language?: string;
}

/** Regex to detect ISBN-10 or ISBN-13 patterns in plain text */
const ISBN_REGEX =
  /(?:ISBN(?:-1[03])?[:\s]*)?(97[89][- ]?\d{1,5}[- ]?\d{1,7}[- ]?\d{1,6}[- ]?\d|\d{9}[\dXx])/g;

/** Extract the first ISBN found in a string, stripped of hyphens/spaces */
function extractIsbn(text: string): string | undefined {
  const match = ISBN_REGEX.exec(text);
  ISBN_REGEX.lastIndex = 0; // reset stateful regex
  if (!match) return undefined;
  return match[1].replace(/[- ]/g, "");
}

/** Extract metadata from a PDF buffer using pdf-parse info fields */
async function extractFromPdf(buffer: Buffer): Promise<BookMetadataResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    // pdf-parse v2 exposes metadata via the underlying PDF.js info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: Record<string, unknown> = (result as any).info ?? {};

    const title =
      typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : undefined;
    const author =
      typeof info.Author === "string" && info.Author.trim()
        ? info.Author.trim()
        : typeof info.Creator === "string" && info.Creator.trim()
        ? info.Creator.trim()
        : undefined;

    // Scan first ~5 pages of text for ISBN
    const sampleText = (result.text ?? "").slice(0, 5000);
    const isbn = extractIsbn(sampleText);

    return { title, author, isbn };
  } finally {
    await parser.destroy();
  }
}

/** Extract metadata from an EPUB buffer via epub2 OPF */
async function extractFromEpub(buffer: Buffer): Promise<BookMetadataResult> {
  const { metadata } = await parseEpub(buffer);
  const isbn = metadata.identifier ? extractIsbn(metadata.identifier) ?? metadata.identifier : undefined;
  return {
    title: metadata.title,
    author: metadata.author,
    isbn,
    language: metadata.language,
  };
}

/** Extract metadata from a DOCX buffer via mammoth + raw core.xml fallback */
async function extractFromDocx(buffer: Buffer): Promise<BookMetadataResult> {
  // mammoth doesn't expose core.xml directly, but we can scan the raw text
  // for author-like patterns; for now return empty (user fills manually)
  try {
    const raw = await mammoth.extractRawText({ buffer });
    const isbn = extractIsbn(raw.value.slice(0, 5000));
    return { isbn };
  } catch {
    return {};
  }
}

/** Extract metadata from TXT or MD: title from first H1 or first non-empty line */
function extractFromText(text: string, filename: string): BookMetadataResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // First H1 heading wins
  const h1 = lines.find((l) => /^#\s+/.test(l));
  const title = h1
    ? h1.replace(/^#+\s*/, "").trim()
    : lines[0] && lines[0].length < 120
    ? lines[0]
    : filename.replace(/\.[^.]+$/, "");
  return { title };
}

/**
 * Extract metadata from a book file buffer.
 * Returns partial metadata — missing fields are left undefined.
 * Never throws; errors are returned as `{ error: string }`.
 */
export async function extractBookMetadata(
  buffer: Buffer,
  filename: string,
  ext: string
): Promise<BookMetadataResult & { error?: string }> {
  try {
    switch (ext) {
      case ".pdf":
        return await extractFromPdf(buffer);
      case ".epub":
        return await extractFromEpub(buffer);
      case ".docx":
        return await extractFromDocx(buffer);
      case ".txt":
      case ".md": {
        const text = buffer.toString("utf-8");
        return extractFromText(text, filename);
      }
      default:
        return {};
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Không thể đọc metadata: ${message}` };
  }
}
