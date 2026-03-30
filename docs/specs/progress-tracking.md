# Spec: Progress Tracking (Theo dõi tiến độ học tập)

## Goal

Theo dõi tiến độ học tập của người dùng ở cấp độ bài học và khóa học. Ghi nhận bài học đã hoàn thành, thời gian học, điểm quiz, mức độ thành thạo flashcard, và chuỗi ngày học liên tiếp (streak). Hiển thị tiến độ trực quan để người dùng biết mình đang ở đâu và động lực tiếp tục.

---

## User Stories

- Là học viên, tôi muốn thấy bài học nào đã hoàn thành để biết mình đang học đến đâu trong khóa học
- Là học viên, tôi muốn xem phần trăm tiến độ tổng thể của khóa học để ước tính còn bao nhiêu nội dung cần học
- Là học viên, tôi muốn biết chuỗi ngày học liên tiếp (streak) của mình để duy trì thói quen học mỗi ngày
- Là học viên, tôi muốn có thể tự đánh dấu bài học là đã hoàn thành ngay cả khi chưa làm quiz, để linh hoạt trong cách học của mình
- Là học viên, tôi muốn ứng dụng tự động đánh dấu bài học hoàn thành khi tôi đã xem summary, explain, và đạt điểm quiz đủ ngưỡng

---

## Acceptance Criteria

### Hoàn thành bài học tự động
- [ ] Bài học được tự động đánh dấu `completed = true` khi người dùng đã xem summary, xem explain, **và** đạt điểm quiz >= 70%
- [ ] Khi bài học được đánh dấu hoàn thành, `completedAt` được ghi nhận theo thời điểm hiện tại
- [ ] Điểm quiz được lưu vào `LessonProgress.quizScore` sau mỗi lần làm quiz
- [ ] Số flashcard đã thành thạo (`flashcardsMastered`) và tổng số flashcard (`flashcardsTotal`) được cập nhật sau mỗi phiên flashcard

### Hoàn thành bài học thủ công
- [ ] Người dùng có thể nhấn nút "Đánh dấu hoàn thành" để chuyển `completed = true` bất kể điều kiện tự động
- [ ] Người dùng có thể bỏ đánh dấu hoàn thành bằng cách nhấn lại nút (toggle)
- [ ] Thao tác thủ công gọi `POST /api/lessons/[id]/progress` với `completed: true/false`

### Thời gian học
- [ ] Thời gian học (`timeSpentMs`) được cộng dồn qua `PATCH /api/lessons/[id]/progress` mỗi khi phiên học kết thúc hoặc người dùng chuyển bài
- [ ] Thời gian học không bao giờ bị ghi đè về 0 khi dùng PATCH (chỉ cộng thêm `deltaMs`)

### Tiến độ khóa học
- [ ] `CourseProgress.completionPct` = (số bài `completed = true`) / (tổng số bài học của khóa) * 100, làm tròn 1 chữ số thập phân
- [ ] `GET /api/courses/[id]/progress` trả về `completionPct`, `currentStreak`, `longestStreak`, `lastStudiedAt`, `totalTimeSpentMs`, và mảng `lessonsProgress` cho từng bài
- [ ] `totalTimeSpentMs` của CourseProgress = tổng `timeSpentMs` của tất cả LessonProgress thuộc khóa đó

### Streak
- [ ] `currentStreak` tăng thêm 1 nếu `lastStudiedAt` của CourseProgress là trong ngày hôm qua (theo múi giờ server UTC)
- [ ] `currentStreak` đặt về 1 nếu khoảng cách từ `lastStudiedAt` đến hôm nay > 1 ngày
- [ ] `currentStreak` giữ nguyên nếu người dùng học nhiều lần trong cùng một ngày
- [ ] `longestStreak` = max(`longestStreak` hiện tại, `currentStreak` sau khi cập nhật)
- [ ] `lastStudiedAt` cập nhật mỗi khi có bất kỳ hoạt động nào trên bài học thuộc khóa đó

### UI
- [ ] Bài học đã hoàn thành hiển thị biểu tượng checkmark (màu xanh) trong `LessonList`
- [ ] Bài học chưa hoàn thành không có checkmark (hoặc hiển thị vòng tròn rỗng)
- [ ] Thẻ khóa học trong `CourseList` hiển thị thanh tiến độ (progress bar) với phần trăm số bài đã hoàn thành
- [ ] Streak counter hiển thị trong header hoặc phần chi tiết khóa học (ví dụ: "🔥 5 ngày liên tiếp")

---

## Edge Cases

- **Bài học đầu tiên hoàn thành:** Tạo mới bản ghi `LessonProgress` và `CourseProgress` nếu chưa tồn tại; streak bắt đầu từ 1
- **Streak reset sau khi bỏ ngày:** Nếu hôm nay là thứ Tư và `lastStudiedAt` là thứ Hai, `currentStreak` đặt về 1 (không cộng tiếp chuỗi cũ)
- **Học cùng ngày nhiều lần:** Streak không tăng thêm, chỉ cập nhật `lastStudiedAt` và tổng thời gian
- **Khóa học đạt 100%:** `completionPct = 100.0`, UI có thể hiển thị trạng thái đặc biệt "Hoàn thành khóa học"
- **Bài học bị xóa sau khi đã có progress:** `onDelete: Cascade` trên `LessonProgress` tự xóa record; `completionPct` của khóa sẽ được tính lại lần truy vấn tiếp theo
- **Concurrent updates (nhiều tab):** `PATCH /api/lessons/[id]/progress` dùng prisma `increment` để cộng `timeSpentMs` (tránh race condition ghi đè)
- **Múi giờ streak:** Server tính streak theo UTC. Không hỗ trợ múi giờ người dùng (single-user local app, đơn giản hóa)
- **Quiz chưa từng làm:** `quizScore = null` (không phải 0), không ảnh hưởng đến điều kiện auto-complete cho đến khi người dùng nộp bài quiz lần đầu
- **Bài học không có transcript:** Không thể đạt auto-complete (vì không thể tạo quiz); người dùng vẫn có thể hoàn thành thủ công

---

## API Contract

### POST /api/lessons/[id]/progress
Đánh dấu hoàn thành bài học (thủ công hoặc từ auto-complete trigger), ghi nhận điểm quiz.

**Request body:**
```json
{
  "completed": true,
  "quizScore": 85.5
}
```
> `quizScore` là tùy chọn. `completed` là bắt buộc.

**Response 200:**
```json
{
  "lessonProgress": {
    "id": "string",
    "lessonId": "string",
    "completed": true,
    "completedAt": "2026-03-30T10:00:00.000Z",
    "quizScore": 85.5,
    "timeSpentMs": 0,
    "flashcardsMastered": 0,
    "flashcardsTotal": 0
  }
}
```

**Errors:**
- `404` — lesson không tồn tại
- `400` — body thiếu `completed`

---

### GET /api/courses/[id]/progress
Lấy tổng hợp tiến độ toàn khóa học.

**Response 200:**
```json
{
  "courseProgress": {
    "id": "string",
    "courseId": "string",
    "completionPct": 42.5,
    "currentStreak": 3,
    "longestStreak": 7,
    "lastStudiedAt": "2026-03-30T08:00:00.000Z",
    "totalTimeSpentMs": 7200000
  },
  "lessonsProgress": [
    {
      "lessonId": "string",
      "completed": true,
      "completedAt": "2026-03-29T10:00:00.000Z",
      "quizScore": 90.0,
      "timeSpentMs": 1800000,
      "flashcardsMastered": 15,
      "flashcardsTotal": 20
    }
  ]
}
```

**Errors:**
- `404` — course không tồn tại

---

### PATCH /api/lessons/[id]/progress
Cập nhật tiến độ một phần: cộng thêm thời gian học, cập nhật flashcard mastery. Cũng trigger cập nhật streak của CourseProgress.

**Request body:**
```json
{
  "deltaTimeMs": 300000,
  "flashcardsMastered": 8,
  "flashcardsTotal": 20
}
```
> Tất cả các trường đều tùy chọn. `deltaTimeMs` được **cộng vào** `timeSpentMs` hiện tại (không ghi đè).

**Response 200:**
```json
{
  "lessonProgress": {
    "id": "string",
    "lessonId": "string",
    "completed": false,
    "timeSpentMs": 600000,
    "flashcardsMastered": 8,
    "flashcardsTotal": 20
  }
}
```

**Errors:**
- `404` — lesson không tồn tại
- `400` — `deltaTimeMs` là số âm

---

## Data Model Changes

Thêm 2 model mới vào `prisma/schema.prisma`:

```prisma
model LessonProgress {
  id                 String    @id @default(cuid())
  lessonId           String
  lesson             Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completed          Boolean   @default(false)
  completedAt        DateTime?
  timeSpentMs        Int       @default(0)
  quizScore          Float?
  flashcardsMastered Int       @default(0)
  flashcardsTotal    Int       @default(0)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@unique([lessonId])
}

model CourseProgress {
  id               String    @id @default(cuid())
  courseId         String
  course           Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  completionPct    Float     @default(0)
  currentStreak    Int       @default(0)
  longestStreak    Int       @default(0)
  lastStudiedAt    DateTime?
  totalTimeSpentMs Int       @default(0)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@unique([courseId])
}
```

**Thay đổi trên model hiện có:**
- `Lesson`: thêm relation `progress LessonProgress?`
- `Course`: thêm relation `progress CourseProgress?`

Sau khi cập nhật schema, chạy:
```bash
npx prisma db push
```

---

## UI Notes

- **LessonList:** Mỗi item bài học hiển thị checkmark icon (ví dụ: `CheckCircle2` từ lucide-react, màu `text-green-500`) khi `completed = true`. Icon mờ hoặc vòng tròn rỗng khi chưa hoàn thành. Click vào icon để toggle thủ công.
- **CourseList:** Thẻ khóa học hiển thị `<Progress value={completionPct} />` (shadcn/ui) bên dưới tên khóa học, kèm text "X/Y bài" hoặc "42%".
- **Streak counter:** Hiển thị trong khu vực chi tiết khóa học hoặc phần header phụ: "🔥 3 ngày liên tiếp". Nếu `currentStreak = 0`, ẩn hoặc hiển thị "Chưa có streak".
- **Trạng thái 100%:** Khi `completionPct = 100`, progress bar đổi màu (ví dụ: `bg-green-500`) và có thể hiện badge "Đã hoàn thành".
- **Loading:** Các thao tác cập nhật progress nên dùng optimistic UI hoặc loading spinner nhỏ trên icon để không làm gián đoạn trải nghiệm.
