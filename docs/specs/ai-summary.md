# Spec: AI Summary

## Goal
Tạo tóm tắt bài học theo chuẩn giáo học pháp (Bloom's Taxonomy) từ transcript, persist kết quả vào DB để tải lại tự động lần sau.

## User Stories
- Là học viên, tôi muốn nhấn một nút để tóm tắt toàn bộ bài học thay vì đọc transcript thô
- Là học viên, tôi muốn tóm tắt được cấu trúc rõ ràng theo mục tiêu học tập
- Là học viên, tôi muốn tóm tắt được lưu lại để không cần generate lại mỗi lần vào bài

## Acceptance Criteria
- [ ] Khi chọn bài học → hệ thống gọi `GET /api/lessons/[id]/ai`; nếu `summary != null` → hiển thị ngay trong tab Summary
- [ ] Nếu `summary == null` → tab Summary hiển thị nút "Tạo tóm tắt"
- [ ] Người dùng click "Tạo tóm tắt" → hệ thống gọi `POST /api/ai/summary` với `lessonId` và `transcript`
- [ ] Response là plain text (không stream); tối thiểu 600 từ
- [ ] Sau khi nhận response → hệ thống persist vào `Lesson.summary`, UI hiển thị kết quả
- [ ] Nút "Tạo lại" luôn khả dụng để generate lại; kết quả mới ghi đè kết quả cũ
- [ ] Loading state rõ ràng trong khi đang generate

## Edge Cases
- Bài học không có transcript → nút "Tạo tóm tắt" bị disable, hiển thị tooltip "Cần có transcript"
- Transcript quá ngắn (< 100 ký tự) → AI vẫn xử lý, không chặn
- AI provider trả lỗi (rate limit, timeout) → hiển thị lỗi rõ ràng, không xóa summary cũ
- Transcript có ASR noise (nhận dạng sai) → prompt có ASR degradation handling, AI tự suy ra nội dung
- Transcript trộn tiếng Anh/Việt (code-switching) → prompt hỗ trợ, output bằng tiếng Việt
- Model reasoning trả về tag `<think>` → server strip tag trước khi trả về và lưu

## API Contract

### POST /api/ai/summary
**Request:**
```json
{
  "lessonId": "string",
  "apiKey": "string",
  "baseUrl": "string",
  "model": "string"
}
```
> **Note:** Transcript is **not sent by the client** — the server fetches it from the DB using `lessonId`.
**Response 200:**
```json
{ "summary": "string" }
```
**Errors:**
- `400` — thiếu `lessonId` hoặc `transcript`
- `500` — AI provider error hoặc DB error

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

## Data Model Changes
Không có thay đổi schema. Persist vào field `summary` (String?) trong bảng `Lesson`.

## Clarification: Streaming vs Non-Streaming

> **⚠️ PRD Inconsistency (flagged):** PRD Flow 3 (section 9) dùng từ "Kết quả stream" khi mô tả Summary. Tuy nhiên spec này và API contract định nghĩa response là **plain text không stream** (response 200 trả `{ "summary": "string" }` một lần duy nhất).
>
> **Quyết định:** Giữ **non-streaming** cho Summary. Lý do:
> - PRD dùng từ "stream" theo nghĩa thông thường ("kết quả chảy ra"), không phải SSE protocol
> - Chỉ AI Chat (F-31..F-35) mới dùng Server-Sent Events thật sự
> - Non-streaming đơn giản hơn và đủ cho use case Summary (tối đa ~2500 từ, < 10 giây)
>
> Nếu muốn đổi sang streaming: cần thay `Response 200` bằng `text/event-stream`, cập nhật client-side fetch, và cập nhật spec ai-chat.md để phân biệt rõ.

## Prompt Architecture
- AI đóng vai **Instructional Designer**
- Cấu trúc output theo **Bloom's Taxonomy** 6 mức (Remember → Create)
- Shared rule builders: `buildAsrRules()`, `buildLanguageRules()` (DRY pattern)
- Think-tag suppression ở cả prompt-level (`"Do not output <think>"`) và server-side (`/<think>[\s\S]*?<\/think>/g`)
- Output tối thiểu 600 từ, tối đa ~2500 từ

## UI Notes
- Tab "Summary" trong `AIAssistantPanel`
- Kết quả hiển thị dưới dạng markdown rendered (hoặc plain text với whitespace preserved)
- Nút "Tạo tóm tắt" / "Tạo lại" + loading spinner trong khi chờ
- Scroll độc lập với transcript panel
