# Spec: Book Schema — Content Type & Metadata (B-01, B-02, B-03)

## Goal

Mở rộng schema Prisma để phân biệt "khóa học" với "sách/giáo trình", đồng thời lưu metadata đặc thù cho sách. Migration không phá vỡ dữ liệu hiện có: mọi record Course cũ tự động nhận `contentType = "course"`, mọi field mới đều nullable hoặc có default.

## User Stories

- Là học viên, tôi muốn hệ thống biết đây là sách hay khóa học để hiển thị đúng nhãn ("Chương" thay vì "Bài học")
- Là học viên, tôi muốn xem tên tác giả và ISBN của sách đang đọc trong ứng dụng
- Là học viên, tôi muốn mỗi chương sách lưu số chương và phạm vi trang để dễ tham chiếu

## Acceptance Criteria

- [ ] Model `Course` có field `contentType String @default("course")` — giá trị hợp lệ: `"course"` hoặc `"book"`
- [ ] Model `Course` có các field nullable: `author String?`, `isbn String?`, `publisher String?`
- [ ] Model `Lesson` có các field nullable: `chapterNumber Int?`, `pageRange String?`
- [ ] Chạy `npx prisma db push` thành công không có lỗi migration conflict
- [ ] Tất cả Course record hiện có vẫn truy vấn được, `contentType` tự động là `"course"`
- [ ] `GET /api/courses` trả về `contentType`, `author`, `isbn`, `publisher` trong response
- [ ] `POST /api/courses` chấp nhận và lưu được `contentType`, `author`, `isbn`, `publisher`
- [ ] `GET /api/courses/[id]/lessons` (hoặc tương đương) trả về `chapterNumber`, `pageRange` trong từng lesson
- [ ] `POST /api/courses/[id]/lessons` chấp nhận và lưu được `chapterNumber`, `pageRange`
- [ ] Các field book-specific không làm vỡ UI hiện tại khi `contentType === "course"` (giá trị null được bỏ qua)

## Edge Cases

- `contentType` có giá trị ngoài `"course"` | `"book"` (ví dụ `"podcast"`) — server trả `400 Bad Request`, không lưu vào DB; validation bằng Zod enum
- Sách không có `author` — hoàn toàn hợp lệ, field nullable; UI không hiển thị section author nếu null
- `chapterNumber` không theo thứ tự liên tiếp (ví dụ chương 1, 3, 7) — cho phép; không validate sequential; thứ tự hiển thị theo field `order` như hiện tại
- `isbn` sai định dạng (không đủ 10/13 chữ số) — spec này không validate ISBN format; validation ISBN để scope riêng
- Upload sách tạo Course mới mà không truyền `contentType` — server default về `"course"`; phía upload book flow (B-08) phải tự set `"book"` khi tạo
- `pageRange` định dạng tự do (ví dụ `"12-45"`, `"p.12 - p.45"`, `"45"`) — lưu dạng string, không parse; client render nguyên văn

## API Contract

### GET /api/courses

**Response 200** (thêm các fields mới vào mỗi course object):
```json
[
  {
    "id": "string",
    "url": "string | null",
    "title": "string",
    "contentType": "course | book",
    "author": "string | null",
    "isbn": "string | null",
    "publisher": "string | null",
    "roadmap": "string | null",
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

### POST /api/courses

**Request** (thêm fields tùy chọn):
```json
{
  "url": "string (optional)",
  "title": "string (required)",
  "contentType": "course | book (optional, default: \"course\")",
  "author": "string (optional)",
  "isbn": "string (optional)",
  "publisher": "string (optional)"
}
```

**Errors:**
- `400` — `contentType` không phải `"course"` hoặc `"book"`

### POST /api/courses/[id]/lessons

**Request** (thêm fields tùy chọn):
```json
{
  "title": "string (required)",
  "order": "number (required)",
  "transcript": "string (optional)",
  "chapterNumber": "number (optional)",
  "pageRange": "string (optional)"
}
```

**Response 201:**
```json
{
  "id": "string",
  "title": "string",
  "order": "number",
  "chapterNumber": "number | null",
  "pageRange": "string | null"
}
```

> Không có endpoint chuyên dụng mới. Các endpoint CRUD hiện có mở rộng để nhận và trả về các field mới. Zod schema validation phải được cập nhật tương ứng.

## Data Model Changes

### Diff Prisma schema

```prisma
model Course {
  id             String           @id @default(cuid())
  url            String?          @unique
  title          String
+ contentType    String           @default("course")
+ author         String?
+ isbn           String?
+ publisher      String?
  roadmap        String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  lessons        Lesson[]
  progress       CourseProgress?
  learnerProfile LearnerProfile?
}

model Lesson {
  id               String             @id @default(cuid())
  courseId          String
  course           Course             @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title            String
  order            Int
  transcript       String?
+ chapterNumber    Int?
+ pageRange        String?
  summary          String?
  explanation      String?
  quiz             String?
  flashcards       String?
  exercises        String?
  notes            String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  progress         LessonProgress?
  flashcardReviews FlashcardReview[]
  chatMessages     ChatMessage[]
}
```

### Chiến lược migration

Migration **non-breaking, backward compatible**:

1. `contentType String @default("course")` — SQLite tự điền `"course"` cho toàn bộ row hiện có
2. `author`, `isbn`, `publisher` — nullable, không có default; row cũ tự động có `NULL`
3. `chapterNumber`, `pageRange` — nullable, không có default; row cũ tự động có `NULL`

**Lệnh apply:**
```bash
npx prisma db push
```

Không cần migration file riêng cho môi trường dev. Production nên dùng `prisma migrate deploy` với migration file được commit vào repo.

**Không cần:**
- Data backfill
- Downtime
- Thay đổi bất kỳ query nào đang dùng Course/Lesson (Prisma trả về null cho field mới nếu không select)

## UI Notes

- Spec này **không** định nghĩa UI thay đổi — phần đó thuộc B-13, B-14, B-15, B-16
- Tuy nhiên: TypeScript types (`Course`, `Lesson`) sinh ra từ Prisma client sẽ có field mới; components cần cập nhật prop types khi dùng
- Field `contentType` sẽ là source of truth cho conditional rendering trong toàn bộ app
- Khi `contentType === "book"`: hiển thị `author`, `isbn`, `publisher`; label "Chương" thay vì "Bài học"
- Khi `contentType === "course"`: bỏ qua các field book-specific (null)
