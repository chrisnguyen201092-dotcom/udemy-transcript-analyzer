# Spec: AI Practice (Quiz / Flashcard / Bài tập)

## Goal
Tạo nội dung luyện tập từ transcript bài học: Quiz trắc nghiệm, Flashcard SRS, và Bài tập thực hành Deliberate Practice. Kết quả persist vào DB để tải lại tự động.

## User Stories
- Là học viên, tôi muốn làm quiz để kiểm tra mình đã hiểu bài chưa
- Là học viên, tôi muốn flashcard để ôn tập nhanh các khái niệm chính
- Là học viên, tôi muốn bài tập thực hành để áp dụng kiến thức vào tình huống thực

## Acceptance Criteria

### Chung
- [ ] Tab "Practice" hiển thị 3 sub-tab: Quiz, Flashcard, Bài tập
- [ ] Khi chọn bài học → load kết quả đã lưu từ `GET /api/lessons/[id]/ai` cho cả 3 chế độ
- [ ] Mỗi chế độ có nút "Tạo [Quiz/Flashcard/Bài tập]" nếu chưa có dữ liệu, và nút "Tạo lại" nếu đã có
- [ ] Kết quả persist vào field tương ứng (`quiz`, `flashcards`, `exercises`) trong bảng `Lesson`

### Quiz (F-37)
- [ ] AI tạo 8–12 câu hỏi, mix 4 loại: trắc nghiệm (MCQ), đúng-sai, điền khuyết, trả lời ngắn, hoàn thành code
- [ ] Phân bố Bloom's Taxonomy: 30% Nhớ/Hiểu, 40% Áp dụng/Phân tích, 30% Đánh giá/Sáng tạo
- [ ] Mỗi câu có đáp án đúng và giải thích chi tiết tại sao đúng/sai
- [ ] Response là JSON string lưu vào `Lesson.quiz`

### Flashcard (F-38)
- [ ] AI tạo 15–25 thẻ theo Minimum Information Principle
- [ ] 5 loại thẻ: Term→Definition, Concept→Explanation, Code→Output, Scenario→Solution, Compare→Differences
- [ ] Mỗi thẻ có thêm `mnemonic` (gợi nhớ)
- [ ] Response là JSON string lưu vào `Lesson.flashcards`

### Bài tập thực hành (F-39)
- [ ] AI tạo 3–5 bài tập theo Deliberate Practice
- [ ] Phân loại bài tập: Tái hiện, Mở rộng, Sáng tạo, Debug, Mini Project
- [ ] AI tự phân loại transcript: Lý thuyết/Thực hành/Hỗn hợp → điều chỉnh dạng bài tập
- [ ] Mỗi bài tập có: đề bài, gợi ý, rubric đánh giá, lời giải tham khảo
- [ ] Response là JSON string lưu vào `Lesson.exercises`

## Edge Cases
- Bài học không có transcript → nút tạo bị disable với tooltip "Cần có transcript"
- AI trả JSON không hợp lệ → hiển thị lỗi, không crash parser; lưu raw string vào DB như fallback
- AI provider trả lỗi → hiển thị lỗi, không xóa dữ liệu cũ
- Transcript quá ngắn (< 200 chars) → AI vẫn tạo nhưng số lượng câu/thẻ có thể ít hơn minimum
- Model reasoning output `<think>` → server strip tag trước khi parse JSON

## API Contract

### POST /api/ai/quiz
**Request:**
```json
{
  "lessonId": "string",
  "mode": "quiz | flashcards | exercises",
  "apiKey": "string",
  "baseUrl": "string",
  "model": "string"
}
```
> **Note:** Transcript is **not sent by the client** — the server fetches it from the DB using `lessonId`.
**Response 200:**
```json
{ "result": "string (JSON string)" }
```
**Errors:**
- `400` — thiếu `lessonId`, `transcript`, hoặc `mode` không hợp lệ
- `500` — AI provider error hoặc DB error

## Data Model Changes
Không có thay đổi schema. Sử dụng 3 fields hiện có trong `Lesson`:
- `quiz String?` — JSON string quiz data
- `flashcards String?` — JSON string flashcard data
- `exercises String?` — JSON string exercises data

## Expected JSON Shapes

### Quiz
```json
{
  "questions": [
    {
      "type": "mcq | true_false | fill_blank | short_answer | code_completion",
      "question": "string",
      "options": ["string"] ,
      "answer": "string",
      "explanation": "string",
      "bloom_level": "remember | understand | apply | analyze | evaluate | create"
    }
  ]
}
```

### Flashcard
```json
{
  "cards": [
    {
      "type": "term_definition | concept_explanation | code_output | scenario_solution | compare_differences",
      "front": "string",
      "back": "string",
      "mnemonic": "string"
    }
  ]
}
```

### Exercises
```json
{
  "exercises": [
    {
      "type": "recall | extension | creative | debug | mini_project",
      "title": "string",
      "description": "string",
      "hints": ["string"],
      "rubric": "string",
      "solution": "string"
    }
  ]
}
```

## UI Notes
- Tab "Practice" → sub-tabs: Quiz | Flashcard | Bài tập
- Quiz: hiển thị từng câu hỏi, click "Xem đáp án" để reveal
- Flashcard: flip card animation, nút Next/Previous
- Bài tập: accordion, click để expand đề bài + gợi ý + lời giải
- Loading state cho từng chế độ độc lập
