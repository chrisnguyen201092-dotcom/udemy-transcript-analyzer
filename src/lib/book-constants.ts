/**
 * Shared constants for book upload routes.
 * Centralised here to ensure upload and split routes enforce the same limits.
 */

/** Maximum allowed content size: 50 MB (base64 encoded → ~37 MB raw) */
export const MAX_BOOK_CONTENT_LENGTH = 50 * 1024 * 1024;

/** Supported book file extensions */
export const SUPPORTED_BOOK_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md", ".epub"]);
