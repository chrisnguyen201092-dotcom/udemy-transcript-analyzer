# Workflow 05: Integration

## Khi nào dùng
- Sau khi feature branch đã được review và approve
- Trước khi merge vào main

## Bước thực hiện

### 1. Verify branch trạng thái
```bash
git status
git log main..HEAD --oneline
```

### 2. Chạy full quality gate
```bash
npm run quality-gate
```

Nếu không có quality-gate script:
```bash
npm run build && npm run lint && npm run test
```

### 3. Kiểm tra database migration
```bash
# Nếu có schema changes
npx prisma validate
npx prisma db push --preview-feature  # dry run
```

### 4. Test tích hợp thủ công (critical paths)
Dựa trên `docs/prd.md` Section 9:
- [ ] Flow 1: Import khóa học từ Udemy (nếu có token)
- [ ] Flow 2: Upload transcript từ file
- [ ] Flow 3: AI Summary tạo và persist
- [ ] Flow 4: AI Practice (quiz/flashcard/exercises)
- [ ] Flow 5: AI Roadmap toàn khóa
- [ ] Flow 7: Settings lưu và load

### 5. Merge
```bash
git checkout main
git merge --no-ff feat/{feature-name} -m "feat: {description}"
```

### 6. Verify sau merge
```bash
npm run build
npm run test
```

## Quy tắc
- KHÔNG merge nếu quality-gate fail
- KHÔNG force push vào main
- Mọi schema migration phải được test trên DB dev trước
