# Spec: Export

## Goal

Cho phép học viên xuất nội dung AI đã tạo (tóm tắt, giải thích, quiz, flashcard, bài tập) ra file để học offline, ôn tập bằng Anki, hoặc chia sẻ. Tính năng này không tạo thêm dữ liệu mới — chỉ đọc từ các field đã có trong DB và chuyển thành file tải về.

## User Stories

- Là học viên, tôi muốn tải tóm tắt bài học ra file `.md` để đọc khi không có mạng
- Là học viên, tôi muốn xuất flashcard sang Anki để ôn tập với thuật toán SRS chuyên biệt
- Là học viên, tôi muốn có một file Markdown duy nhất tổng hợp toàn bộ ghi chú của khóa học
- Là học viên, tôi muốn xuất kết quả quiz ra Markdown để xem lại câu nào mình làm sai và tại sao
- Là học viên, tôi muốn xuất bài tập kèm lời giải ra file để luyện tập offline
- Là học viên, tôi muốn xuất flashcard của toàn bộ khóa học vào một file Anki duy nhất thay vì từng bài
- Là học viên, tôi muốn xuất phần giải thích chi tiết ra Markdown để đọc lại khi quên

## Acceptance Criteria

### Xuất cấp bài học (per-lesson)

- [ ] Dropdown "Xuất" hiển thị trong header của `AIAssistantPanel`, chứa các tùy chọn phù hợp với tab đang active
- [ ] Tùy chọn "Xuất tóm tắt (.md)" gọi `POST /api/export/lesson/[id]` với `{ type: "summary", format: "markdown" }` → tải file `.md` có tiêu đề là tên bài học
- [ ] Tùy chọn "Xuất giải thích (.md)" gọi `POST /api/export/lesson/[id]` với `{ type: "explanation", format: "markdown" }` → tải file `.md`
- [ ] Tùy chọn "Xuất kết quả quiz (.md)" gọi `POST /api/export/lesson/[id]` với `{ type: "quiz", format: "markdown" }` → tải file `.md` gồm câu hỏi, đáp án người dùng (nếu có), và đáp án đúng kèm giải thích
- [ ] Tùy chọn "Xuất flashcard Anki (.csv)" gọi `POST /api/export/lesson/[id]` với `{ type: "flashcards", format: "csv" }` → tải file `.csv` định dạng `front;back` tương thích Anki
- [ ] Tùy chọn "Xuất flashcard (.md)" gọi `POST /api/export/lesson/[id]` với `{ type: "flashcards", format: "markdown" }` → tải file `.md` dạng bảng Markdown với cột Mặt trước / Mặt sau
- [ ] Tùy chọn "Xuất bài tập (.md)" gọi `POST /api/export/lesson/[id]` với `{ type: "exercises", format: "markdown" }` → tải file `.md` gồm đề bài và lời giải tham khảo

### Xuất cấp khóa học (per-course)

- [ ] Khu vực chi tiết khóa học (sidebar hoặc header) có nút/dropdown "Xuất toàn bộ"
- [ ] Tùy chọn "Xuất ghi chú khóa học (.md)" gọi `POST /api/export/course/[id]` với `{ type: "full-notes", format: "markdown" }` → tải một file `.md` duy nhất gộp tóm tắt + giải thích của tất cả bài học có dữ liệu AI, mỗi bài được phân cách bằng heading
- [ ] Tùy chọn "Xuất toàn bộ flashcard Anki (.csv)" gọi `POST /api/export/course/[id]` với `{ type: "all-flashcards", format: "csv" }` → tải một file `.csv` duy nhất chứa flashcard từ tất cả bài học

### Hành vi file tải về

- [ ] Tên file theo pattern: `{tên-bài-học}_{loại}.{định-dạng}` — ví dụ: `bai-01-async_summary.md`, `bai-01-async_flashcards.csv`
- [ ] Tên file ở cấp khóa học: `{tên-khóa-học}_{loại}.{định-dạng}`
- [ ] Tên file được sanitize: loại bỏ ký tự đặc biệt, chuyển khoảng trắng thành `-`, truncate nếu > 100 ký tự
- [ ] Browser kích hoạt dialog tải file (không mở tab mới)
- [ ] Response header đúng: `Content-Disposition: attachment; filename="..."` và `Content-Type` phù hợp

### Định dạng nội dung

- [ ] File Markdown tóm tắt bắt đầu bằng `# {Tên bài học}` rồi đến nội dung tóm tắt
- [ ] File Markdown giải thích bắt đầu bằng `# {Tên bài học} — Giải thích` rồi đến nội dung giải thích
- [ ] File Markdown quiz có cấu trúc: số thứ tự câu, câu hỏi, các lựa chọn (nếu là MCQ), đáp án đúng được đánh dấu, giải thích
- [ ] File CSV Anki: dòng đầu **không có** header, mỗi dòng là `"front";"back"`, các ký tự `"` trong nội dung được escape thành `""` (chuẩn CSV)
- [ ] File Markdown flashcard dùng bảng: `| Mặt trước | Mặt sau |` với header, separator, và các dòng dữ liệu
- [ ] File Markdown bài tập: mỗi bài là section `## Bài tập {n}: {title}`, gồm đề bài, gợi ý (dạng blockquote hoặc list), và lời giải trong details/collapsible nếu markdown hỗ trợ (hoặc section rõ ràng)
- [ ] File ghi chú toàn khóa học: `# {Tên khóa học} — Ghi chú`, rồi mỗi bài là section `## {Tên bài học}` với tóm tắt và giải thích bên trong; bài chưa có AI data được bỏ qua

## Edge Cases

- Bài học chưa có dữ liệu AI cho loại được yêu cầu (ví dụ: chưa tạo flashcard) → trả về `404` với body `{ "error": "Dữ liệu chưa được tạo. Vui lòng tạo {loại} trước khi xuất." }`
- Mảng flashcard rỗng (`cards: []`) → trả về file hợp lệ với nội dung: file CSV không có dòng dữ liệu, file Markdown có bảng chỉ gồm header; không trả lỗi
- Mảng quiz hoặc exercises rỗng → tương tự: file hợp lệ, nội dung placeholder "Không có dữ liệu"
- Khóa học có 50+ bài học → export full-notes vẫn phải hoạt động; server xử lý tuần tự, không giới hạn số bài; response có thể mất vài giây → UI hiển thị loading state
- Nội dung có ký tự đặc biệt trong Markdown (ký tự `|`, `\`, backtick trong nội dung bảng) → escape đúng cách để bảng không bị vỡ
- Nội dung flashcard có dấu `;` hoặc `"` → CSV phải escape chuẩn RFC 4180: bọc field trong `"..."`, các `"` bên trong thành `""`
- Nội dung có emoji hoặc ký tự Unicode → giữ nguyên, không strip; đảm bảo response header `charset=utf-8`
- Tên bài học hoặc khóa học chứa ký tự `/`, `\`, `:`, `*`, `?` (không hợp lệ trong tên file) → sanitize phía server trước khi set `filename` trong header
- JSON field trong DB bị corrupt hoặc không parse được → trả về `500` với thông báo lỗi rõ ràng, không crash server
- Người dùng click xuất nhiều lần liên tiếp → mỗi request độc lập, không cần debounce phía server; UI nút bị disable trong khi đang tải

## API Contract

### POST /api/export/lesson/[id]

Xuất nội dung AI của một bài học cụ thể ra file.

**Request body:**
```json
{
  "type": "summary | explanation | quiz | flashcards | exercises",
  "format": "markdown | csv"
}
```

> **Ràng buộc:** `type: "flashcards"` hỗ trợ cả `format: "markdown"` và `format: "csv"`. Các `type` còn lại chỉ hỗ trợ `format: "markdown"`. Gửi `format: "csv"` với `type` không phải `"flashcards"` → trả về `400`.

**Response khi thành công:**
- Status: `200`
- Headers:
  - `Content-Type: text/markdown; charset=utf-8` (với Markdown) hoặc `text/csv; charset=utf-8` (với CSV)
  - `Content-Disposition: attachment; filename="{sanitized-name}_{type}.{ext}"`
- Body: nội dung file dạng text

**Errors:**
- `400` — `type` hoặc `format` không hợp lệ, hoặc tổ hợp không được phép
- `404` — `id` bài học không tồn tại, hoặc dữ liệu AI cho `type` chưa được tạo
- `500` — lỗi parse JSON từ DB, hoặc lỗi server không xác định

---

### POST /api/export/course/[id]

Xuất nội dung AI tổng hợp của toàn bộ khóa học ra một file duy nhất.

**Request body:**
```json
{
  "type": "full-notes | all-flashcards",
  "format": "markdown | csv"
}
```

> **Ràng buộc:** `type: "full-notes"` chỉ hỗ trợ `format: "markdown"`. `type: "all-flashcards"` chỉ hỗ trợ `format: "csv"`. Tổ hợp sai → `400`.

**Response khi thành công:**
- Status: `200`
- Headers: tương tự endpoint bài học
- Body: nội dung file dạng text

**Errors:**
- `400` — `type` hoặc `format` không hợp lệ
- `404` — `id` khóa học không tồn tại
- `500` — lỗi server

---

> **Lưu ý chung:** Server đọc dữ liệu bài học trực tiếp từ DB qua `lessonId`/`courseId`. Client không cần gửi nội dung lên. Response là stream file — không phải JSON.

## Data Model Changes

Không có thay đổi schema Prisma. Tính năng này đọc từ các field đã có:

| Model | Field | Mô tả |
|---|---|---|
| `Lesson` | `summary String?` | Tóm tắt bài học (plain text hoặc Markdown) |
| `Lesson` | `explanation String?` | Giải thích chi tiết (plain text hoặc Markdown) |
| `Lesson` | `quiz String?` | JSON string theo shape Quiz |
| `Lesson` | `flashcards String?` | JSON string theo shape Flashcard |
| `Lesson` | `exercises String?` | JSON string theo shape Exercises |
| `Lesson` | `title String` | Tên bài học (dùng cho tiêu đề và tên file) |
| `Course` | `title String` | Tên khóa học |

**JSON shapes tham chiếu (từ spec `ai-practice.md`):**

Quiz:
```json
{
  "questions": [
    {
      "type": "mcq | true_false | fill_blank | short_answer | code_completion",
      "question": "string",
      "options": ["string"],
      "answer": "string",
      "explanation": "string",
      "bloom_level": "remember | understand | apply | analyze | evaluate | create"
    }
  ]
}
```

Flashcard:
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

Exercises:
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

### Xuất cấp bài học

- Dropdown button "Xuất" (icon download + text) đặt trong header của `AIAssistantPanel`, bên cạnh các nút điều khiển hiện có
- Nội dung dropdown phụ thuộc vào tab đang active:
  - Tab "Summary": hiển thị "Xuất tóm tắt (.md)"
  - Tab "Explain": hiển thị "Xuất giải thích (.md)"
  - Tab "Practice" → sub-tab Quiz: hiển thị "Xuất kết quả quiz (.md)"
  - Tab "Practice" → sub-tab Flashcard: hiển thị "Xuất flashcard Anki (.csv)" và "Xuất flashcard (.md)"
  - Tab "Practice" → sub-tab Bài tập: hiển thị "Xuất bài tập (.md)"
  - Tab "Chat": không có nút xuất (chat history không export trong phiên bản này)
- Các mục trong dropdown bị disable kèm tooltip "Chưa có dữ liệu — tạo trước khi xuất" nếu dữ liệu tương ứng chưa được generate
- Khi đang tải file: nút chuyển sang trạng thái loading (spinner nhỏ), disable tạm thời
- Sau khi tải xong: nút trở lại bình thường, không có toast (browser tự xử lý dialog tải)
- Nếu có lỗi từ server: hiển thị toast lỗi với thông báo từ response

### Xuất cấp khóa học

- Nút/dropdown "Xuất toàn bộ" trong phần header chi tiết khóa học hoặc trong sidebar, gần tên khóa học
- Hai tùy chọn:
  - "Xuất ghi chú khóa học (.md)" — xuất full-notes
  - "Xuất toàn bộ flashcard Anki (.csv)" — xuất all-flashcards
- Cả hai luôn enable (khóa học có thể có 0 bài với AI data → xuất file hợp lệ nhưng gần như rỗng, không báo lỗi)
- Loading state: nút disable + spinner trong khi server đang tổng hợp (có thể vài giây với khóa học lớn)
- Tooltip giải thích ngắn gọn khi hover: "Xuất tóm tắt và giải thích tất cả bài học thành một file"

### Lý do giáo dục (hiển thị trong tooltip hoặc empty state)

- Xuất Markdown → học offline, không cần mạng, dễ tìm kiếm
- Xuất Anki CSV → dùng thuật toán spaced repetition để ôn tập hiệu quả hơn
- Xuất ghi chú toàn khóa → có bức tranh tổng thể, dễ ôn thi hoặc chia sẻ với người khác
