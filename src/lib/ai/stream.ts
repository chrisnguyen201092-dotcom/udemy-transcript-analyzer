import type OpenAI from "openai";

/**
 * Creates a ReadableStream from an OpenAI streaming response,
 * stripping <think>...</think> blocks in real-time.
 *
 * Returns both the stream (for the HTTP response) and a promise
 * that resolves to the full concatenated text (for DB persistence).
 */
export function createThinkFilteredStream(
  openaiStream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
): { stream: ReadableStream<Uint8Array>; fullText: Promise<string> } {
  let resolveFullText: (value: string) => void;
  let rejectFullText: (reason: unknown) => void;
  const fullText = new Promise<string>((resolve, reject) => {
    resolveFullText = resolve;
    rejectFullText = reject;
  });

  const encoder = new TextEncoder();
  const OPEN_TAG = "<think>";
  const CLOSE_TAG = "</think>";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let inThink = false;
      let buffer = "";
      let fullAssistantResponse = "";
      let settled = false;

      try {
        for await (const chunk of openaiStream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (!content) continue;

          buffer += content;

          // Process buffer: strip <think>...</think> blocks
          let output = "";
          let i = 0;
          let partialHold = false;
          while (i < buffer.length) {
            if (!inThink) {
              const openIdx = buffer.indexOf(OPEN_TAG, i);
              if (openIdx === -1) {
                // No full <think> found. Hold back the tail that might be
                // a partial opening tag (e.g. buffer ends with "<thi").
                const safeEnd = buffer.length - (OPEN_TAG.length - 1);
                if (safeEnd > i) {
                  output += buffer.slice(i, safeEnd);
                  buffer = buffer.slice(safeEnd);
                } else {
                  buffer = buffer.slice(i);
                }
                i = buffer.length;
                partialHold = true;
                break;
              } else {
                output += buffer.slice(i, openIdx);
                inThink = true;
                i = openIdx + OPEN_TAG.length;
              }
            } else {
              const closeIdx = buffer.indexOf(CLOSE_TAG, i);
              if (closeIdx === -1) {
                buffer = buffer.slice(i);
                i = buffer.length;
                partialHold = true;
                break;
              } else {
                inThink = false;
                i = closeIdx + CLOSE_TAG.length;
              }
            }
          }

          // If we consumed the entire buffer without a partial hold-back,
          // clear it so the flush step won't re-emit the raw input.
          if (!partialHold) {
            buffer = "";
          }

          if (output) {
            fullAssistantResponse += output;
            controller.enqueue(encoder.encode(output));
          }
        }

        // Flush any remaining non-think buffer content
        if (buffer && !inThink) {
          fullAssistantResponse += buffer;
          controller.enqueue(encoder.encode(buffer));
        }

        controller.close();
        settled = true;
        resolveFullText!(fullAssistantResponse);
      } catch (err) {
        if (!settled) {
          settled = true;
          rejectFullText!(err);
        }
        controller.error(err);
      }
    },
  });

  return { stream, fullText };
}

/**
 * Standard streaming response headers.
 */
export const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Transfer-Encoding": "chunked",
  "X-Content-Type": "streaming",
} as const;
