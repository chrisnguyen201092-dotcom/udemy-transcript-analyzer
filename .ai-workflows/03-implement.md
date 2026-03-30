# Workflow 03: Implement Feature

## Khi nào dùng
- Spec đã tồn tại trong `docs/specs/`
- Đã đọc và hiểu spec trước khi bắt đầu

## Pre-implementation checklist (BẮTBUỘC)
- [ ] Đọc `docs/specs/{module-name}.md`
- [ ] Đọc code lân cận để hiểu patterns
- [ ] Chạy `npm run build` để biết baseline errors
- [ ] Chạy `lsp_diagnostics` trên files liên quan

## Bước thực hiện

### 1. Đọc spec và API contract
```
docs/specs/{module-name}.md
```

### 2. Kiểm tra Data Model
```
prisma/schema.prisma
```
Nếu cần thay đổi schema:
```bash
# Sửa prisma/schema.prisma
npx prisma db push        # Apply to dev DB
npx prisma generate       # Regenerate client
```

### 3. Implement API route (nếu có)
File: `src/app/api/{path}/route.ts`

Pattern chuẩn:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const RequestSchema = z.object({ ... })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = RequestSchema.parse(body)
    // ... logic
    return NextResponse.json({ ... })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 4. Implement component (nếu có)
File: `src/components/{ComponentName}.tsx`

### 5. Verify
```bash
npm run build   # Phải pass (0 errors)
npm run lint    # Phải pass
npm run test    # Tests liên quan phải pass
```

### 6. Chạy lsp_diagnostics
```
lsp_diagnostics src/app/api/{path}/route.ts
lsp_diagnostics src/components/{ComponentName}.tsx
```

## Quy tắc
- KHÔNG dùng `as any`, `@ts-ignore`, `@ts-expect-error`
- KHÔNG để empty catch blocks: `catch (e) {}`
- KHÔNG refactor code khác khi đang fix bug
- Mọi API route phải có Zod validation
- Mọi error phải được handle và return proper HTTP status
