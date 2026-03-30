# Spec: Import & Quản lý Khóa học

## Goal
Cho phép người dùng import khóa học từ Udemy qua access token hoặc tạo thủ công, và quản lý danh sách khóa học trong hệ thống.

## User Stories
- Là học viên, tôi muốn import khóa học Udemy bằng cookie để không phải nhập thủ công từng bài
- Là học viên, tôi muốn tạo khóa học thủ công để tổ chức tài liệu không từ Udemy
- Là học viên, tôi muốn xóa khóa học không cần nữa để giữ danh sách gọn gàng

## Acceptance Criteria
- [ ] Người dùng nhập `access_token` cookie → hệ thống gọi Udemy API trả về danh sách khóa học đã enroll
- [ ] Người dùng chọn khóa học → hệ thống import curriculum + transcripts và lưu vào SQLite
- [ ] Người dùng tạo khóa học thủ công chỉ cần nhập tên (`title`); `url` được lưu là `""`
- [ ] Xóa khóa học → cascade xóa tất cả lessons, transcripts, và AI results liên quan
- [ ] Danh sách khóa học hiển thị trong sidebar, sắp xếp theo `createdAt` giảm dần
- [ ] Mỗi khóa học hiển thị tên và số bài học

## Edge Cases
- Access token hết hạn → trả về lỗi rõ ràng, không crash
- Udemy API không trả về transcript cho bài nào đó → lesson được tạo với `transcript: null`
- Import khóa học đã tồn tại (trùng URL) → upsert hoặc báo lỗi trùng
- Xóa khóa học khi đang xem bài học của nó → UI reset về trạng thái trống

## API Contract

### POST /api/udemy/courses
**Request:**
```json
{ "access_token": "string" }
```
**Response 200:**
```json
{
  "courses": [
    { "id": "number", "title": "string", "url": "string", "num_lectures": "number" }
  ]
}
```
**Errors:**
- `400` — access_token bị thiếu
- `401` — token không hợp lệ hoặc hết hạn
- `500` — Udemy API không phản hồi

### POST /api/udemy/import
**Request:**
```json
{ "access_token": "string", "courseId": "number", "courseTitle": "string", "courseUrl": "string" }
```
**Response 200:**
```json
{ "courseId": "string", "lessonsImported": "number" }
```
**Errors:**
- `400` — thiếu fields
- `401` — token không hợp lệ
- `500` — lỗi import

### GET /api/courses
**Response 200:**
```json
{
  "courses": [{ "id": "string", "title": "string", "url": "string", "createdAt": "string", "lessons": [] }]
}
```

### POST /api/courses
**Request:**
```json
{ "title": "string" }
```
**Response 201:**
```json
{ "id": "string", "title": "string", "url": "", "createdAt": "string" }
```

### DELETE /api/courses/[id]
**Response 200:**
```json
{ "success": true }
```
**Errors:**
- `404` — course not found

## Data Model Changes
```prisma
model Course {
  id        String   @id @default(cuid())
  url       String   @unique   // "" khi tạo thủ công
  title     String
  roadmap   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lessons   Lesson[]
}
```

## UI Notes
- Sidebar CourseList: hiển thị tên khóa học, click để select
- AddCoursePanel: form nhập tên + nút "Thêm" + nút "Import từ Udemy"
- ImportModal: form nhập access_token + danh sách checkbox khóa học
- Xác nhận trước khi xóa (alert dialog)
