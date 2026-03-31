import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://strategylab.io.vn"],
  output: "standalone",
  // tesseract.js uses dynamic Worker + WASM; pdf-to-png-converter uses @napi-rs/canvas
  // (native addon) — neither can be bundled by Next.js.
  // pdf-parse + pdfjs-dist: pdfjs dynamically imports pdf.worker.mjs at runtime (not
  // statically traceable) — must be external AND explicitly included in tracing globs.
  // mammoth uses native bindings.
  serverExternalPackages: [
    "tesseract.js",
    "pdf-to-png-converter",
    "@napi-rs/canvas",
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
  ],
  // Ensure WASM files, OCR traineddata, and pdfjs worker (dynamically imported) are
  // included in standalone output — Next.js tracer misses dynamic imports.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/**/*.wasm",
      "./src/lib/tessdata/*.traineddata",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
  },
};

export default nextConfig;
