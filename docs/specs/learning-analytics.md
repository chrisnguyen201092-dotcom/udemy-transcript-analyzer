# Spec: Learning Analytics Dashboard

## Goal

Cung cấp cho học viên cái nhìn tổng quan về tiến trình học tập thông qua các chỉ số đo lường được: tỉ lệ hoàn thành, hiệu suất quiz, mức độ ghi nhớ flashcard, thói quen học tập theo thời gian. Dashboard giúp học viên nhận ra điểm yếu, duy trì động lực và hiểu rõ mức độ đầu tư thời gian vào từng khóa học.

Module này **chỉ đọc và tổng hợp** dữ liệu từ các bảng hiện có: `LessonProgress`, `FlashcardReview`, `CourseProgress`. Không có bảng mới.

---

## User Stories

**US-1 — Xem tổng quan toàn bộ:**
Là học viên, tôi muốn xem tất cả các chỉ số học tập trên một trang duy nhất để nhanh chóng đánh giá tình trạng học tập của mình.

**US-2 — Phân tích chi tiết theo khóa học:**
Là học viên, tôi muốn xem chỉ số riêng cho từng khóa học để so sánh hiệu quả học tập và xác định khóa nào đang bị bỏ lơ.

**US-3 — Theo dõi streak:**
Là học viên, tôi muốn thấy streak hiện tại và lịch sử streak dưới dạng heatmap để duy trì thói quen học tập đều đặn.

**US-4 — Nhận diện điểm yếu flashcard:**
Là học viên, tôi muốn biết tỉ lệ thẻ đã thuộc so với thẻ cần ôn lại hôm nay để ưu tiên ôn đúng chỗ.

**US-5 — Đánh giá đầu tư thời gian:**
Là học viên, tôi muốn biết tổng thời gian đã học và phân bổ theo từng bài học để hiểu mình đang dành thời gian vào đâu.

**US-6 — Theo dõi xu hướng quiz:**
Là học viên, tôi muốn thấy điểm quiz theo thời gian (tăng hay giảm) để đánh giá mức độ tiến bộ.

---

## Acceptance Criteria

**Overview page (`/dashboard/analytics` hoặc panel Analytics):**

- [ ] Hiển thị 6 card chỉ số: Completion Rate, Total Time, Quiz Average, Flashcard Retention, Current Streak, Lessons Today
- [ ] Mỗi card có: số liệu chính + mini visualization (bar, số đếm ngày, hoặc text)
- [ ] Khi chưa có dữ liệu, mỗi card hiển thị empty state riêng với gợi ý hành động
- [ ] Tải dữ liệu từ `GET /api/analytics/overview`
- [ ] Thời gian load < 2 giây trên SQLite local

**Course detail (`/dashboard/course/[id]/analytics`):**

- [ ] Hiển thị breakdown từng bài học: tên, thời gian, điểm quiz (nếu có), số flashcard đã thuộc
- [ ] Biểu đồ phân bổ điểm quiz (histogram 5 bins: 0-20, 21-40, 41-60, 61-80, 81-100)
- [ ] Timeline hoàn thành các bài học (ngày hoàn thành hiển thị theo thứ tự)
- [ ] Tải dữ liệu từ `GET /api/analytics/course/[id]`

**Heatmap học tập:**

- [ ] Hiển thị 52 tuần gần nhất (tương tự GitHub contribution graph)
- [ ] Mỗi ô = 1 ngày, màu sắc theo số bài học hoàn thành (0, 1-2, 3-5, 6+)
- [ ] Hover tooltip: ngày + số bài đã học

**Streak:**

- [ ] Current streak tính liên tục từ hôm nay trở về trước (chuỗi ngày liên tiếp có ít nhất 1 bài học hoàn thành)
- [ ] Longest streak tính toàn bộ lịch sử
- [ ] Nếu hôm nay chưa học, streak vẫn hiển thị đúng (không trừ sớm)

---

## Edge Cases

| Tình huống | Xử lý |
|---|---|
| Chưa có dữ liệu gì | Tất cả card hiển thị empty state với text gợi ý học bài đầu tiên |
| Chỉ 1 khóa, 1 bài, chưa hoàn thành | Overview hiển thị 0%, detail hiển thị bài học chưa hoàn thành |
| Tất cả bài đã hoàn thành 100% | Completion rate = 100%, hiển thị badge/icon đặc biệt |
| Flashcard bị regenerate (orphaned reviews) | Bỏ qua `FlashcardReview` không còn liên kết `Flashcard` hợp lệ; không crash |
| Thời gian học 1 bài > 24 giờ | Cap hiển thị ở "24h+" thay vì số thực tế (tránh dữ liệu bẩn từ tab bị mở quên) |
| Khóa học bị xóa, `CourseProgress` còn lại | Không hiển thị trong course list; không tính vào overview nếu course không tồn tại |
| Bài học bị xóa, `LessonProgress` còn lại | Bỏ qua trong tính toán; không crash API |
| Điểm quiz = null (bài không có quiz) | Bài đó không tính vào Quiz Average; ghi chú "Không có quiz" trong breakdown |
| Người dùng chưa dùng flashcard | Retention rate hiển thị empty state riêng, không hiển thị 0% gây hiểu nhầm |

---

## API Contract

### `GET /api/analytics/overview`

**Response 200:**
```json
{
  "totalCourses": 3,
  "totalLessonsCompleted": 42,
  "totalTimeSeconds": 18600,
  "averageQuizScore": 78.5,
  "overallRetentionRate": 65.2,
  "currentStreak": 5,
  "longestStreak": 12,
  "studyFrequency": [
    { "date": "2026-03-01", "lessonsCompleted": 3 },
    { "date": "2026-03-02", "lessonsCompleted": 0 }
  ]
}
```

**Ghi chú:**
- `studyFrequency`: 365 ngày gần nhất, mỗi ngày có `date` (ISO 8601) và `lessonsCompleted`
- `averageQuizScore`: null nếu chưa có quiz nào
- `overallRetentionRate`: null nếu chưa có flashcard review nào
- `totalTimeSeconds`: 0 nếu chưa học; không bao giờ null

---

### `GET /api/analytics/course/[id]`

**Params:** `id` — courseId (string)

**Response 200:**
```json
{
  "courseId": "clx...",
  "courseName": "Python for Beginners",
  "completionRate": 66.7,
  "totalTimeSeconds": 7200,
  "averageQuizScore": 82.0,
  "lessons": [
    {
      "lessonId": "cly...",
      "title": "Bài 1: Giới thiệu",
      "completed": true,
      "timeSeconds": 1800,
      "quizScore": 90,
      "flashcardsMastered": 8,
      "flashcardsTotal": 10,
      "completedAt": "2026-03-15T10:30:00Z"
    }
  ],
  "quizScoreDistribution": [
    { "bin": "0-20", "count": 0 },
    { "bin": "21-40", "count": 1 },
    { "bin": "41-60", "count": 2 },
    { "bin": "61-80", "count": 5 },
    { "bin": "81-100", "count": 8 }
  ],
  "retentionRate": 72.0,
  "masteredCardCount": 36,
  "dueCardCount": 5,
  "averageEaseFactor": 2.3
}
```

**Response 404:**
```json
{ "error": "Course not found" }
```

**Ghi chú:**
- `quizScore` trong lesson: null nếu bài không có quiz
- `flashcardsMastered`: số thẻ có `interval > 7` (đơn vị ngày trong SRS)
- `averageEaseFactor`: null nếu chưa có review nào
- `completedAt`: null nếu bài chưa hoàn thành

---

## Data Model Changes

**Không có bảng mới.** Tất cả chỉ số được tính toán động từ các bảng hiện có:

| Chỉ số | Bảng nguồn | Công thức |
|---|---|---|
| Completion Rate | `LessonProgress`, `CourseProgress` | `completedLessons / totalLessons × 100` |
| Time Investment | `LessonProgress` | `SUM(timeSpentSeconds)` |
| Quiz Average | `LessonProgress` | `AVG(quizScore) WHERE quizScore IS NOT NULL` |
| Flashcard Retention | `FlashcardReview` | `COUNT(interval > 7) / COUNT(*) × 100` |
| Average EF | `FlashcardReview` | `AVG(easeFactor)` |
| Current Streak | `LessonProgress` | Tính chuỗi ngày liên tiếp có `completed = true`, đếm ngược từ hôm nay |
| Longest Streak | `LessonProgress` | Max chuỗi liên tiếp trong toàn bộ lịch sử |
| Study Frequency | `LessonProgress` | `GROUP BY DATE(completedAt)` |

**Index khuyến nghị** (thêm vào schema nếu query chậm):
- `LessonProgress.completedAt` — dùng cho streak và heatmap
- `FlashcardReview.interval` — dùng cho retention rate
- `FlashcardReview.flashcardId` — dùng cho join/filter orphaned records

---

## UI Notes

**Layout tổng quan:**
- Grid 3 cột trên desktop, 2 cột trên tablet, 1 cột trên mobile
- Mỗi metric = 1 card: số liệu lớn ở trên, mini visualization ở dưới
- Màu sắc card neutral; accent color chỉ dùng cho số liệu chính

**Visualization nhẹ (không dùng chart library nặng):**
- Bar đơn giản: `div` với `width: X%` và Tailwind `bg-primary`
- Heatmap streak: grid 52×7 `div` nhỏ, màu từ `bg-muted` đến `bg-primary`
- Histogram: 5 `div` cao thấp theo tỉ lệ, label text nhỏ bên dưới
- Trend quiz: sparkline đơn giản dùng SVG polyline (không cần D3)

**Empty states:**
- Mỗi card có empty state riêng biệt, không hiển thị "0" hay "N/A" trơ
- Ví dụ: Streak card khi chưa có dữ liệu: "Bắt đầu học hôm nay để tạo streak đầu tiên!"
- Icon nhỏ + text ngắn + nút CTA dẫn đến khóa học

**Course detail:**
- Bảng bài học với cột: STT, Tên bài, Thời gian, Quiz, Flashcard, Trạng thái
- Highlight bài có quiz thấp (< 60) bằng màu warning
- Collapse được nếu khóa có > 20 bài (hiện 10 bài đầu, nút "Xem thêm")

**Dependency:** Module này yêu cầu `progress-tracking` (1.1) và `srs-scheduler` (1.2) đã được triển khai đầy đủ.
