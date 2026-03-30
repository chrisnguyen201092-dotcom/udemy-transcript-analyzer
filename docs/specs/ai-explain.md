# Spec: AI Explain

## Goal

Tạo giải thích sâu bài học theo Feynman Technique, tự động phân loại format output dựa trên tỷ lệ code trong transcript, hỗ trợ 3 mức độ giải thích, tích hợp LearnerProfile để cá nhân hóa, cho phép giải thích đoạn văn bản được chọn, và persist kết quả vào DB.

---

## User Stories

- Là học viên, tôi muốn nhận giải thích chi tiết hơn summary để thực sự hiểu bài
- Là học viên, tôi muốn giải thích được điều chỉnh tự động: nhiều code example nếu bài lập trình, nhiều lý thuyết nếu bài conceptual
- Là học viên, tôi muốn giải thích được lưu lại để xem lại không cần generate
- Là học viên, tôi muốn chọn mức độ giải thích: đơn giản / chuẩn / chuyên sâu tùy theo trình độ và nhu cầu
- Là học viên mới bắt đầu, tôi muốn hệ thống tự động chọn mức đơn giản nhất dựa trên trình độ của tôi
- Là học viên, tôi muốn bôi đen một đoạn transcript khó hiểu và yêu cầu giải thích riêng đoạn đó

---

## Acceptance Criteria

### Cache và hiển thị cơ bản
- [ ] Khi chọn bài học, nếu `explanation != null` thì hiển thị ngay trong tab Explain
- [ ] Nếu `explanation == null`, tab Explain hiển thị nút "Giải thích sâu"
- [ ] Nút "Giải thích lại" luôn khả dụng; kết quả mới ghi đè cũ
- [ ] Loading state hiển thị trong khi generate

### Phân loại transcript (code-ratio)
- [ ] Server phân loại transcript: tính % dòng có chứa code block / backtick / indent patterns
  - ≥ 40% code → Format A (code-heavy)
  - ≤ 20% code → Format B (theory-heavy)
  - Còn lại → Hybrid
- [ ] Response tối thiểu 800 từ; persist vào `Lesson.explanation`

### Depth Selector (3 mức độ)
- [ ] UI hiển thị bộ chọn mức độ với 3 tùy chọn:
  - **Đơn giản** (`simple`): ELI5 style, dùng analogy nhiều, tối thiểu thuật ngữ kỹ thuật, 500-800 từ
  - **Chuẩn** (`standard`, mặc định): Feynman Technique đầy đủ, 800-3500 từ
  - **Chuyên sâu** (`deep`): bao gồm edge cases, performance implications, cơ chế nội tại, các hướng tiếp cận thay thế, 1500-5000 từ
- [ ] Mức `standard` là giá trị mặc định khi không có LearnerProfile
- [ ] Người dùng có thể thay đổi mức độ trước khi generate; kết quả cũ không bị xóa cho đến khi generate thành công
- [ ] Mỗi mức độ sinh ra bộ prompt instructions khác nhau (xem phần Prompt Architecture)

### LearnerProfile Integration
- [ ] Nếu LearnerProfile tồn tại cho khóa học hiện tại, hệ thống tự động pre-select mức độ:
  - `beginner` → pre-select `simple`
  - `intermediate` → pre-select `standard`
  - `advanced` → pre-select `deep`
- [ ] Người dùng có thể override thủ công bất kỳ lúc nào
- [ ] Dữ liệu profile (level, focus areas nếu có) được inject vào system prompt để cá nhân hóa nội dung giải thích
- [ ] Nếu LearnerProfile chưa tồn tại, fallback về `standard` không báo lỗi

### Explain This Selection (giải thích đoạn được chọn)
- [ ] Trong tab Transcript, khi người dùng bôi đen text, hiển thị nút "Giải thích đoạn này"
- [ ] Nhấn nút đó → chuyển sang tab Explain, tự động điền `selectedText` và generate ngay
- [ ] Server sử dụng `selectedText` làm nội dung cần giải thích; toàn bộ transcript là background context
- [ ] Kết quả từ chế độ này KHÔNG ghi đè `Lesson.explanation` (lưu tạm, không persist)
- [ ] Nếu không có transcript nhưng có `selectedText`, vẫn generate được (không cần background context)

---

## Edge Cases

- Bài học không có transcript → nút bị disable (trừ khi có `selectedText`)
- AI trả lỗi → hiển thị lỗi, không xóa explanation cũ
- Transcript thuần lý thuyết (0% code) → Format B, không crash classification
- Model reasoning trả về `<think>` → server strip tag
- Transcript quá dài → truncate ở 8000 tokens trước khi gửi (estimate: 1 token ≈ 4 chars)
- Depth `deep` với transcript rất ngắn (dưới 200 từ) → server downgrade tự động về `standard`, trả thêm field `depthActual` trong response để UI có thể thông báo
- `selectedText` được gửi nhưng transcript không tồn tại → generate chỉ với selectedText, không báo lỗi, nhưng chất lượng có thể thấp hơn
- LearnerProfile không tồn tại → fallback về `standard` silently, không hiển thị warning
- `selectedText` rỗng string → server trả `400`, không xử lý

---

## API Contract

### POST /api/ai/explain

**Request:**
```json
{
  "lessonId": "string",
  "apiKey": "string",
  "baseUrl": "string",
  "model": "string",
  "depth": "simple | standard | deep",
  "selectedText": "string (optional)",
  "force": true
}
```

> **Note:** Transcript không được gửi từ client. Server tự fetch từ DB qua `lessonId`.
> `depth` mặc định là `"standard"` nếu không truyền.
> `selectedText` là optional. Nếu có thì server giải thích đoạn đó; transcript là background context.
> `force: true` bỏ qua cache và generate lại.

**Response 200:**
```json
{
  "explanation": "string",
  "depthActual": "simple | standard | deep"
}
```

> `depthActual` trả về mức độ thực sự được dùng (có thể khác `depth` nếu server tự downgrade).

**Errors:**
- `400` — thiếu `lessonId`, hoặc `selectedText` là chuỗi rỗng
- `500` — AI provider error hoặc DB error

---

## Data Model Changes

Không thay đổi schema hiện tại. Persist vào field `explanation` (String?) trong bảng `Lesson`.

> Kết quả từ chế độ "Explain This Selection" không persist, chỉ trả về trong response.

---

## Prompt Architecture

- AI đóng vai **Subject Matter Expert** dùng **Feynman Technique**
- Shared rule builders: `buildAsrRules()`, `buildLanguageRules()`
- Think-tag suppression giống AI Summary

### Format theo code-ratio
- **Format A** (code-heavy): walkthrough code step-by-step, nhiều code example minh họa
- **Format B** (theory-heavy): analogy, mental model, real-world example
- **Hybrid**: kết hợp cả hai

### Prompt instructions theo depth

**`simple` (đơn giản):**
- Viết như giải thích cho người chưa biết gì về lĩnh vực này
- Dùng analogy từ cuộc sống thường ngày
- Tránh thuật ngữ kỹ thuật; nếu bắt buộc phải dùng thì giải thích ngay tại chỗ
- Ưu tiên câu ngắn, ví dụ cụ thể, không liệt kê dài
- Độ dài mục tiêu: 500-800 từ

**`standard` (chuẩn, mặc định):**
- Áp dụng đầy đủ Feynman Technique: giải thích, xác định chỗ chưa rõ, đơn giản hóa, dùng analogy
- Cân bằng lý thuyết và ví dụ thực tế
- Độ dài mục tiêu: 800-3500 từ

**`deep` (chuyên sâu):**
- Bao gồm tất cả của `standard`
- Thêm: edge cases, performance implications, cơ chế nội tại (how it works under the hood)
- Thêm: so sánh các hướng tiếp cận thay thế với trade-offs
- Phù hợp cho người đã có nền tảng, muốn hiểu sâu để áp dụng và mở rộng
- Độ dài mục tiêu: 1500-5000 từ

### LearnerProfile injection
Nếu profile tồn tại, inject vào system prompt:
```
Người học có trình độ: {level}. Điều chỉnh ngôn ngữ và độ sâu phù hợp với trình độ đó.
```

### selectedText mode
Nếu `selectedText` tồn tại, thay đổi focus của prompt:
```
Tập trung giải thích đoạn sau: "{selectedText}". 
Dùng toàn bộ transcript làm context nền nhưng KHÔNG giải thích lại toàn bộ transcript.
```

---

## UI Notes

- Tab "Explain" trong `AIAssistantPanel`
- Kết quả hiển thị dưới dạng markdown rendered
- Bộ chọn mức độ (3 nút toggle hoặc segmented control) đặt trên nút "Giải thích sâu"
- Hiển thị mức độ hiện tại của explanation đã cache (nếu có)
- Nếu `depthActual` khác `depth` yêu cầu, hiển thị thông báo nhỏ: "Đã tự động điều chỉnh về mức chuẩn do transcript ngắn"
- Nút "Giải thích đoạn này" xuất hiện như một floating button hoặc context menu khi bôi đen trong tab Transcript
- Kết quả selectedText hiển thị trong tab Explain với badge "Giải thích đoạn được chọn" để phân biệt với explanation đầy đủ
- Scroll độc lập
