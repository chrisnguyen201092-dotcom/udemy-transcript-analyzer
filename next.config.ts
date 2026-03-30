import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // tesseract.js uses dynamic Worker + WASM; pdf-to-png-converter uses @napi-rs/canvas
  // (native addon) — neither can be bundled by Next.js
  serverExternalPackages: ["tesseract.js", "pdf-to-png-converter", "@napi-rs/canvas"],
  // Ensure WASM files and bundled OCR traineddata are included in standalone output
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/**/*.wasm",
      "./src/lib/tessdata/*.traineddata",
    ],
  },
};

export default nextConfig;
