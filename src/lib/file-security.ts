/**
 * File security utilities: magic-byte validation and ZIP decompression limits.
 * Used by book upload/split routes to prevent file spoofing and ZIP bombs.
 *
 * Covers: Phase 1 security requirements (magic bytes, ZIP limits, path traversal)
 */

/** ZIP local file header signature: PK\x03\x04 */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** ZIP decompression limits */
export const ZIP_LIMITS = {
  maxEntries: 1000,
  maxTotalUncompressedBytes: 200 * 1024 * 1024, // 200 MB
  maxSingleEntryBytes: 50 * 1024 * 1024, // 50 MB
} as const;

/** Check if buffer starts with the given magic bytes */
function startsWith(buf: Buffer, magic: Buffer | number[]): boolean {
  const m = Buffer.isBuffer(magic) ? magic : Buffer.from(magic);
  if (buf.length < m.length) return false;
  return buf.subarray(0, m.length).equals(m);
}

/**
 * Validate that a file buffer matches the expected magic bytes for its extension.
 * Throws a descriptive error if validation fails.
 */
export function validateMagicBytes(buffer: Buffer, ext: string): void {
  switch (ext) {
    case ".pdf": {
      // PDF magic: %PDF (25 50 44 46)
      const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      if (!startsWith(buffer, pdfMagic)) {
        throw new Error("File không hợp lệ: không phải PDF (magic bytes không khớp)");
      }
      break;
    }
    case ".epub": {
      // EPUB is a ZIP file — must start with PK\x03\x04
      if (!startsWith(buffer, ZIP_MAGIC)) {
        throw new Error("File không hợp lệ: không phải EPUB (magic bytes không khớp)");
      }
      // Additional check: look for 'mimetype' entry containing 'application/epub+zip'
      // The mimetype file is typically near the start of the ZIP
      const bufStr = buffer.subarray(0, Math.min(buffer.length, 2048)).toString("binary");
      if (!bufStr.includes("application/epub+zip")) {
        throw new Error("File không hợp lệ: không phải EPUB (thiếu mimetype application/epub+zip)");
      }
      break;
    }
    case ".docx": {
      // DOCX is a ZIP file — must start with PK\x03\x04
      if (!startsWith(buffer, ZIP_MAGIC)) {
        throw new Error("File không hợp lệ: không phải DOCX (magic bytes không khớp)");
      }
      break;
    }
    // .txt and .md are plain text — no magic bytes to validate
    default:
      break;
  }
}

/**
 * Sanitize HTML from EPUB chapters:
 * - Strip <script> tags and their content
 * - Remove inline event handlers (on* attributes)
 * Returns sanitized HTML string.
 */
export function sanitizeEpubHtml(html: string): string {
  // Remove <script>...</script> blocks (case-insensitive, multiline)
  let sanitized = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  // Remove inline event handlers (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  return sanitized;
}

/**
 * Strip HTML tags to produce plain text.
 * Handles self-closing tags, preserves whitespace structure.
 */
export function stripHtmlTags(html: string): string {
  // Replace block-level tags with newlines for readability (before stripping)
  const withNewlines = html
    .replace(/&nbsp;/g, " ")
    .replace(/<\/?(p|div|h[1-6]|li|br|tr|blockquote)[^>]*>/gi, "\n");
  // Strip remaining tags
  const stripped = withNewlines.replace(/<[^>]+>/g, "");
  // Decode common HTML entities after tag removal (so &lt;3&gt; → <3>, not removed as tag)
  return stripped
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
