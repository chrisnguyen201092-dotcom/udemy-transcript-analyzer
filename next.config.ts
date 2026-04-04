import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://strategylab.io.vn"],
  output: "standalone",
  // Prevent aggressive caching of HTML pages — ensures new builds are
  // picked up without hard refresh.
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
