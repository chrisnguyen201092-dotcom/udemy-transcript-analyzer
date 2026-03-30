/**
 * OCR utilities for extracting text from scanned PDF pages.
 *
 * Pipeline:
 *   PDF buffer → pdf-to-png-converter (per-page PNG buffers)
 *              → tesseract.js (WASM, zero native deps)
 *              → extracted text
 *
 * The worker is lazily initialised and reused across requests to avoid
 * the ~500 ms spin-up cost on every upload.
 *
 * Offline operation:
 *   Bundled traineddata lives in src/lib/tessdata/ (eng.traineddata, vie.traineddata).
 *   cachePath points there so Tesseract reads local files directly without any
 *   network download (cacheMethod: "readOnly").
 */
import path from "path";
import { pdfToPng } from "pdf-to-png-converter";
import { createWorker, Worker } from "tesseract.js";

// ── Paths ─────────────────────────────────────────────────────────────────────

/**
 * Absolute path to the bundled traineddata directory.
 * In production (Docker), process.cwd() is the app root where the build runs,
 * and Next.js copies tracked files there. For Node.js server-side code we use
 * __dirname to find the source-relative path robustly.
 *
 * tessdata/ sits next to this file in src/lib/ — in Next.js standalone output
 * it is copied via outputFileTracingIncludes in next.config.ts.
 */
const TESSDATA_PATH = path.resolve(__dirname, "tessdata");

// ── Worker singleton ─────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _workerInitialising: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (_worker) return _worker;
  if (_workerInitialising) return _workerInitialising;

  _workerInitialising = createWorker("eng+vie", 1, {
    // Point to bundled traineddata — no network download at runtime
    cachePath: TESSDATA_PATH,
    cacheMethod: "readOnly",
    // Suppress verbose Tesseract progress logs in production
    logger: () => undefined,
  }).then((w) => {
    _worker = w;
    _workerInitialising = null;
    return w;
  });

  return _workerInitialising;
}

/**
 * Release the shared worker. Call once on process exit if needed.
 * Not required during normal operation — the worker is intentionally long-lived.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}

// ── Core OCR function ────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using OCR (Tesseract).
 *
 * Each page is rendered to a 2× PNG (for accuracy), then fed to Tesseract.
 * Pages are processed sequentially to limit peak memory.
 *
 * @returns Extracted text, empty string if no pages or OCR yields nothing.
 */
export async function ocrPdf(pdfBuffer: Buffer): Promise<string> {
  // Render all pages to PNG buffers.
  // pdf-to-png-converter expects ArrayBuffer, not Node Buffer directly.
  const pages = await pdfToPng(pdfBuffer.buffer as ArrayBuffer, {
    disableFontFace: true,
    useSystemFonts: false,
    viewportScale: 2.0, // higher resolution → better OCR accuracy
  });

  if (pages.length === 0) return "";

  const worker = await getWorker();
  const pageTexts: string[] = [];

  for (const page of pages) {
    // page.content is a PNG Buffer; skip if undefined (malformed page)
    if (!page.content) continue;
    const { data } = await worker.recognize(page.content);
    const trimmed = data.text.trim();
    if (trimmed.length > 0) {
      pageTexts.push(trimmed);
    }
  }

  return pageTexts.join("\n\n");
}
