# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: Build the application ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
# Copy static assets
COPY --from=builder /app/.next/static ./.next/static
# Copy public folder (if exists)
COPY --from=builder /app/public ./public

# Copy Prisma schema + migration files (for db push on startup)
COPY --from=builder /app/prisma ./prisma
# Copy Prisma runtime (generated client + CLI + engine)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy tesseract.js (WASM-based OCR — not bundled by Next.js standalone)
COPY --from=builder /app/node_modules/tesseract.js ./node_modules/tesseract.js

# Copy pdf-to-png-converter + its native canvas addon (not bundled by Next.js standalone)
COPY --from=builder /app/node_modules/pdf-to-png-converter ./node_modules/pdf-to-png-converter
COPY --from=builder /app/node_modules/@napi-rs ./node_modules/@napi-rs

# Copy pdf-parse and mammoth (not bundled by Next.js standalone)
COPY --from=builder /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=builder /app/node_modules/mammoth ./node_modules/mammoth

# Copy pdfjs-dist (pdf-parse depends on it; pdf.worker.mjs is dynamically imported
# at runtime so Next.js standalone tracer misses it — must be explicit)
COPY --from=builder /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create data directory for SQLite and set permissions
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
