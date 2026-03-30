# Workflow 02: Viết và Chạy Tests

## Khi nào dùng
- Sau khi spec được approve
- Trước hoặc song song với implementation (TDD)
- Sau khi implementation xong để verify

## Test Framework
- **Unit/Integration**: Vitest (`npm run test`)
- **E2E**: Playwright (`npm run test:e2e`)
- **Coverage**: `npm run test:coverage` (target ≥ 80% business logic)

## Cấu trúc thư mục
```
src/
  lib/
    ai/__tests__/prompts.test.ts      # Unit tests cho prompts
    __tests__/parse-vtt.test.ts       # Unit tests cho parsers
  app/api/
    ai/summary/__tests__/route.test.ts  # Integration tests
e2e/
  import-course.spec.ts               # E2E flows
  ai-summary.spec.ts
```

## Bước thực hiện

### 1. Đọc spec
```
docs/specs/{module-name}.md → Acceptance Criteria
```

### 2. Viết unit tests (business logic)
- Test từng function trong `src/lib/`
- Mock external dependencies (OpenAI, Prisma)
- File: `src/lib/**/__tests__/*.test.ts`

### 3. Viết integration tests (API routes)
- Test request → response flow
- Mock database và AI calls
- File: `src/app/api/**/__tests__/*.test.ts`

### 4. Viết E2E tests (critical user flows)
- Chỉ test critical paths từ docs/prd.md Section 9
- File: `e2e/*.spec.ts`

### 5. Chạy tests
```bash
npm run test              # Unit + integration
npm run test:coverage     # With coverage report
npm run test:e2e          # E2E (cần app đang chạy)
```

### 6. Verify
- [ ] Tất cả Acceptance Criteria có test tương ứng
- [ ] Coverage ≥ 80% cho file đang test
- [ ] Không có `expect.assertions()` bị bỏ qua
- [ ] Không xóa test để pass

## Quy tắc
- KHÔNG sửa implementation để test pass
- Nếu test fail do bug → báo cáo cho coder role
- KHÔNG dùng `test.skip` / `it.skip` trừ khi có lý do rõ ràng
