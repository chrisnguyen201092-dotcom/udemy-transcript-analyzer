/**
 * EPUB parsing using epub2 library.
 * epub2 requires a file path (not Buffer) — uses temp file with guaranteed cleanup.
 *
 * Covers: Phase 1 F1-F4 (EPUB upload, chapters, metadata)
 */
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import EPub from "epub2";
import { sanitizeEpubHtml, stripHtmlTags } from "./file-security";

const PARSE_TIMEOUT_MS = 30_000;

export interface EpubChapter {
  title: string;
  content: string;
}

export interface EpubMetadata {
  title?: string;
  author?: string;
  description?: string;
  language?: string;
  identifier?: string;
}

export interface EpubParseResult {
  text: string;
  chapters: EpubChapter[];
  metadata: EpubMetadata;
}

/** Resolve the best available title for a spine item from the TOC map */
function resolveTocTitle(
  itemId: string,
  itemTitle: string | undefined,
  tocMap: Map<string, string>,
  index: number
): string {
  return tocMap.get(itemId) ?? itemTitle ?? `Chương ${index + 1}`;
}

/** Get raw HTML content of a chapter by id, wrapped in a timeout */
function getChapterRaw(epub: EPub, id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    epub.getChapterRaw(id, (err, text) => {
      if (err) reject(new Error(`Không thể đọc chương ${id}: ${String(err)}`));
      else resolve(text ?? "");
    });
  });
}

/**
 * Parse an EPUB buffer.
 * Writes a temp file, parses with epub2, cleans up in finally block.
 * Throws on timeout (30s) or parse error.
 */
export async function parseEpub(buffer: Buffer): Promise<EpubParseResult> {
  const tmpFile = path.join(
    os.tmpdir(),
    `epub-${Date.now()}-${Math.random().toString(36).slice(2)}.epub`
  );

  await fs.writeFile(tmpFile, buffer);

  try {
    return await Promise.race([
      doParse(tmpFile),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("EPUB parsing timeout (30s)")), PARSE_TIMEOUT_MS)
      ),
    ]);
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

async function doParse(tmpFile: string): Promise<EpubParseResult> {
  const epub = await EPub.createAsync(tmpFile);

  // ── Metadata ──────────────────────────────────────────────────────────────
  const meta = epub.metadata as Record<string, unknown>;
  const creatorRaw = meta.creator;
  const author = Array.isArray(creatorRaw)
    ? (creatorRaw as string[]).join(", ")
    : typeof creatorRaw === "string"
    ? creatorRaw
    : undefined;

  const metadata: EpubMetadata = {
    title: typeof meta.title === "string" ? meta.title : undefined,
    author,
    description: typeof meta.description === "string" ? meta.description : undefined,
    language: typeof meta.language === "string" ? meta.language : undefined,
    identifier: typeof meta.identifier === "string" ? meta.identifier : undefined,
  };

  // ── TOC id → title map ────────────────────────────────────────────────────
  const tocMap = new Map<string, string>();
  if (Array.isArray(epub.toc)) {
    for (const entry of epub.toc as Array<{ id?: string; title?: string }>) {
      if (entry.id && entry.title) tocMap.set(entry.id, entry.title);
    }
  }

  // ── Spine → chapters ──────────────────────────────────────────────────────
  const spineItems = (epub.spine as { contents: Array<{ id: string; title?: string }> }).contents;
  const chapters: EpubChapter[] = [];
  const textParts: string[] = [];

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    let rawHtml = "";
    try {
      rawHtml = await getChapterRaw(epub, item.id);
    } catch {
      // Skip unreadable chapters — don't abort entire parse
      continue;
    }

    const safeHtml = sanitizeEpubHtml(rawHtml);
    const text = stripHtmlTags(safeHtml).trim();

    if (!text) continue; // Skip empty chapters (e.g. nav/cover pages)

    const title = resolveTocTitle(item.id, item.title, tocMap, i);
    chapters.push({ title, content: text });
    textParts.push(text);
  }

  const text = textParts.join("\n\n");
  return { text, chapters, metadata };
}
