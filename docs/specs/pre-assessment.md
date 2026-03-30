# Spec: Pre-Assessment / Hồ Sơ Học Viên

## Goal

Cho phép người dùng khai báo trình độ, mục tiêu, thời gian và phong cách học trước khi bắt đầu lộ trình của một khóa học. Dữ liệu này được inject vào các AI prompt (Roadmap, Explain) để cá nhân hóa nội dung thực sự, thay vì chỉ dựa vào nội dung khóa học.

Profiling là **tùy chọn** nhưng được khuyến khích. Người dùng có thể bỏ qua và dùng Roadmap bình thường (chỉ ít cá nhân hóa hơn).

---

## User Stories

1. **Khai báo hồ sơ lần đầu**
   Khi tôi mở tab Roadmap của một khóa học lần đầu tiên mà chưa có hồ sơ, một modal hiện ra hỏi 5 câu về trình độ và mục tiêu của tôi, để lộ trình được tạo ra phù hợp với tôi hơn.

2. **Bỏ qua profiling**
   Khi tôi không muốn khai báo, tôi có thể đóng modal hoặc nhấn "Bỏ qua" mà không ảnh hưởng đến chức năng Roadmap (chỉ kém cá nhân hóa hơn).

3. **Cập nhật hồ sơ**
   Khi mục tiêu hoặc trình độ của tôi thay đổi, tôi nhấn "Cập nhật hồ sơ" trong tab Roadmap để mở lại modal và chỉnh sửa.

4. **Đánh dấu chủ đề đã biết**
   Khi tôi đã biết một số phần của khóa học, tôi tích chọn các chủ đề tương ứng để Roadmap bỏ qua hoặc tóm tắt nhanh các phần đó.

5. **Hồ sơ ảnh hưởng đến Explain**
   Khi tôi dùng tính năng Explain và đã có hồ sơ, độ sâu giải thích được tự động điều chỉnh theo trình độ (beginner nhận giải thích đơn giản hơn, advanced nhận giải thích súc tích hơn).

6. **Tái tạo Roadmap sau khi cập nhật**
   Khi tôi cập nhật hồ sơ, hệ thống hỏi tôi có muốn tạo lại Roadmap ngay không.

---

## Acceptance Criteria

### Modal Profiling

- [ ] Modal tự động hiện khi: tab Roadmap mở lần đầu cho khóa học chưa có `LearnerProfile`
- [ ] Modal mở khi nhấn nút "Cập nhật hồ sơ" trong Roadmap tab (nút chỉ hiện khi profile đã tồn tại)
- [ ] Modal có 5 câu hỏi theo đúng thứ tự, điều hướng Next/Back
- [ ] Câu hỏi 4 (chủ đề đã biết) là danh sách động lấy từ tiêu đề bài học của khóa học
- [ ] Nút "Bỏ qua" đóng modal mà không lưu, Roadmap vẫn hoạt động bình thường
- [ ] Sau khi submit, `LearnerProfile` được tạo hoặc cập nhật thành công
- [ ] Sau khi cập nhật (PUT), hệ thống hiển thị prompt hỏi "Tạo lại Roadmap với hồ sơ mới?"

### API

- [ ] `POST /api/courses/[id]/profile` tạo mới profile, trả 201
- [ ] `GET /api/courses/[id]/profile` trả profile hiện có, 404 nếu chưa có
- [ ] `PUT /api/courses/[id]/profile` cập nhật profile, trả 200
- [ ] Tất cả endpoint validate body bằng Zod
- [ ] Nếu `courseId` không tồn tại, trả 404
- [ ] `knownTopics` được lưu dạng JSON string, trả về dạng mảng string

### Tích hợp AI

- [ ] Khi có `LearnerProfile`, prompt Roadmap nhận thêm section "Learner Context" với đầy đủ thông tin hồ sơ
- [ ] Khi không có `LearnerProfile`, prompt Roadmap vẫn chạy bình thường (không có section Learner Context)
- [ ] Khi có `LearnerProfile`, tính năng Explain tự động chọn độ sâu dựa trên `level`

### Ràng buộc dữ liệu

- [ ] Mỗi khóa học chỉ có tối đa 1 `LearnerProfile` (`@@unique([courseId])`)
- [ ] `level` chỉ nhận: `beginner`, `intermediate`, `advanced`
- [ ] `goal` chỉ nhận: `career_change`, `skill_upgrade`, `hobby`, `exam_prep`
- [ ] `learningStyle` chỉ nhận: `theory_first`, `hands_on`, `mixed`
- [ ] `dailyTimeMin` chỉ nhận: `30`, `60`, `120`

---

## Edge Cases

| Tình huống | Xử lý |
|---|---|
| Khóa học chưa có bài học nào | Câu hỏi 4 (chủ đề đã biết) ẩn hoặc hiển thị thông báo "Chưa có bài học nào để chọn", cho phép tiếp tục |
| Người dùng đánh dấu tất cả chủ đề là đã biết | Lưu bình thường, prompt AI sẽ nhận tín hiệu này và tạo lộ trình review nhanh |
| Người dùng bỏ qua profiling | `LearnerProfile` không được tạo, roadmap và explain dùng default behavior |
| Khóa học bị xóa | `LearnerProfile` bị xóa cascade theo `onDelete: Cascade` |
| Cập nhật profile nhưng không tạo lại roadmap | Profile vẫn được lưu, roadmap cũ vẫn hiển thị cho đến khi người dùng tạo lại thủ công |
| Submit form thiếu trường bắt buộc | Validation Zod trả lỗi 400 với message rõ ràng từng trường |
| `knownTopics` là mảng rỗng | Hợp lệ, lưu `null` hoặc `"[]"` |

---

## API Contract

### `POST /api/courses/[id]/profile`

**Request body:**
```json
{
  "level": "beginner | intermediate | advanced",
  "goal": "career_change | skill_upgrade | hobby | exam_prep",
  "dailyTimeMin": 30 | 60 | 120,
  "knownTopics": ["Giới thiệu HTML", "CSS cơ bản"],
  "learningStyle": "theory_first | hands_on | mixed"
}
```

**Response 201:**
```json
{
  "id": "cuid...",
  "courseId": "cuid...",
  "level": "beginner",
  "goal": "career_change",
  "dailyTimeMin": 60,
  "knownTopics": ["Giới thiệu HTML"],
  "learningStyle": "hands_on",
  "createdAt": "2026-03-30T00:00:00.000Z",
  "updatedAt": "2026-03-30T00:00:00.000Z"
}
```

**Response 409:** Profile đã tồn tại (dùng PUT để cập nhật)

---

### `GET /api/courses/[id]/profile`

**Response 200:** Object profile (cùng schema như trên)

**Response 404:**
```json
{ "error": "Profile not found" }
```

---

### `PUT /api/courses/[id]/profile`

**Request body:** Tương tự POST (toàn bộ object, không phải partial)

**Response 200:** Object profile đã cập nhật

**Response 404:** Course hoặc profile không tồn tại

---

## Data Model Changes

Thêm model vào `prisma/schema.prisma`:

```prisma
model LearnerProfile {
  id              String   @id @default(cuid())
  courseId        String
  course          Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  level           String   // beginner | intermediate | advanced
  goal            String   // career_change | skill_upgrade | hobby | exam_prep
  dailyTimeMin    Int      // minutes per day available for study
  knownTopics     String?  // JSON array of topic strings
  learningStyle   String   // theory_first | hands_on | mixed
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([courseId])
}
```

Thêm relation ngược vào model `Course`:
```prisma
learnerProfile  LearnerProfile?
```

Sau khi thay đổi schema: chạy `npx prisma db push`.

---

## UI Notes

### Trigger hiển thị modal

1. Người dùng mở tab Roadmap lần đầu cho khóa học chưa có `LearnerProfile` (GET 404)
2. Người dùng nhấn nút "Cập nhật hồ sơ" trong Roadmap tab

### Cấu trúc modal

- **Header:** "Hãy cho chúng tôi biết về bạn" + tên khóa học
- **Progress indicator:** Câu 1/5 ... 5/5
- **Nút điều hướng:** "Quay lại" / "Tiếp theo" / "Hoàn tất"
- **Nút bỏ qua:** Luôn hiển thị ở góc trên phải, đóng modal không lưu

### 5 câu hỏi

| # | Câu hỏi | Loại | Giá trị lưu |
|---|---|---|---|
| 1 | Trình độ hiện tại của bạn? | Radio | `beginner` / `intermediate` / `advanced` |
| 2 | Mục tiêu học? | Radio | `career_change` / `skill_upgrade` / `hobby` / `exam_prep` |
| 3 | Thời gian học mỗi ngày? | Radio | `30` / `60` / `120` (phút) |
| 4 | Kiến thức đã biết? | Checklist | Mảng string từ tiêu đề bài học |
| 5 | Phong cách học ưa thích? | Radio | `theory_first` / `hands_on` / `mixed` |

**Label hiển thị cho câu 3:** "30 phút" / "1 giờ" / "2 giờ+"

**Label hiển thị cho câu 4:** Lấy từ `lesson.title` của khóa học, mỗi mục là 1 checkbox. Nếu không có bài học, ẩn bước này và tự động chuyển sang bước 5.

### Sau khi hoàn tất

- Toast thông báo "Đã lưu hồ sơ học viên"
- Nếu là **tạo mới**: tự động trigger tạo Roadmap ngay
- Nếu là **cập nhật**: hiện dialog xác nhận "Tạo lại Roadmap với hồ sơ mới?" với 2 nút "Tạo lại" / "Giữ Roadmap cũ"

### Nút "Cập nhật hồ sơ"

- Vị trí: header của Roadmap tab, bên cạnh nút "Tạo Roadmap"
- Chỉ hiển thị khi `LearnerProfile` tồn tại
- Icon: bút chỉnh sửa
