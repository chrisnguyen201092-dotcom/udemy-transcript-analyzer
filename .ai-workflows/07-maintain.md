# Workflow 07: Maintain

## Khi nào dùng
- Bug report từ production
- Performance issue
- Dependency updates
- Tech debt cleanup

## Bug Fix Process

### 1. Reproduce bug
```bash
# Ghi lại exact steps to reproduce
# Kiểm tra git log để biết khi nào bug xuất hiện
git log --oneline --since="2 weeks ago"
```

### 2. Diagnose
```bash
docker compose logs -f  # Production logs
# Hoặc check browser console
```

### 3. Fix tối thiểu (Minimal fix rule)
- Fix root cause, KHÔNG refactor đồng thời
- Viết regression test trước khi fix
- Verify fix không break existing tests

### 4. Commit
```bash
git commit -m "fix(module): {mô tả bug và fix}"
```

## Dependency Updates

### Check outdated
```bash
npm outdated
```

### Update carefully
```bash
# Cập nhật từng package, test sau mỗi update
npm update {package-name}
npm run build && npm run test
```

### Breaking changes
- Đọc CHANGELOG của package trước
- Test kỹ các feature dùng package đó

## Performance Monitoring

### Slow API routes
- Kiểm tra Prisma queries: thêm `include` để tránh N+1
- AI calls: đảm bảo streaming hoạt động (không block)

### Database size
```bash
ls -lh prisma/dev.db
```

## Tech Debt

### Identify
```bash
# Tìm TODOs và FIXMEs
grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx"
```

### Prioritize
- BLOCKING (app breaks): fix ngay
- HIGH (performance/security): sprint tiếp theo
- LOW (cleanup): backlog

## Quy tắc
- KHÔNG fix nhiều bugs trong 1 commit
- Mọi bug fix phải có regression test
- KHÔNG upgrade major versions mà không test kỹ
- Document known issues trong `docs/known-issues.md`
