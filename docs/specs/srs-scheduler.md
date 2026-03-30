# Spec: SRS Scheduler (Spaced Repetition System)

## Goal

Tích hợp thuật toán SM-2 (SuperMemo 2) vào hệ thống flashcard hiện có, giúp học viên ôn tập đúng thời điểm — chỉ những thẻ sắp quên, không ôn lại những thẻ đã nhớ vững. Mục tiêu là tối ưu hóa thời gian học, tăng tỉ lệ ghi nhớ dài hạn.

---

## User Stories

**US-1 — Ôn tập hàng ngày**
Là học viên, tôi muốn mở ứng dụng mỗi sáng và thấy ngay danh sách thẻ cần ôn hôm nay, để không phải nhớ manual phải học gì.

**US-2 — Đánh giá mức độ nhớ**
Là học viên, khi xem mặt sau của thẻ, tôi muốn chọn một trong 3 mức ("Quên", "Khó", "Dễ"), để hệ thống biết lên lịch ôn lại khi nào.

**US-3 — Theo dõi tiến độ thành thạo**
Là học viên, tôi muốn thấy bao nhiêu thẻ đã "thành thạo" (interval >= 21 ngày) trong một bài học, để biết mình đã nắm chắc đến đâu.

**US-4 — Dashboard tổng hợp**
Là học viên, tôi muốn thấy tổng số thẻ cần ôn hôm nay trên tất cả bài học, nhóm theo từng bài, để lên kế hoạch học hiệu quả.

**US-5 — Khởi tạo lần đầu**
Là học viên, khi một bài học mới có flashcard, tôi muốn hệ thống tự khởi tạo lịch SRS cho tất cả thẻ, để bắt đầu ôn tập ngay mà không cần cấu hình thêm.

---

## Acceptance Criteria

### AC-1: Thuật toán SM-2

- [ ] Khi `quality >= 3`, interval tăng theo công thức: `rep=0 → 1 ngày`, `rep=1 → 6 ngày`, `rep>=2 → round(interval * EF)`
- [ ] Khi `quality < 3`, `repetitions` reset về 0, `interval` reset về 1
- [ ] `easinessFactor` sau mỗi lần: `max(1.3, EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))`
- [ ] `easinessFactor` không bao giờ thấp hơn 1.3
- [ ] `nextReviewAt` = `now() + interval days` (tính theo UTC)
- [ ] `totalReviews` tăng 1 sau mỗi lần review

### AC-2: API — Due cards

- [ ] `GET /api/lessons/[id]/srs/due` trả về tất cả thẻ có `nextReviewAt <= now()` của bài học đó
- [ ] Response bao gồm: `cardIndex`, `front`, `back`, `type`, `mnemonic`, `interval`, `repetitions`, `easinessFactor`
- [ ] Trả về mảng rỗng nếu không có thẻ nào đến hạn (không lỗi)
- [ ] Trả 404 nếu `lessonId` không tồn tại

### AC-3: API — Submit review

- [ ] `POST /api/lessons/[id]/srs/review` nhận `{ cardIndex, quality }` (quality: 0-5)
- [ ] Validate `quality` là integer trong [0, 5]; trả 400 nếu sai
- [ ] Tính lại SM-2 params và lưu vào DB
- [ ] Trả về params mới: `{ interval, repetitions, easinessFactor, nextReviewAt }`

### AC-4: API — Dashboard

- [ ] `GET /api/srs/dashboard` trả về danh sách bài học có thẻ due hôm nay
- [ ] Mỗi entry gồm: `lessonId`, `lessonTitle`, `dueCount`, `totalCards`, `masteredCount` (interval >= 21)
- [ ] Chỉ trả về bài học đã được khởi tạo SRS (có ít nhất 1 `FlashcardReview` record)

### AC-5: API — Init

- [ ] `POST /api/lessons/[id]/srs/init` tạo `FlashcardReview` cho từng card trong `lesson.flashcards.cards`
- [ ] Bỏ qua (skip) những `cardIndex` đã có record (idempotent)
- [ ] Trả về `{ created, skipped }` count
- [ ] Nếu lesson chưa có flashcard, trả 422 với message rõ ràng

### AC-6: UI — SRS Review Mode

- [ ] FlashcardDeck có mode "srs" chỉ hiển thị due cards
- [ ] Mỗi thẻ: mặt trước hiện trước, flip để xem mặt sau
- [ ] Sau khi flip, 3 nút xuất hiện: "Quên" (quality=1), "Khó" (quality=3), "Dễ" (quality=5)
- [ ] Sau khi chọn, gọi API review rồi tự chuyển thẻ tiếp theo
- [ ] Hiển thị "Còn lại: X thẻ" trong session
- [ ] Khi xong hết due cards: hiển thị màn hình "Hoàn thành!" với tóm tắt (số đúng, số quên, thẻ tiếp theo vào lúc nào)

---

## Edge Cases

**EC-1: Flashcard bị regenerate**
Khi AI tạo lại flashcard cho một bài, thứ tự card thay đổi nên `cardIndex` cũ không còn đúng. Hành vi: hệ thống KHÔNG tự xóa `FlashcardReview` cũ. Cần hiển thị cảnh báo "Flashcard đã được cập nhật, SRS data có thể không còn chính xác" và cho phép user reset SRS cho bài đó.

**EC-2: Chưa có flashcard**
Bài học chưa có flashcard thì không thể init SRS. `POST /api/lessons/[id]/srs/init` trả 422. Không hiển thị nút "Ôn SRS" trên UI.

**EC-3: Tất cả thẻ đã thành thạo**
`GET /api/lessons/[id]/srs/due` trả mảng rỗng. UI hiển thị: "Tuyệt vời! Không có thẻ nào cần ôn hôm nay. Thẻ tiếp theo: [date]."

**EC-4: Timezone**
`nextReviewAt` lưu và so sánh theo UTC. "Due today" = `nextReviewAt <= now()` (UTC). Không dùng "ngày theo local time" để tránh edge case sang ngày.

**EC-5: Lần đầu review (chưa init)**
Nếu user vào chế độ SRS mà chưa init, tự động gọi `POST /api/lessons/[id]/srs/init` trước, sau đó load due cards.

**EC-6: Lesson bị xóa**
`FlashcardReview` có `onDelete: Cascade` theo `Lesson`, nên xóa lesson sẽ xóa toàn bộ review history tương ứng.

**EC-7: EF tại giới hạn tối thiểu**
Nếu EF = 1.3 và quality = 0, công thức trả về giá trị âm nhưng `max(1.3, ...)` giữ nguyên 1.3. Test case cần cover trường hợp này.

**EC-8: quality = 2 (borderline)**
quality = 2 < 3, nên reset repetitions và interval = 1 dù gần đúng. Cần document rõ để tránh nhầm.

---

## API Contract

### `GET /api/lessons/[id]/srs/due`

**Response 200:**
```json
{
  "dueCards": [
    {
      "cardIndex": 0,
      "front": "What is React?",
      "back": "A JavaScript library for building UIs",
      "type": "definition",
      "mnemonic": "RE-act = React to events",
      "interval": 1,
      "repetitions": 0,
      "easinessFactor": 2.5,
      "lastQuality": 0
    }
  ],
  "totalDue": 5
}
```

---

### `POST /api/lessons/[id]/srs/review`

**Request body:**
```json
{
  "cardIndex": 0,
  "quality": 3
}
```

**Validation:**
- `cardIndex`: integer >= 0, bắt buộc
- `quality`: integer trong [0, 5], bắt buộc

**Response 200:**
```json
{
  "cardIndex": 0,
  "interval": 1,
  "repetitions": 1,
  "easinessFactor": 2.5,
  "nextReviewAt": "2026-03-31T00:00:00.000Z",
  "totalReviews": 1
}
```

**Response 400:**
```json
{ "error": "quality phải là số nguyên từ 0 đến 5" }
```

---

### `GET /api/srs/dashboard`

**Response 200:**
```json
{
  "totalDue": 12,
  "lessons": [
    {
      "lessonId": "clxxx",
      "lessonTitle": "React Hooks",
      "dueCount": 7,
      "totalCards": 20,
      "masteredCount": 5
    }
  ]
}
```

---

### `POST /api/lessons/[id]/srs/init`

**Response 200:**
```json
{
  "created": 15,
  "skipped": 0,
  "message": "Khởi tạo SRS thành công cho 15 thẻ"
}
```

**Response 422:**
```json
{ "error": "Bài học này chưa có flashcard. Hãy tạo flashcard trước." }
```

---

## Data Model Changes

Thêm model mới vào `prisma/schema.prisma`:

```prisma
model FlashcardReview {
  id             String   @id @default(cuid())
  lessonId       String
  lesson         Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  cardIndex      Int      // index trong flashcards JSON array
  easinessFactor Float    @default(2.5)
  interval       Int      @default(0) // days
  repetitions    Int      @default(0)
  nextReviewAt   DateTime @default(now())
  lastQuality    Int      @default(0) // 0-5
  totalReviews   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([lessonId, cardIndex])
}
```

Thêm relation vào model `Lesson`:
```prisma
flashcardReviews FlashcardReview[]
```

Sau khi thay đổi schema: `npx prisma db push` (dev) hoặc tạo migration file (prod).

---

## UI Notes

### Nút khởi động SRS
Trên trang chi tiết bài học, thêm nút "Ôn SRS" bên cạnh nút "Flashcard". Badge hiển thị số thẻ due hôm nay (ví dụ: "Ôn SRS · 5").

### SRS Review Mode trong FlashcardDeck
- Thêm prop `mode: "normal" | "srs"` vào component
- `mode="srs"`: chỉ load due cards qua `GET /api/lessons/[id]/srs/due`
- Header: "Ôn tập SRS — Còn lại: X thẻ"
- Flow mỗi thẻ:
  1. Hiện mặt trước
  2. User bấm "Lật" hoặc click vào thẻ
  3. Mặt sau hiện ra, 3 nút rating xuất hiện ở dưới
  4. User chọn rating, API gọi, thẻ tiếp theo load
- Không có nút "Prev/Next" manual trong SRS mode
- Progress bar: `(done / total) * 100%`

### Màn hình kết thúc session
```
Hoàn thành! 🎉
Đã ôn: 12 thẻ
Nhớ tốt: 8  |  Cần ôn thêm: 4
Phiên tiếp theo: ngày mai (3 thẻ)
[Quay lại bài học]  [Xem Dashboard]
```

### Dashboard SRS (trang riêng hoặc tab trong /dashboard)
- Table: Bài học | Thẻ due | Tổng thẻ | Thành thạo | Hành động
- Row có `dueCount > 0`: nổi bật màu accent
- Row `dueCount = 0`: mờ, "Đã ôn xong hôm nay"
- Sorting mặc định: dueCount giảm dần
