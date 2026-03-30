# Workflow 01: Viết Feature Spec

## Khi nào dùng
- Nhận yêu cầu tính năng mới từ PRD
- Cần clarify requirements trước khi implement
- Cập nhật spec sau khi có feedback

## Bước thực hiện

### 1. Đọc PRD và Feature List
```
- docs/prd.md → Section 6 (Yêu cầu chức năng)
- docs/features.md → Module liên quan
```

### 2. Kiểm tra spec đã tồn tại chưa
```
ls docs/specs/
```

### 3. Tạo/cập nhật spec file
Tên file: `docs/specs/{module-name}.md`

### 4. Cấu trúc bắt buộc của spec
```markdown
# Spec: {Tên Module}

## Goal
{Mục tiêu ngắn gọn — 1–2 câu}

## User Stories
- Là {vai trò}, tôi muốn {hành động} để {lợi ích}
...

## Acceptance Criteria
- [ ] {Tiêu chí có thể test được}
...

## Edge Cases
- {Trường hợp biên cần xử lý}
...

## API Contract
### Endpoint
**Method**: POST/GET/PUT/DELETE
**Path**: /api/...
**Request**: { field: type }
**Response**: { field: type }
**Errors**: { code: message }

## Data Model Changes
{Thay đổi schema Prisma nếu có}

## UI Notes
{Mô tả UI/UX nếu liên quan}
```

### 5. Validate spec
- [ ] Mọi Acceptance Criteria đều có thể viết test
- [ ] API contract đầy đủ (request + response + errors)
- [ ] Edge cases được liệt kê
- [ ] KHÔNG chứa implementation detail

## Quy tắc
- KHÔNG viết code trong spec
- KHÔNG thay đổi file ngoài `docs/`
- Một spec = một module từ PRD
