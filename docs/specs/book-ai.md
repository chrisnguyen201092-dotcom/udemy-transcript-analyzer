# Spec: Book-Aware AI Prompt Adaptation (B-09, B-10, B-11, B-12)

## Goal

Điều chỉnh hệ thống AI prompt để nhận biết loại nội dung (sách/giáo trình vs khóa học video), từ đó sử dụng ngữ cảnh phù hợp: bỏ qua hoàn toàn ASR degradation rules khi nội dung là văn bản đã viết, thay nhãn "bài học/khóa học" bằng "chương/sách", và điều chỉnh framing học thuật cho từng loại prompt.

## User Stories

- Là học viên đọc sách, tôi muốn bản tóm tắt chương dùng cấu trúc học thuật thay vì cấu trúc bài giảng video
- Là học viên đọc sách, tôi muốn phần giải thích không đề cập đến "video" hay "transcript lỗi" vì tôi đang đọc văn bản
- Là học viên đọc sách, tôi muốn quiz và flashcard tham chiếu đến trang/phần thay vì "bài học"
- Là học viên đọc sách, tôi muốn lộ trình học là "Kế hoạch đọc" — thứ tự đọc, chương quan trọng, chương có thể bỏ qua
- Là nhà phát triển, tôi muốn tất cả AI route nhận tham số `contentType` để chọn prompt variant đúng mà không cần thay đổi logic cache

## Acceptance Criteria

- [ ] Hàm `getSystemPrompt(type)` được mở rộng thành `getSystemPrompt(type, contentType?)` — khi `contentType === "book"` trả về prompt variant dành cho sách; khi `contentType` không truyền hoặc là `"course"` hành vi giống hệt hiện tại (backward compatible)
- [ ] Tất cả prompt dành cho sách KHÔNG gọi `buildASRRules()` — không có khối "XỬ LÝ TRANSCRIPT ASR KÉM" nào xuất hiện trong output
- [ ] Prompt summary dành cho sách dùng nhãn "chương sách" thay vì "bài học", thêm academic framing (luận điểm chính, lập luận, trích dẫn nếu có), giữ nguyên Bloom's Taxonomy và cấu trúc section
- [ ] Prompt explain dành cho sách bỏ mọi tham chiếu đến "video" hoặc "xem lại video", thay bằng "xem lại nội dung chương"; giữ nguyên Feynman Technique và phân loại Format A/B/Hybrid
- [ ] Prompt quiz/flashcard/exercise dành cho sách tham chiếu "trang/phần" thay vì "bài học", dùng thuật ngữ "văn bản đã viết" thay vì "transcript"
- [ ] Prompt chat dành cho sách điều chỉnh persona gia sư: thay "xem lại video phần [mô tả]" bằng "xem lại chương/trang [mô tả]"
- [ ] Prompt roadmap dành cho sách trở thành "Kế hoạch đọc" (Reading Plan): thứ tự đọc tối ưu, đánh dấu chương thiết yếu vs có thể bỏ qua, ước tính thời gian đọc
- [ ] Tất cả 5 AI route (`/api/ai/summary`, `/api/ai/explain`, `/api/ai/quiz`, `/api/ai/chat`, `/api/ai/roadmap`) chấp nhận tham số `contentType` trong request body và truyền xuống `getSystemPrompt`
- [ ] Kết quả AI cache vẫn hoạt động đúng cho cả hai content type — cache key phân biệt `contentType` để tránh trả nhầm cache sách cho khóa học
- [ ] `buildLanguageRules()` tiếp tục được dùng cho cả sách và khóa học — quy tắc ngôn ngữ không thay đổi

## Edge Cases

- `contentType` không được truyền trong request → mặc định là `"course"` để đảm bảo backward compatible với toàn bộ dữ liệu hiện có
- Sách có chương rất ngắn (< 200 từ) → prompt vẫn chạy bình thường; kết quả AI có thể ngắn hơn mức tối thiểu, không bị lỗi
- Sách không có cấu trúc rõ ràng (toàn bộ nội dung là một khối văn bản liên tục) → prompt không đảm nhận có heading hay số chương; AI suy luận cấu trúc từ nội dung
- Người dùng gọi `getSystemPrompt("roadmap", "book")` cho một sách chỉ có 1 chương → AI vẫn trả về Kế hoạch đọc dù chỉ có 1 mục
- Nội dung chương chứa code (ví dụ sách lập trình) → phân loại Format A/B/Hybrid của explain prompt vẫn hoạt động như bình thường

## API Contract

### Thay đổi chung cho tất cả AI route

Tất cả 5 route sau đây thêm trường `contentType` vào request body:

**Các route bị ảnh hưởng:**
- `POST /api/ai/summary`
- `POST /api/ai/explain`
- `POST /api/ai/quiz`
- `POST /api/ai/chat`
- `POST /api/ai/roadmap`

**Thêm vào request body (optional field):**
```json
{
  "contentType": "course | book"
}
```
> Không truyền = mặc định `"course"`. Các trường khác của từng route không thay đổi.

**Thay đổi cache key** (nội bộ, không ảnh hưởng client):
- Cache lookup phải kết hợp `lessonId` (hoặc `courseId`) với `contentType` để tránh collision

**Không có response thay đổi** — format output AI giữ nguyên; chỉ nội dung prompt thay đổi.

### Thay đổi `getSystemPrompt`

```typescript
// Trước
export function getSystemPrompt(type: PromptType): string

// Sau
export type ContentType = "course" | "book";
export function getSystemPrompt(type: PromptType, contentType?: ContentType): string
```

Khi `contentType === "book"`:
- `"summary"` → trả về `SUMMARY_BOOK_SYSTEM_PROMPT`
- `"summary-quick"` → trả về `SUMMARY_QUICK_BOOK_SYSTEM_PROMPT`
- `"explain"` → trả về prompt book từ `getExplainPrompt(...)` với book context
- `"chat"` → trả về `CHAT_BOOK_SYSTEM_PROMPT`
- `"roadmap"` → trả về `READING_PLAN_SYSTEM_PROMPT`
- `"quiz"` → trả về `QUIZ_BOOK_SYSTEM_PROMPT`
- `"flashcards"` → trả về `FLASHCARD_BOOK_SYSTEM_PROMPT`
- `"exercises"` → trả về `EXERCISE_BOOK_SYSTEM_PROMPT`

## Data Model Changes

Không có thay đổi schema trong spec này. `contentType` trên model `Course` đã được định nghĩa ở spec B-01 (`contentType String @default("course")`).

Các AI route fetch `contentType` từ bản ghi `Course` liên quan đến `lessonId` hoặc `courseId` được truyền vào — không cần client tự tính toán lại giá trị này.

## UI Notes

Không có thay đổi UI trong spec này. Tất cả thay đổi là backend/prompt logic.

Phần hiển thị nhãn "Chương" / "Sách" trên giao diện được xử lý ở spec B-13 (Conditional UI labels) — tách biệt hoàn toàn với spec này.

## Ghi chú kiến trúc

### Tại sao bỏ `buildASRRules()` cho sách

ASR (Automatic Speech Recognition) sinh ra lỗi đặc trưng: chính tả sai, câu cụt, từ ngẫu nhiên do nhận diện nhầm âm thanh. Sách là văn bản đã được biên tập — không có nhiễu này. Đưa ASR rules vào prompt cho sách sẽ khiến AI "tìm lỗi không tồn tại", gây hiểu nhầm hoặc thêm cảnh báo ⚠️ không cần thiết.

### Phạm vi thay đổi tối thiểu

Pipeline AI (~80% logic) không thay đổi: fetch nội dung, truncate, gọi OpenAI SDK, cache, trả về. Chỉ có chuỗi system prompt thay đổi. Điều này đảm bảo rủi ro regression thấp.

### Thứ tự triển khai đề xuất

```
1. Thêm ContentType type + cập nhật getSystemPrompt signature
2. Viết SUMMARY_BOOK_SYSTEM_PROMPT (book variant)
3. Cập nhật getExplainPrompt để nhận contentType
4. Viết CHAT_BOOK_SYSTEM_PROMPT
5. Viết READING_PLAN_SYSTEM_PROMPT
6. Viết QUIZ_BOOK / FLASHCARD_BOOK / EXERCISE_BOOK prompts
7. Cập nhật 5 AI route để đọc contentType từ DB và truyền xuống
8. Cập nhật cache key logic
```
