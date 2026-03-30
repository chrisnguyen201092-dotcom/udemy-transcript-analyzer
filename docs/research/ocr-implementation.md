# OCR Research: Next.js 16 + Docker
Date: 2026-03-30

## 1. OCR: tesseract.js v7.0.0
npm install tesseract.js
Pure WASM, zero system deps, Node 18+, Docker Alpine compatible.

## 2. PDF-to-Image: pdf-to-png-converter v3.14.0
npm install pdf-to-png-converter
Zero native deps, bundles pdfjs internally, returns Buffer[] per page.

## 3. Next.js Fix
serverExternalPackages: ['tesseract.js'] in next.config.ts
See: github.com/FlintSH/Flare/blob/main/next.config.ts

## 4. Docker
No changes needed to Dockerfile.

