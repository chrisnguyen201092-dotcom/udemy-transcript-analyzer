# Workflow 04: Code Review

## Khi nào dùng
- Trước khi merge feature branch
- Sau khi implementation xong
- Khi nhận yêu cầu review từ coder

## Bước thực hiện

### 1. Lấy diff
```bash
git diff main...HEAD
git log main..HEAD --oneline
```

### 2. Kiểm tra spec compliance
```
docs/specs/{module-name}.md → Acceptance Criteria
```
- [ ] Mọi Acceptance Criteria đều được implement?
- [ ] Edge cases được handle?
- [ ] API contract match spec?

### 3. Chạy quality checks
```bash
npm run build         # TypeScript + Next.js build
npm run lint          # ESLint
npm run test          # Unit + integration tests
```

### 4. Review checklist

#### TypeScript
- [ ] Không có `as any`, `@ts-ignore`, `@ts-expect-error`
- [ ] Types rõ ràng, không dùng `unknown` không cần thiết
- [ ] Interfaces/types được export nếu dùng ở nhiều nơi

#### Error Handling
- [ ] Không có empty catch blocks
- [ ] API routes có try/catch
- [ ] Proper HTTP status codes (400 validation, 401 auth, 500 server)
- [ ] Error messages không expose stack trace

#### Security
- [ ] API routes có Zod validation
- [ ] Không log sensitive data (API key, token, password)
- [ ] SQL injection không thể xảy ra (dùng Prisma parameterized queries)
- [ ] Không hardcode secrets

#### Performance
- [ ] Không có N+1 queries (dùng Prisma `include`)
- [ ] AI calls không block UI (streaming hoặc loading state)
- [ ] Transcript dài được truncate trước khi gửi AI

#### Code Quality
- [ ] Functions ≤ 50 lines (nếu hơn → tách)
- [ ] Tên biến/hàm rõ nghĩa
- [ ] Không có dead code
- [ ] DRY — không copy-paste logic

### 5. Báo cáo
Format:
```
## Review: {Feature Name}

### ✅ Pass
- Build: OK
- Lint: OK
- Tests: X/X pass

### ⚠️ Issues
- [BLOCKING] {vấn đề cần fix trước khi merge}
- [SUGGESTION] {cải tiến không bắt buộc}

### Verdict: APPROVE / REQUEST_CHANGES
```

## Quy tắc
- KHÔNG approve nếu build fail
- KHÔNG approve nếu có BLOCKING issues
- KHÔNG sửa code trực tiếp — chỉ comment và yêu cầu coder fix
