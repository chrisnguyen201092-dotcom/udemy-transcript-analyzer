/**
 * Transcript parsing utilities for VTT, SRT, and plain text files.
 * Extracted from api/courses/upload/route.ts for testability and reuse.
 */

export function parseVtt(text: string): string | null {
  const lines = text
    .split("\n")
    .filter(
      (l) =>
        l.trim() &&
        !l.startsWith("WEBVTT") &&
        !/^\d{2}:\d{2}/.test(l) &&
        !/-->/.test(l)
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return deduped.join(" ").trim() || null;
}

export function parseSrt(text: string): string | null {
  const lines = text
    .split("\n")
    .filter(
      (l) =>
        l.trim() &&
        // Filter out sequence numbers (lines that are just a number)
        !/^\d+$/.test(l.trim()) &&
        // Filter out timestamp lines (00:00:00,000 --> 00:00:00,000)
        !/^\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(l.trim())
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return deduped.join(" ").trim() || null;
}

export function parseTxt(text: string): string | null {
  return text.trim() || null;
}

export function removeExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
