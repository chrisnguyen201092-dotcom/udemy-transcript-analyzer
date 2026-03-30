# Spec: AI Persistence

## Goal
Tự động load kết quả AI đã lưu khi người dùng chọn bài học hoặc khóa học, giúp tránh generate lại không cần thiết và tiết kiệm token.

## User Stories
- Là học viên, tôi muốn kết quả AI được hiển thị ngay khi chọn bài học, không phải chờ generate lại
- Là học viên, tôi muốn lộ trình khóa học được load tự động khi chọn khóa học
- Là học viên, tôi muốn có thể generate lại bất cứ lúc nào nếu muốn nội dung mới

## Acceptance Criteria
- [ ] Khi chọn bài học → hệ thống gọi `GET /api/lessons/[id]/ai` và populate tất cả tabs AI với dữ liệu đã lưu
- [ ] Khi chọn khóa học → hệ thống gọi `GET /api/courses/[id]/ai` và populate tab Roadmap
- [ ] Nếu field là `null` → tab hiển thị trạng thái "chưa có", show nút generate
- [ ] Nếu field có giá trị → hiển thị ngay, không gọi AI
- [ ] Người dùng có thể click "Tạo lại" bất kỳ lúc nào để generate mới; kết quả mới ghi đè cũ trong DB và UI
- [ ] Khi đang load AI data → hiển thị skeleton/loading state ngắn (< 200ms với DB local)

## Edge Cases
- Bài học bị xóa trong khi đang xem → API trả 404, UI reset về trạng thái trống
- DB data bị corrupt (JSON không parse được) → hiển thị raw text, không crash. **Test case cụ thể:** nếu `quiz` field chứa chuỗi không phải valid JSON (ví dụ `"truncated { \"q\""`) → tab Practice hiển thị nội dung raw thay vì parse thành component UI; không throw unhandled exception; console.error để debug
- DB data schema thay đổi (stale data) → các fields AI là `String?` (không structured schema trong DB), nên backward-compatible tự nhiên. Risk duy nhất: client code mong đợi JSON structure cụ thể (ví dụ `quiz` format). **Mitigation:** parse trong try/catch, fallback về raw text display
- Network error khi fetch `/api/lessons/[id]/ai` → hiển thị error state, retry button
- Generate lại trong khi tab khác đang hiển thị → chỉ ghi đè field tương ứng, không reset tab khác
- User chuyển bài liên tục nhanh → abort request trước nếu chưa xong (cancel fetch), không race condition

## API Contract

### GET /api/lessons/[id]/ai
**Response 200:**
```json
{
  "summary": "string | null",
  "explanation": "string | null",
  "quiz": "string | null",
  "flashcards": "string | null",
  "exercises": "string | null"
}
```
**Errors:**
- `404` — lesson not found

### GET /api/courses/[id]/ai
**Response 200:**
```json
{ "roadmap": "string | null" }
```
**Errors:**
- `404` — course not found

## Data Model Changes
Không có thay đổi schema. Đây là spec về behavior của read layer — sử dụng các fields đã có trong `Lesson` và `Course`.

## UI Notes
- Load trigger: khi `selectedLessonId` thay đổi → gọi `GET /api/lessons/[id]/ai`
- Load trigger: khi `selectedCourseId` thay đổi → gọi `GET /api/courses/[id]/ai`
- Skeleton placeholder cho mỗi tab trong khi loading
- State management: lưu trong React state của component cha (`AIAssistantPanel` hoặc page-level state)
- Abort controller: mỗi lần load mới cancel request load trước nếu còn pending
