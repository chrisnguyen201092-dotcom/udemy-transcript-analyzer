# Spec: Quản lý Bài học

## Goal
Cho phép người dùng thêm, xem, chọn, đổi tên, xóa và sắp xếp lại bài học trong khóa học. Người dùng có toàn quyền kiểm soát danh sách bài học mà không cần vào Udemy hay tải lại trang.

## User Stories
- Là học viên, tôi muốn thêm bài học thủ công vào khóa học để nhập transcript tùy ý
- Là học viên, tôi muốn xem danh sách bài học theo thứ tự để dễ theo dõi tiến độ
- Là học viên, tôi muốn click vào bài học để xem transcript và dùng AI
- Là học viên, tôi muốn xóa bài học không cần thiết để giữ danh sách gọn gàng
- Là học viên, tôi muốn đổi tên bài học cho rõ ràng hơn khi tên gốc không mô tả đúng nội dung
- Là học viên, tôi muốn kéo thả hoặc di chuyển bài học để sắp xếp lại thứ tự học theo ý mình

## Acceptance Criteria

### Thêm bài học
- [ ] Người dùng chọn khóa học → danh sách bài học hiển thị trong sidebar, sắp xếp theo `order` tăng dần
- [ ] Người dùng nhập tên bài học và nhấn "Thêm" → bài học mới được tạo với `transcript: null`, `order` = max + 1
- [ ] Mỗi bài học trong danh sách hiển thị: số thứ tự và tiêu đề

### Chọn bài học
- [ ] Click vào bài học → `TranscriptPanel` và `AIAssistantPanel` load nội dung bài học đó
- [ ] Bài học đang chọn được highlight trong sidebar

### Xóa bài học
- [ ] Hover vào bài học → hiển thị context menu (kebab icon hoặc chuột phải) với các tùy chọn: "Đổi tên", "Xóa"
- [ ] Chọn "Xóa" → hiển thị dialog xác nhận trước khi thực hiện
- [ ] Xác nhận xóa → gửi `DELETE /api/lessons/[id]`, xóa cascade toàn bộ dữ liệu liên quan (AI results, chat messages, flashcard reviews)
- [ ] Nếu bài học bị xóa đang được chọn → bỏ chọn, xóa nội dung trong `TranscriptPanel` và `AIAssistantPanel`
- [ ] Nếu đây là bài học cuối cùng → sidebar hiển thị trạng thái trống với prompt "Thêm bài học đầu tiên"

### Đổi tên bài học
- [ ] Double-click vào tiêu đề bài học → tiêu đề chuyển thành input có thể chỉnh sửa
- [ ] Nhấn Enter → gửi `PATCH /api/lessons/[id]` với title mới, cập nhật danh sách
- [ ] Nhấn Escape → hủy, khôi phục tên cũ
- [ ] Title rỗng → không gửi request, hiển thị lỗi inline
- [ ] Title vượt 200 ký tự → validate client-side, không gửi request
- [ ] Đổi tên thành công → cập nhật tên ngay lập tức trong danh sách (không cần reload)

### Sắp xếp lại bài học
- [ ] UI hỗ trợ kéo thả để thay đổi thứ tự bài học (hoặc nút lên/xuống làm phương án đơn giản hơn)
- [ ] Sau khi thả → gửi `PUT /api/courses/[id]/lessons/reorder` với mảng `lessonIds` theo thứ tự mới
- [ ] Optimistic UI: danh sách cập nhật ngay lập tức trước khi server phản hồi
- [ ] Server lỗi → rollback về thứ tự cũ, hiển thị toast lỗi

## Edge Cases
- Khóa học không có bài học nào → sidebar hiển thị trạng thái trống, có prompt "Thêm bài học đầu tiên"
- Tên bài học bị bỏ trống khi thêm mới → validate client-side, không gửi request
- Import khóa học từ Udemy → bài học được tạo tự động với `order` từ curriculum Udemy; flow này xử lý bởi module course-management
- Concurrent requests thêm bài học cùng lúc → có thể tạo 2 bài với cùng `order` nếu cả 2 request đều query `MAX(order)` trước khi insert. **Acceptable** (single-user app). Server phải query `MAX(order) + 1` trong một transaction để giảm thiểu risk. Nếu xảy ra trùng `order`: hiển thị theo `createdAt` làm tie-breaker.
- Xóa bài học có dữ liệu AI (summary, quiz, chat history) → cascade delete toàn bộ. Dialog xác nhận phải cảnh báo rõ: "Toàn bộ dữ liệu AI và tiến độ của bài học này sẽ bị xóa vĩnh viễn."
- Sắp xếp lại khi đang thêm bài học đồng thời → reorder chạy trên snapshot hiện tại; bài học mới thêm vào có thể không nằm trong mảng `lessonIds` gửi lên → server giữ nguyên `order` của các bài không có trong mảng
- Sắp xếp lại khi chỉ có 1 bài học → không hiển thị nút/drag handle vì không có ý nghĩa
- Đổi tên thành tên trùng với bài học khác trong cùng khóa học → **cho phép** (các bài học phân biệt bằng `id`), nhưng hiển thị cảnh báo nhẹ: "Đã có bài học trùng tên trong khóa học này."

## API Contract

### POST /api/courses/[id]/lessons
Thêm bài học mới vào khóa học.

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

---

### DELETE /api/lessons/[id]
Xóa bài học và toàn bộ dữ liệu liên quan (cascade).

**Response 200:**
```json
{ "success": true, "deletedId": "string" }
```
**Errors:**
- `404` — lesson not found

**Ghi chú:** Nếu database đã cấu hình `onDelete: Cascade` trên các relation liên quan thì Prisma tự xử lý cascade. Nếu chưa, server phải xóa thủ công theo thứ tự: chat messages → AI results → flashcard reviews → lesson.

---

### PATCH /api/lessons/[id]
Đổi tên bài học.

**Request:**
```json
{ "title": "new title" }
```
**Response 200:**
```json
{
  "id": "string",
  "title": "string",
  "updatedAt": "string"
}
```
**Errors:**
- `400` — `title` rỗng hoặc vượt 200 ký tự
- `404` — lesson not found

---

### PUT /api/courses/[id]/lessons/reorder
Cập nhật thứ tự toàn bộ bài học trong khóa học.

**Request:**
```json
{ "lessonIds": ["id1", "id2", "id3"] }
```
Server cập nhật `order` của mỗi lesson theo vị trí trong mảng (index 0 → order 0, index 1 → order 1, ...).

**Response 200:**
```json
{ "success": true }
```
**Errors:**
- `400` — `lessonIds` không phải mảng, hoặc chứa id không thuộc khóa học này
- `404` — course not found

---

### GET /api/courses (có include lessons)
Response trả về mảng `lessons` lồng trong mỗi course (xem spec course-management).

## Data Model Changes
Không cần thay đổi schema. Sử dụng model `Lesson` hiện tại:

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

Lưu ý: Nếu có các model liên quan (ChatMessage, FlashcardReview...) chưa có `onDelete: Cascade` trỏ về `Lesson`, cần thêm vào khi implement DELETE endpoint để đảm bảo cascade hoạt động đúng.

## UI Notes
- `LessonList`: danh sách dạng vertical scroll, mỗi item = số thứ tự + tên bài
- Form thêm bài học: input text + nút "Thêm" nằm trên danh sách hoặc cuối danh sách
- Active lesson được highlight bằng background color khác
- Hover vào lesson item → hiển thị kebab menu (ba chấm) ở góc phải, hoặc hỗ trợ right-click context menu
- Context menu gồm: "Đổi tên", "Xóa"
- Drag handle (khi hover) hiển thị ở góc trái lesson item để kéo thả sắp xếp; ẩn khi chỉ có 1 bài học
- Double-click tiêu đề → inline edit mode: input replace text, focus ngay, border highlight
- Dialog xóa: tiêu đề "Xóa bài học?", nội dung cảnh báo cascade, nút "Hủy" và "Xóa" (destructive style)
