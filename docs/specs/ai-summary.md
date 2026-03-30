# Spec: AI Summary

## Goal
Tạo tóm tắt bài học từ transcript, cho phép học viên chọn giữa **chế độ nhanh** (bullet points ngắn gọn) và **chế độ chi tiết** (cấu trúc đầy đủ theo Bloom's Taxonomy). Mọi tóm tắt đều bắt đầu bằng phần **Key Takeaways** gồm 3 điểm quan trọng nhất. Kết quả được persist vào DB để tải lại tự động lần sau.

---

## User Stories
- Là học viên, tôi muốn nhấn một nút để tóm tắt toàn bộ bài học thay vì đọc transcript thô
- Là học viên, tôi muốn xem ngay 3 điểm quan trọng nhất ở đầu tóm tắt, trước khi đọc chi tiết
- Là học viên, tôi muốn chọn tóm tắt nhanh (300-500 từ) khi không có nhiều thời gian
- Là học viên, tôi muốn chọn tóm tắt chi tiết (600-2500 từ) khi muốn nắm sâu nội dung
- Là học viên, tôi muốn tóm tắt được lưu lại để không cần generate lại mỗi lần vào bài

---

## Acceptance Criteria

### Chung (áp dụng cả hai chế độ)
- [ ] Khi chọn bài học, hệ thống gọi `GET /api/lessons/[id]/ai`; nếu `summary != null` thì hiển thị ngay trong tab Summary
- [ ] Nếu `summary == null`, tab Summary hiển thị nút "Tạo tóm tắt" và selector chế độ
- [ ] Selector chế độ gồm 2 lựa chọn: "Tóm tắt nhanh" và "Tóm tắt chi tiết" (mặc định)
- [ ] Người dùng click "Tạo tóm tắt", hệ thống gọi `POST /api/ai/summary` với `lessonId` và `mode`
- [ ] Response là plain text (không stream); sau khi nhận thì persist vào `Lesson.summary` và hiển thị
- [ ] Nút "Tạo lại" luôn khả dụng để regenerate; kết quả mới ghi đè kết quả cũ
- [ ] Loading state rõ ràng trong khi đang generate
- [ ] Phần **Key Takeaways** (3 điểm) luôn xuất hiện ở đầu kết quả, bất kể chế độ nào

### Chế độ "Tóm tắt nhanh" (quick)
- [ ] Output 300-500 từ, trình bày bằng bullet points ngắn gọn
- [ ] Bắt đầu bằng Key Takeaways (3 điểm đánh số), tiếp theo là các bullet chính
- [ ] Không có cấu trúc Bloom's phức tạp

### Chế độ "Tóm tắt chi tiết" (detailed, mặc định)
- [ ] Output 600-2500 từ, cấu trúc đầy đủ theo Bloom's Taxonomy 6 mức
- [ ] Bắt đầu bằng Key Takeaways (3 điểm đánh số), tiếp theo là nội dung chi tiết
- [ ] Hành vi giống hệt chế độ cũ (unchanged)

---

## Edge Cases
- Bài học không có transcript: nút "Tạo tóm tắt" bị disable, tooltip "Cần có transcript"
- Transcript quá ngắn (< 100 ký tự): AI vẫn xử lý, không chặn
- AI provider trả lỗi (rate limit, timeout): hiển thị lỗi rõ ràng, không xóa summary cũ
- Transcript có ASR noise (nhận dạng sai): prompt có ASR degradation handling, AI tự suy ra nội dung
- Transcript trộn tiếng Anh/Việt (code-switching): prompt hỗ trợ, output bằng tiếng Việt
- Model reasoning trả về tag `<think>`: server strip tag trước khi trả về và lưu
- **Chuyển chế độ sau khi đã có cache:** nếu người dùng chuyển từ `detailed` sang `quick` (hoặc ngược lại) rồi nhấn "Tạo lại", server phải regenerate với prompt tương ứng, không dùng cache cũ. Mode hiện tại phải được gửi kèm trong request
- **Quick mode trên transcript rất dài:** AI vẫn tóm gọn trong 300-500 từ; prompt phải nhắc rõ giới hạn từ

---

## Làm rõ số từ theo chế độ

> **Ghi chú quan trọng:** PRD đề cập khoảng 600-2500 từ, trong khi một số tài liệu nghiên cứu ghi 300-500 từ. Mâu thuẫn này được giải quyết bằng hệ thống 2 chế độ:
>
> - **Quick (nhanh):** 300-500 từ, bullet points
> - **Detailed (chi tiết, mặc định):** 600-2500 từ, Bloom's Taxonomy
>
> Không còn mâu thuẫn nào. Mỗi chế độ có giới hạn từ riêng biệt và rõ ràng.

---

## API Contract

### POST /api/ai/summary

**Request:**
```json
{
  "lessonId": "string",
  "apiKey": "string",
  "baseUrl": "string",
  "model": "string",
  "mode": "quick | detailed"
}
```

> - `mode` không bắt buộc, mặc định là `"detailed"`
> - Transcript **không được gửi từ client** — server tự fetch từ DB qua `lessonId`

**Response 200:**
```json
{ "summary": "string" }
```

**Errors:**
- `400` — thiếu `lessonId` hoặc không tìm thấy transcript
- `500` — AI provider error hoặc DB error

---

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

---

## Data Model Changes
Không có thay đổi schema. Persist vào field `summary` (String?) trong bảng `Lesson`. Mode không được lưu riêng; khi người dùng muốn chế độ khác thì nhấn "Tạo lại" với mode mới.

---

## Clarification: Streaming vs Non-Streaming

> **PRD Inconsistency (flagged):** PRD Flow 3 (section 9) dùng từ "Kết quả stream" khi mô tả Summary. Tuy nhiên spec này và API contract định nghĩa response là **plain text không stream** (response 200 trả `{ "summary": "string" }` một lần duy nhất).
>
> **Quyết định:** Giữ **non-streaming** cho Summary. Lý do:
> - PRD dùng từ "stream" theo nghĩa thông thường ("kết quả chảy ra"), không phải SSE protocol
> - Chỉ AI Chat (F-31..F-35) mới dùng Server-Sent Events thật sự
> - Non-streaming đơn giản hơn và đủ cho use case Summary (tối đa ~2500 từ, dưới 10 giây)
>
> Nếu muốn đổi sang streaming: cần thay `Response 200` bằng `text/event-stream`, cập nhật client-side fetch, và cập nhật spec ai-chat.md để phân biệt rõ.

---

## Prompt Architecture

### Shared rules (áp dụng cả hai chế độ)
- AI đóng vai **Instructional Designer**
- Shared rule builders: `buildAsrRules()`, `buildLanguageRules()` (DRY pattern)
- Think-tag suppression ở cả prompt-level (`"Do not output <think>"`) và server-side (`/<think>[\s\S]*?<\/think>/g`)
- **Bắt buộc bắt đầu output bằng Key Takeaways:** "Bắt đầu bằng 3 điểm quan trọng nhất (Key Takeaways) dưới dạng danh sách đánh số, mỗi điểm tối đa 2 câu, trước khi vào nội dung chính"

### Chế độ "Tóm tắt chi tiết" (detailed)
- Cấu trúc output theo **Bloom's Taxonomy** 6 mức (Remember, Understand, Apply, Analyze, Evaluate, Create)
- Output tối thiểu 600 từ, tối đa ~2500 từ
- Hành vi giống hệt implementation cũ

### Chế độ "Tóm tắt nhanh" (quick)
- Prompt yêu cầu: bullet points ngắn gọn, không cần cấu trúc Bloom's
- Output 300-500 từ, tập trung vào facts và concepts cốt lõi
- Không có phần phân tích sâu hay ứng dụng thực tế
- Vẫn bắt đầu bằng Key Takeaways trước khi vào bullets

---

## UI Notes
- Tab "Summary" trong `AIAssistantPanel`
- Selector chế độ hiển thị trước nút "Tạo tóm tắt" (radio hoặc toggle: "Nhanh" / "Chi tiết")
- Kết quả hiển thị dưới dạng markdown rendered (hoặc plain text với whitespace preserved)
- Phần Key Takeaways nên được highlight hoặc có visual separator rõ ràng
- Nút "Tạo tóm tắt" / "Tạo lại" + loading spinner trong khi chờ
- Scroll độc lập với transcript panel
- Khi đã có summary cached và người dùng đổi chế độ: hiển thị thông báo "Chế độ khác với tóm tắt hiện tại. Nhấn 'Tạo lại' để generate theo chế độ mới"
