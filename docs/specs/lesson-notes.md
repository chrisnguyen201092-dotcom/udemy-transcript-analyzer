# Spec: Ghi chú Bài học (Lesson Notes)

## Goal

Cho phép học viên viết và lưu ghi chú cá nhân cho từng bài học, hoàn toàn tách biệt với transcript (transcript = nội dung gốc của bài giảng, ghi chú = suy nghĩ và diễn giải của chính học viên). Ghi chú được viết bằng Markdown, tự động lưu, và có thể tìm kiếm xuyên suốt toàn khóa học.

**Tại sao cần tính năng này:**
Ghi chú bằng ngôn ngữ của chính mình là chiến lược học hiệu quả nhất (encoding + retrieval practice). Transcript chỉ là nguồn tham khảo. Khi học viên tự diễn giải lại bằng lời của mình, họ hiểu sâu hơn và nhớ lâu hơn. Việc hỗ trợ Markdown cho phép cấu trúc hóa ghi chú với heading, code block, danh sách...

## User Stories

- Là học viên, tôi muốn viết ghi chú riêng cho từng bài học để ghi lại những điều quan trọng theo cách hiểu của mình
- Là học viên, tôi muốn ghi chú tự động lưu khi tôi gõ, không cần bấm nút "Lưu" thủ công
- Là học viên, tôi muốn viết ghi chú bằng Markdown để có thể thêm tiêu đề, danh sách, code block
- Là học viên, tôi muốn xem trước ghi chú đã render ra HTML để kiểm tra định dạng Markdown
- Là học viên, tôi muốn biết khi nào ghi chú đang được lưu và khi nào đã lưu thành công
- Là học viên, tôi muốn chèn nhanh tóm tắt hoặc giải thích từ AI vào ghi chú kèm trích dẫn nguồn
- Là học viên, tôi muốn tìm kiếm nội dung ghi chú trên tất cả bài học trong khóa học để ôn lại nhanh

## Acceptance Criteria

- [ ] Tab "Ghi chú" hiển thị trong `AIAssistantPanel`, nằm cạnh các tab Transcript, Chat, v.v.
- [ ] Khi chọn bài học có ghi chú → editor hiển thị nội dung ghi chú đã lưu
- [ ] Khi chọn bài học chưa có ghi chú → editor hiển thị trống với placeholder
- [ ] Người dùng gõ vào editor → sau 2 giây không gõ thêm → hệ thống tự gọi `PUT /api/lessons/[id]/notes`
- [ ] Trong khoảng thời gian debounce đang chờ: hiển thị trạng thái "Chưa lưu..."
- [ ] Khi request đang gửi: hiển thị "Đang lưu..."
- [ ] Sau khi lưu thành công: hiển thị "Đã lưu" kèm thời điểm lưu cuối (ví dụ: "Đã lưu lúc 14:32")
- [ ] Editor có toolbar với các nút: **B** (bold), *I* (italic), H (heading), `code`, danh sách, blockquote
- [ ] Nút toggle "Chỉnh sửa / Xem trước" để chuyển giữa raw Markdown và HTML rendered
- [ ] Trong chế độ Xem trước: Markdown được render đầy đủ (heading, code block, table, link, hình ảnh qua URL)
- [ ] Mỗi bài học hiển thị thời gian chỉnh sửa ghi chú cuối cùng (lấy từ `lesson.updatedAt` sau khi lưu)
- [ ] Tab "Chat" (AI) hiển thị nút "Chèn vào ghi chú" bên cạnh mỗi response của AI
- [ ] Click "Chèn vào ghi chú" → chèn đoạn text đó vào cuối ghi chú kèm dòng trích dẫn `> Trích từ AI Assistant (bài: {tên bài học})`
- [ ] Thanh tìm kiếm ghi chú hiển thị phía trên editor (có thể collapse)
- [ ] Người dùng nhập từ khóa vào thanh tìm kiếm → hệ thống gọi `GET /api/courses/[id]/notes/search?q=keyword`
- [ ] Kết quả tìm kiếm hiển thị danh sách bài học có ghi chú chứa từ khóa, kèm đoạn trích ngắn (snippet 100 ký tự) với từ khóa được highlight
- [ ] Click vào kết quả tìm kiếm → chuyển đến bài học đó và hiển thị tab Ghi chú
- [ ] Khi chuyển sang bài học khác trong lúc debounce đang đếm → flush ngay lập tức, lưu ghi chú hiện tại trước khi chuyển
- [ ] Ghi chú được load từ DB (`lesson.notes`) khi chọn bài học, không cần request riêng (trả về cùng với data bài học)

## Edge Cases

- **Ghi chú rất dài (> 100KB):** Server chấp nhận nhưng UI cảnh báo "Ghi chú đang khá dài, có thể ảnh hưởng hiệu năng" khi vượt 50,000 ký tự. Không chặn lưu.
- **Concurrent auto-save:** Nếu request PUT đang chạy và người dùng tiếp tục gõ → debounce reset, không gửi request mới đến khi request cũ hoàn thành (queue 1 lần). Tránh race condition ghi đè nội dung mới bằng nội dung cũ.
- **Chuyển bài giữa chừng:** Flush debounce ngay khi `lessonId` thay đổi (trong `useEffect` cleanup). Đợi request hoàn thành trước khi load ghi chú bài mới nếu có thể; nếu không, cancel request cũ.
- **Ghi chú với code block có nhiều backtick:** Markdown parser phải xử lý đúng fenced code block (``` ``` ```) kể cả khi có ngôn ngữ (```typescript).
- **Ảnh qua URL trong Markdown:** Render `![alt](url)` bình thường. Không hỗ trợ upload ảnh, chỉ URL. Nếu URL ảnh lỗi → hiển thị alt text thay thế.
- **Tìm kiếm với query rỗng:** Server trả `400 Bad Request` nếu `q` không có hoặc là chuỗi rỗng. Client disable nút tìm kiếm khi input trống.
- **Tìm kiếm không có kết quả:** Hiển thị "Không tìm thấy ghi chú nào chứa '{keyword}'" thay vì danh sách trống không có giải thích.
- **Lưu thất bại (network error):** Hiển thị "Lưu thất bại, thử lại sau" với nút retry thủ công. Nội dung trong editor không bị mất.
- **Bài học không có ghi chú trước đó:** `PUT` lần đầu tạo mới record (upsert), không cần `POST` riêng.
- **Table Markdown với nhiều cột:** Render đúng bảng HTML. Nếu table quá rộng → overflow-x scroll trong preview.

## API Contract

### GET /api/lessons/[id]/notes
Lấy nội dung ghi chú của một bài học.

**Response 200:**
```json
{
  "lessonId": "string",
  "notes": "string | null",
  "updatedAt": "ISO 8601 datetime"
}
```

**Errors:**
- `404` — lesson không tồn tại

---

### PUT /api/lessons/[id]/notes
Lưu ghi chú cho bài học. Hoạt động như upsert (tạo mới nếu chưa có, cập nhật nếu đã có).

**Request:**
```json
{
  "notes": "string"
}
```

> Cho phép `notes` là chuỗi rỗng `""` (xóa trắng ghi chú). Không cho phép `null` hoặc thiếu field.

**Response 200:**
```json
{
  "id": "string",
  "notes": "string",
  "updatedAt": "ISO 8601 datetime"
}
```

**Errors:**
- `400` — field `notes` bị thiếu hoặc không phải string
- `404` — lesson không tồn tại
- `500` — lỗi DB

---

### GET /api/courses/[id]/notes/search?q=keyword
Tìm kiếm ghi chú theo từ khóa trong tất cả bài học của khóa học.

**Query params:**
- `q` (bắt buộc): từ khóa tìm kiếm, tối thiểu 1 ký tự sau khi trim

**Response 200:**
```json
{
  "query": "string",
  "results": [
    {
      "lessonId": "string",
      "lessonTitle": "string",
      "lessonOrder": "number",
      "snippet": "string",
      "updatedAt": "ISO 8601 datetime"
    }
  ]
}
```

> `snippet`: đoạn trích 100 ký tự xung quanh vị trí tìm thấy từ khóa đầu tiên. Từ khóa trong snippet không được highlight ở phía server (việc highlight là trách nhiệm của client).
>
> Kết quả được sắp xếp theo `lessonOrder` tăng dần.

**Errors:**
- `400` — `q` bị thiếu hoặc là chuỗi rỗng sau trim
- `404` — course không tồn tại

## Data Model Changes

Thêm field `notes` vào model `Lesson` trong `prisma/schema.prisma`:

```prisma
model Lesson {
  id           String   @id @default(cuid())
  courseId     String
  course       Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title        String
  order        Int
  transcript   String?
  summary      String?
  explanation  String?
  quiz         String?
  flashcards   String?
  exercises    String?
  notes        String?   // Ghi chú cá nhân của học viên, định dạng Markdown
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

> `notes` là `String?` (nullable) để nhất quán với các field AI-generated khác (`summary`, `explanation`, `quiz`, `flashcards`, `exercises`). Giá trị `null` nghĩa là bài học chưa có ghi chú nào.

**Migration:** Chạy `npx prisma db push` sau khi cập nhật schema.

**Lưu ý:**
- Không tạo bảng `LessonNote` riêng. Toàn bộ nội dung ghi chú lưu trực tiếp trong cột `notes` của bảng `Lesson`.
- Tìm kiếm được thực hiện bằng SQLite `LIKE '%keyword%'` trên cột `notes`. Với dataset nhỏ (SQLite single-user), đây đủ hiệu năng.
- `updatedAt` của `Lesson` tự cập nhật mỗi lần ghi chú được lưu (vì là field trên cùng model).

## UI Notes

- **Vị trí tab:** Tab "Ghi chú" nằm trong `AIAssistantPanel`, thứ tự đề xuất: Summary | Explain | Chat | Roadmap | Practice | **Ghi chú**
- **Layout editor:**
  - Toolbar phía trên: **B**, *I*, H1, `code`, danh sách (unordered), blockquote
  - Nút toggle "Chỉnh sửa / Xem trước" ở góc phải toolbar
  - `textarea` hoặc controlled `div[contenteditable]` chiếm phần lớn không gian còn lại
  - Status bar phía dưới editor: hiển thị trạng thái lưu ("Đang lưu...", "Đã lưu lúc HH:mm", "Lưu thất bại")
- **Placeholder text khi chưa có ghi chú:** "Bắt đầu ghi chú của bạn... Hỗ trợ Markdown."
- **Thanh tìm kiếm:**
  - Nằm phía trên editor, có thể collapse bằng nút toggle (icon kính lúp)
  - Input debounce 300ms trước khi gọi API tìm kiếm
  - Kết quả hiển thị dạng dropdown hoặc panel con bên dưới input
  - Mỗi kết quả: tên bài học + snippet + thời gian chỉnh sửa
- **Nút "Chèn vào ghi chú" trong tab Chat:**
  - Icon nhỏ nằm ở góc dưới phải mỗi bubble AI response
  - Hover tooltip: "Chèn đoạn này vào Ghi chú"
  - Click → chèn text + dòng trích dẫn vào cuối nội dung hiện có trong editor ghi chú (ngay cả khi tab Ghi chú không đang active)
- **Chế độ Xem trước (Preview):**
  - Render Markdown thành HTML với style cơ bản (heading có font-weight, code block có background, blockquote có border trái)
  - Link mở tab mới (`target="_blank"`)
  - Ảnh URL: `max-width: 100%` để không tràn layout
  - Table: `overflow-x: auto` để scroll ngang khi cần
- **Responsive:** Editor và preview đều hoạt động ở cả desktop (panel rộng) và layout hẹp hơn
