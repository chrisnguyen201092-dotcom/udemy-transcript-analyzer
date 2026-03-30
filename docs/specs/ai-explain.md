# Spec: AI Explain

## Goal
Tạo giải thích sâu bài học theo Feynman Technique, tự động phân loại format output dựa trên tỷ lệ code trong transcript, persist kết quả vào DB.

## User Stories
- Là học viên, tôi muốn nhận giải thích chi tiết hơn summary để thực sự hiểu bài
- Là học viên, tôi muốn giải thích được điều chỉnh tự động: nhiều code example nếu bài lập trình, nhiều lý thuyết nếu bài conceptual
- Là học viên, tôi muốn giải thích được lưu lại để xem lại không cần generate

## Acceptance Criteria
- [ ] Khi chọn bài học → nếu `explanation != null` → hiển thị ngay trong tab Explain
- [ ] Nếu `explanation == null` → tab Explain hiển thị nút "Giải thích sâu"
- [ ] Người dùng click → hệ thống gọi `POST /api/ai/explain` với `lessonId` và `transcript`
- [ ] Server phân loại transcript: tính % dòng có chứa code block/backtick/indent patterns
  - ≥ 40% code → Format A (code-heavy)
  - ≤ 20% code → Format B (theory-heavy)
  - Còn lại → Hybrid
- [ ] Response tối thiểu 800 từ; persist vào `Lesson.explanation`
- [ ] Nút "Giải thích lại" luôn khả dụng; kết quả mới ghi đè cũ
- [ ] Loading state hiển thị trong khi generate

## Edge Cases
- Bài học không có transcript → nút bị disable
- AI trả lỗi → hiển thị lỗi, không xóa explanation cũ
- Transcript thuần lý thuyết (0% code) → Format B, không crash classification
- Model reasoning trả về `<think>` → server strip tag
- Transcript quá dài → truncate ở 8000 tokens trước khi gửi (estimate: 1 token ≈ 4 chars)

## API Contract

### POST /api/ai/explain
**Request:**
```json
{
  "lessonId": "string",
  "transcript": "string",
  "settings": {
    "baseUrl": "string",
    "apiKey": "string",
    "model": "string"
  }
}
```
**Response 200:**
```json
{ "explanation": "string" }
```
**Errors:**
- `400` — thiếu `lessonId` hoặc `transcript`
- `500` — AI provider error hoặc DB error

## Data Model Changes
Không có thay đổi schema. Persist vào field `explanation` (String?) trong bảng `Lesson`.

## Prompt Architecture
- AI đóng vai **Subject Matter Expert** dùng **Feynman Technique**
- Format A (code-heavy): tập trung walkthrough code step-by-step, nhiều code example
- Format B (theory-heavy): analogy, mental model, real-world example
- Hybrid: kết hợp cả hai
- Shared rule builders: `buildAsrRules()`, `buildLanguageRules()`
- Think-tag suppression như AI Summary
- Output tối thiểu 800 từ, tối đa ~3500 từ

## UI Notes
- Tab "Explain" trong `AIAssistantPanel`
- Kết quả hiển thị dưới dạng markdown rendered
- Nút "Giải thích sâu" / "Giải thích lại" + loading spinner
- Scroll độc lập
