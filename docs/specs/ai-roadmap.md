# Spec: AI Roadmap (Lộ trình học tập)

## Goal
Tạo lộ trình học tập cá nhân hóa cho toàn bộ khóa học dựa trên phân tích tất cả transcripts, persist kết quả vào `Course.roadmap`.

## User Stories
- Là học viên, tôi muốn nhận lộ trình học tập tổng thể cho toàn khóa để biết nên học theo thứ tự nào
- Là học viên, tôi muốn AI phân tích toàn bộ nội dung khóa học thay vì chỉ một bài
- Là học viên, tôi muốn lộ trình được lưu lại để xem lại mà không cần generate lại

## Acceptance Criteria
- [ ] Khi chọn khóa học → hệ thống gọi `GET /api/courses/[id]/ai`; nếu `roadmap != null` → hiển thị ngay trong tab Roadmap
- [ ] Nếu `roadmap == null` → tab Roadmap hiển thị nút "Tạo lộ trình"
- [ ] Người dùng click → hệ thống gọi `POST /api/ai/roadmap` với `courseId` và tất cả transcripts của khóa học
- [ ] Server aggregate transcripts: mỗi bài truncate tối đa 4000 ký tự, kèm tên bài học
- [ ] Response là plain text/markdown; persist vào `Course.roadmap`
- [ ] Roadmap là **course-level**, không phụ thuộc bài học đang chọn
- [ ] Tab Roadmap visible kể cả khi không có bài học nào được chọn
- [ ] Nút "Tạo lại" luôn khả dụng; kết quả mới ghi đè cũ

## Edge Cases
- Khóa học không có bài học nào → nút bị disable, thông báo "Cần có ít nhất 1 bài học"
- Tất cả bài học đều không có transcript → AI vẫn được gọi với danh sách tên bài học, không crash
- Transcripts tổng hợp vượt context window → truncate per-lesson (4000 chars) đã đảm bảo giới hạn
- AI provider trả lỗi → hiển thị lỗi, không xóa roadmap cũ
- Model reasoning output `<think>` → server strip tag

## API Contract

### POST /api/ai/roadmap
**Request:**
```json
{
  "courseId": "string",
  "lessons": [
    {
      "title": "string",
      "transcript": "string (truncated to 4000 chars, or empty string if null)"
    }
  ],
  "settings": {
    "baseUrl": "string",
    "apiKey": "string",
    "model": "string"
  }
}
```
**Response 200:**
```json
{ "roadmap": "string" }
```
**Errors:**
- `400` — thiếu `courseId` hoặc `lessons`
- `500` — AI provider error hoặc DB error

### GET /api/courses/[id]/ai
**Response 200:**
```json
{ "roadmap": "string | null" }
```

## Data Model Changes
Không có thay đổi schema. Persist vào field `roadmap` (String?) trong bảng `Course`.

## Prompt Architecture
- Phương pháp: **Andragogy** (học người lớn) + **Deliberate Practice**
- Output bao gồm 6 phần bắt buộc:
  1. Tổng quan khóa học (mục tiêu, prerequisite, thời gian ước tính)
  2. Phân giai đoạn học (Foundation → Intermediate → Advanced)
  3. Bản đồ kiến thức (dependency giữa các bài)
  4. Phương pháp học tối ưu (spaced repetition schedule)
  5. Dự án tổng hợp (capstone project gợi ý)
  6. Kế hoạch theo tuần
- Think-tag suppression ở prompt-level và server-side

## UI Notes
- Tab "Roadmap" trong `AIAssistantPanel` — luôn visible, không cần select bài học
- Kết quả hiển thị dưới dạng markdown rendered
- Nút "Tạo lộ trình" / "Tạo lại" + loading state
- Layout đủ rộng để đọc thoải mái (không bị cắt bởi panel width)
