# Spec: AI Roadmap (Lộ trình học tập)

## Goal
Tạo lộ trình học tập cá nhân hóa cho toàn bộ khóa học dựa trên phân tích tất cả transcripts, persist kết quả vào `Course.roadmap`. Khi có `LearnerProfile`, lộ trình được điều chỉnh theo mức độ, mục tiêu, thời gian và phong cách học của từng người. Khi có dữ liệu tiến độ, lộ trình phản ánh phần đã học và gợi ý bước tiếp theo.

## User Stories
- Là học viên, tôi muốn nhận lộ trình học tập tổng thể cho toàn khóa để biết nên học theo thứ tự nào
- Là học viên, tôi muốn AI phân tích toàn bộ nội dung khóa học thay vì chỉ một bài
- Là học viên, tôi muốn lộ trình được lưu lại để xem lại mà không cần generate lại
- Là học viên có hồ sơ học tập, tôi muốn lộ trình phản ánh trình độ, mục tiêu và thời gian rảnh của mình
- Là học viên đang học dở, tôi muốn lộ trình cho thấy mình đã đến đâu và nên học gì tiếp theo
- Là học viên vừa cập nhật hồ sơ, tôi muốn được nhắc tạo lại lộ trình để hưởng thay đổi mới

## Acceptance Criteria
- [ ] Khi chọn khóa học → hệ thống gọi `GET /api/courses/[id]/ai`; nếu `roadmap != null` → hiển thị ngay trong tab Roadmap
- [ ] Nếu `roadmap == null` → tab Roadmap hiển thị nút "Tạo lộ trình"
- [ ] Người dùng click → hệ thống gọi `POST /api/ai/roadmap` với `courseId` và tất cả transcripts của khóa học
- [ ] Server aggregate transcripts: mỗi bài truncate tối đa 4000 ký tự, kèm tên bài học
- [ ] Response là plain text/markdown; persist vào `Course.roadmap`
- [ ] Roadmap là **course-level**, không phụ thuộc bài học đang chọn
- [ ] Tab Roadmap visible kể cả khi không có bài học nào được chọn
- [ ] Nút "Tạo lại" luôn khả dụng; kết quả mới ghi đè cũ

**LearnerProfile Integration:**
- [ ] Khi `LearnerProfile` tồn tại cho khóa học → server inject dữ liệu profile vào roadmap prompt trước khi gọi AI
- [ ] Khi không có `LearnerProfile` → roadmap hoạt động như cũ (generic), nhưng UI hiển thị gợi ý: "Tạo hồ sơ học tập để nhận lộ trình cá nhân hóa hơn"
- [ ] `profile.level` ảnh hưởng đến phân bổ thời gian: beginner → dành nhiều thời gian cho phần nền tảng; advanced → rút ngắn hoặc bỏ qua phần cơ bản
- [ ] `profile.goal` ảnh hưởng đến trọng tâm: `career_change` → nhấn mạnh kỹ năng thực tế, dự án portfolio; `hobby` → khuyến khích khám phá tự do, không áp lực; `exam_prep` → cấu trúc ôn tập có hệ thống theo chủ đề thi
- [ ] `profile.dailyTimeMin` ảnh hưởng đến timeline: 30 phút/ngày → kế hoạch dãn ra nhiều tuần hơn; 120 phút/ngày → kế hoạch nén lại
- [ ] `profile.knownTopics` → các chủ đề đã biết được đánh dấu "có thể bỏ qua" hoặc "ôn nhanh" trong lộ trình
- [ ] `profile.learningStyle` ảnh hưởng tỉ lệ lý thuyết/thực hành: `theory_first` → khái niệm được giải thích trước, bài tập sau; `hands_on` → đưa dự án thực tế vào sớm, học concept qua làm

**Progress-Aware Roadmap:**
- [ ] Khi `LessonProgress` tồn tại cho khóa học → server tự động fetch và inject dữ liệu tiến độ vào prompt
- [ ] Lộ trình output đánh dấu rõ bài học đã hoàn thành (ví dụ: ✅) và bài chưa học
- [ ] Lộ trình gợi ý bài học/chủ đề tiếp theo dựa trên bài cuối đã hoàn thành
- [ ] Tiến độ được fetch phía server, client không cần gửi lên

**Re-generate Triggers:**
- [ ] Khi `LearnerProfile` được tạo mới hoặc cập nhật → UI hiển thị notification: "Hồ sơ đã thay đổi. Tạo lại lộ trình?"
- [ ] Khi học viên đạt mốc tiến độ 25%, 50%, 75% → UI gợi ý: "Bạn đã học được X%. Tạo lại lộ trình để cập nhật tiến độ?"
- [ ] Nút "Tạo lại" luôn hiển thị (giữ nguyên hành vi hiện tại), với tooltip ngữ cảnh giải thích lý do nên tạo lại khi có trigger

## Edge Cases
- Khóa học không có bài học nào → nút bị disable, thông báo "Cần có ít nhất 1 bài học"
- Tất cả bài học đều không có transcript → AI vẫn được gọi với danh sách tên bài học, không crash
- Transcripts tổng hợp vượt context window → truncate per-lesson (4000 chars) đã đảm bảo giới hạn
- AI provider trả lỗi → hiển thị lỗi, không xóa roadmap cũ
- Model reasoning output `<think>` → server strip tag
- Có `LearnerProfile` nhưng không có transcript nào → profile vẫn được inject, AI dựa vào tên bài học và thông tin profile để tạo lộ trình
- Có dữ liệu tiến độ (`LessonProgress`) nhưng không có `LearnerProfile` → progress được inject, lộ trình phản ánh tiến độ nhưng không cá nhân hóa theo mục tiêu/trình độ
- `LearnerProfile` tồn tại nhưng `knownTopics` rỗng → bỏ qua trường này, không ảnh hưởng prompt
- Roadmap cũ được tạo trước khi có `LearnerProfile` → lộ trình cũ vẫn hiển thị, UI nhắc tạo lại để áp dụng profile
- Roadmap cũ được tạo trước khi có tiến độ đáng kể → notification gợi ý tạo lại khi đạt mốc 25%/50%/75%

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
  },
  "profile": {
    "level": "beginner | intermediate | advanced (optional)",
    "goal": "career_change | hobby | exam_prep (optional)",
    "dailyTimeMin": "number (optional)",
    "knownTopics": "string[] (optional)",
    "learningStyle": "theory_first | hands_on | balanced (optional)"
  }
}
```
_Trường `profile` là optional. Server cũng tự fetch `LessonProgress` theo `courseId` từ DB — client không cần gửi tiến độ._

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
{
  "roadmap": "string | null",
  "hasProfile": "boolean",
  "progressPercent": "number (0-100)"
}
```
_`hasProfile` và `progressPercent` giúp client quyết định hiển thị gợi ý tạo lại hay không._

## Data Model Changes
Không có thay đổi schema cho tính năng này. Persist vào field `roadmap` (String?) trong bảng `Course`.

Roadmap versioning (lưu lịch sử) không áp dụng trong v1. Khi "Tạo lại" được gọi, roadmap cũ bị ghi đè. Versioning là cải tiến tương lai (có thể thêm field `previousRoadmap` hoặc bảng `RoadmapHistory`).

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
- Khi có `LearnerProfile`: thêm section System Instruction vào prompt với các điều chỉnh cụ thể theo từng trường profile (level, goal, dailyTimeMin, knownTopics, learningStyle)
- Khi có `LessonProgress`: thêm danh sách bài đã hoàn thành vào context, yêu cầu AI đánh dấu và gợi ý next step

## UI Notes
- Tab "Roadmap" trong `AIAssistantPanel` — luôn visible, không cần select bài học
- Kết quả hiển thị dưới dạng markdown rendered
- Nút "Tạo lộ trình" / "Tạo lại" + loading state
- Layout đủ rộng để đọc thoải mái (không bị cắt bởi panel width)
- Khi không có `LearnerProfile`: hiển thị banner nhỏ bên dưới roadmap hoặc trước nút "Tạo lộ trình": _"Tạo hồ sơ học tập để nhận lộ trình cá nhân hóa hơn"_ — link đến tab hồ sơ
- Notification "Hồ sơ đã thay đổi. Tạo lại lộ trình?" hiển thị dưới dạng toast hoặc inline banner khi profile thay đổi và đã có roadmap
- Notification gợi ý tạo lại khi đạt mốc tiến độ 25%/50%/75% — chỉ hiển thị một lần mỗi mốc
- Tooltip trên nút "Tạo lại" mô tả lý do nên regenerate (profile mới, tiến độ mới, hoặc muốn làm mới)
