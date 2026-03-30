# Spec: Quản lý Bài học

## Goal
Cho phép người dùng thêm bài học thủ công vào khóa học, xem danh sách bài học, và chọn bài học để xem transcript và dùng các tính năng AI.

## User Stories
- Là học viên, tôi muốn thêm bài học thủ công vào khóa học để nhập transcript tùy ý
- Là học viên, tôi muốn xem danh sách bài học theo thứ tự để dễ theo dõi tiến độ
- Là học viên, tôi muốn click vào bài học để xem transcript và dùng AI

## Acceptance Criteria
- [ ] Người dùng chọn khóa học → danh sách bài học hiển thị trong sidebar, sắp xếp theo `order` tăng dần
- [ ] Người dùng nhập tên bài học và nhấn "Thêm" → bài học mới được tạo với `transcript: null`, `order` = max + 1
- [ ] Mỗi bài học trong danh sách hiển thị: số thứ tự và tiêu đề
- [ ] Click vào bài học → `TranscriptPanel` và `AIAssistantPanel` load nội dung bài học đó
- [ ] Bài học đang chọn được highlight trong sidebar

## Edge Cases
- Khóa học không có bài học nào → sidebar hiển thị trạng thái trống, có prompt "Thêm bài học đầu tiên"
- Tên bài học bị bỏ trống → validate client-side, không gửi request
- Import khóa học từ Udemy → bài học được tạo tự động với `order` từ curriculum Udemy; flow này xử lý bởi module course-management
- Concurrent requests thêm bài học cùng lúc → có thể tạo 2 bài với cùng `order` nếu cả 2 request đều query `MAX(order)` trước khi insert. **Acceptable trong v1** (single-user app). Server phải query `MAX(order) + 1` trong một transaction để giảm thiểu risk. Nếu xảy ra trùng `order`: hiển thị theo `createdAt` làm tie-breaker.

## API Contract

### POST /api/courses/[id]/lessons
**Request:**
```json
{ "title": "string" }
```
**Response 201:**
```json
{
  "id": "string",
  "courseId": "string",
  "title": "string",
  "order": "number",
  "transcript": null,
  "createdAt": "string"
}
```
**Errors:**
- `400` — `title` bị thiếu hoặc rỗng
- `404` — course not found

### GET /api/courses (có include lessons)
Response trả về mảng `lessons` lồng trong mỗi course (xem spec course-management).

## Data Model Changes
Không có thay đổi schema. Sử dụng model `Lesson` hiện tại:
```prisma
model Lesson {
  id          String   @id @default(cuid())
  courseId    String
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title       String
  order       Int
  transcript  String?
  summary     String?
  explanation String?
  quiz        String?
  flashcards  String?
  exercises   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## UI Notes
- `LessonList`: danh sách dạng vertical scroll, mỗi item = số thứ tự + tên bài
- Form thêm bài học: input text + nút "Thêm" nằm trên danh sách hoặc cuối danh sách
- Active lesson được highlight bằng background color khác
- Không có nút xóa bài học trong v1 (xóa khóa học xóa cascade tất cả)
