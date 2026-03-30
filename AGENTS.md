<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Udemy Learner — Agent Roles & Conventions

## Project Overview

**Udemy Learner** là ứng dụng web AI-powered giúp học viên Udemy học hiệu quả hơn.
Tech stack: Next.js 16 (App Router) · React 19 · TypeScript · Prisma + SQLite · Tailwind CSS v4 · shadcn/ui · OpenAI SDK

**Key docs:**
- PRD: `docs/prd.md`
- Feature list: `docs/features.md`
- Feature specs: `docs/specs/*.md`
- Implementation order: `docs/implementation-order.md`
- AI Workflows: `.ai-workflows/*.md`

---

## Agent Roles

### 🖊️ spec-writer
**Nhiệm vụ:** Viết và duy trì feature specs từ PRD.

**Phạm vi:**
- Đọc `docs/prd.md` và `docs/features.md` để hiểu yêu cầu
- Tạo hoặc cập nhật file trong `docs/specs/`
- Mỗi spec phải có: Goal, User stories, Acceptance criteria, Edge cases, API contract, Data model changes

**Quy tắc:**
- KHÔNG viết code implementation
- KHÔNG thay đổi file ngoài `docs/`
- Mỗi spec file = 1 module từ PRD
- Acceptance criteria phải verifiable (có thể test được)

**Output format:** `docs/specs/{module-name}.md`

---

### 🧪 tester
**Nhiệm vụ:** Viết và chạy tests (unit, integration, E2E).

**Phạm vi:**
- Unit/integration tests: `src/**/__tests__/` hoặc `src/**/*.test.ts`
- E2E tests: `e2e/`
- Test framework: Vitest (unit/integration), Playwright (E2E)
- Coverage target: ≥ 80% cho business logic

**Quy tắc:**
- KHÔNG sửa implementation code để tests pass
- Nếu test fail do bug thực sự → báo cáo cho coder, KHÔNG tự fix
- KHÔNG xóa test cases để pass
- Chạy `npm run test` để verify trước khi báo cáo
- Sử dụng workflow: `.ai-workflows/02-test.md`

**Output:** Test files + coverage report

---

### 💻 coder
**Nhiệm vụ:** Implement features theo specs đã được approve.

**Phạm vi:**
- `src/` — tất cả application code
- `prisma/` — schema migrations
- `public/` — static assets nếu cần

**Quy tắc:**
- Luôn đọc spec trong `docs/specs/` TRƯỚC khi code
- KHÔNG dùng `as any`, `@ts-ignore`, `@ts-expect-error`
- KHÔNG để empty catch blocks
- Match existing patterns trong codebase (đọc code lân cận trước khi viết)
- Chạy `npm run build` và `npm run lint` sau mỗi feature
- Sử dụng workflow: `.ai-workflows/03-implement.md`

**Pre-implementation checklist:**
- [ ] Đã đọc spec file liên quan
- [ ] Đã đọc code lân cận để hiểu patterns
- [ ] Đã chạy `lsp_diagnostics` trước khi bắt đầu

---

### 🔍 reviewer
**Nhiệm vụ:** Review code changes trước khi merge.

**Phạm vi:**
- Review `git diff` của feature branch
- Kiểm tra spec compliance
- Kiểm tra code quality, security, performance

**Review checklist:**
- [ ] Code match spec trong `docs/specs/`?
- [ ] TypeScript errors? (`npm run build`)
- [ ] Lint errors? (`npm run lint`)
- [ ] Tests pass? (`npm run test`)
- [ ] No `as any` / `@ts-ignore`?
- [ ] Error handling đầy đủ?
- [ ] API routes có validation (Zod)?
- [ ] Sensitive data (API key, token) không bị log?

**Quy tắc:**
- KHÔNG approve nếu build fail
- KHÔNG approve nếu regression tests fail
- Sử dụng workflow: `.ai-workflows/04-review.md`

---

### ⚙️ ops
**Nhiệm vụ:** Infrastructure, CI/CD, deployment, monitoring.

**Phạm vi:**
- `.github/workflows/` — CI/CD pipelines
- `Dockerfile`, `docker-compose.yml` — container config
- `scripts/` — automation scripts
- `prisma/` — database migrations trong production

**Quy tắc:**
- KHÔNG thay đổi application code
- Mọi secret phải qua environment variables, KHÔNG hardcode
- Test Docker build locally trước khi push
- Sử dụng workflow: `.ai-workflows/06-deploy.md`

**Key commands:**
```bash
docker compose up -d          # Start production
docker compose up -d --build  # Rebuild + start
docker compose logs -f        # View logs
npm run quality-gate          # Run full quality check
```

---

## Shared Conventions

### File naming
- Components: `PascalCase.tsx`
- Hooks: `useHookName.ts`
- Utils: `camelCase.ts`
- Tests: `ComponentName.test.ts` hoặc `ComponentName.test.tsx`
- Specs: `kebab-case.md`

### Branch naming
- Feature: `feat/{feature-name}`
- Fix: `fix/{bug-description}`
- Docs: `docs/{what-changed}`

### Commit format (Conventional Commits)
```
feat(module): add AI quiz generation
fix(upload): handle empty VTT file
docs(specs): add roadmap spec
test(ai): add unit tests for prompt builder
chore(ci): add quality gate workflow
```

### Environment variables
Xem `.env.example` để biết các biến cần thiết. KHÔNG commit `.env`.

### Database
- Schema: `prisma/schema.prisma` — source of truth
- Sau khi thay đổi schema: `npx prisma db push` (dev) / migration file (prod)
- Client singleton: `src/lib/prisma.ts`
