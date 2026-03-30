# PRD: Udemy Learner

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 1.1  
> **Ngày:** 2026-03-30  
> **Trạng thái:** Đã triển khai (documenting what exists)

---

## 1. Tổng quan sản phẩm

**Udemy Learner** là một ứng dụng web hỗ trợ học viên Udemy học hiệu quả hơn nhờ AI. Ứng dụng cho phép import khóa học từ tài khoản Udemy hoặc tạo khóa học mới từ file transcript cục bộ, xem và chỉnh sửa transcript của từng bài học, rồi dùng AI để tóm tắt, giải thích sâu, chat trực tiếp, luyện tập tương tác (quiz/flashcard/bài tập), và tạo lộ trình học tập cá nhân hóa cho toàn khóa.

Mục tiêu cốt lõi: **biến transcript thô thành kiến thức có cấu trúc**, giúp học viên nắm bài nhanh hơn và sâu hơn.

---

## 2. Vấn đề cần giải quyết

Học viên Udemy gặp một số rào cản phổ biến:

- Transcript bài học thường dài, rời rạc, khó đọc lại
- Không có công cụ tóm tắt hay giải thích nội dung theo nhu cầu
- Phải chuyển qua lại nhiều tab để tra cứu khi học
- Không thể hỏi đáp tương tác với nội dung khóa học
- Không có cách luyện tập kiến thức vừa học một cách có hệ thống
- Khó định hướng học toàn khóa khi chưa biết tầm quan trọng của từng bài

**Udemy Learner** giải quyết tất cả vấn đề này trong một giao diện duy nhất.

---

## 3. Đối tượng người dùng

| Nhóm | Mô tả |
|------|-------|
| **Học viên kỹ thuật** | Lập trình viên, data scientist học khóa Udemy để nâng kỹ năng |
| **Self-learner** | Người tự học có tài khoản Udemy, muốn học có hệ thống hơn |
| **Người học từ file cục bộ** | Không cần Udemy — upload transcript từ máy tính để học với AI |
| **Developer tự dùng** | Người cài ứng dụng local để dùng riêng với API key của mình |

**Điều kiện tiên quyết:** Người dùng phải có API key từ một nhà cung cấp tương thích OpenAI. Tài khoản Udemy chỉ cần thiết khi dùng tính năng import từ Udemy; không cần khi upload file transcript thủ công.

---

## 4. Mục tiêu sản phẩm

1. Import và lưu trữ khóa học Udemy cùng transcript một cách tự động
2. Cung cấp 5 chế độ AI hỗ trợ học: Summary, Explain, Chat, Practice (Quiz/Flashcard/Exercises), Roadmap
3. Cho phép tạo khóa học từ file cục bộ (`.vtt`, `.srt`, `.txt`) hoặc thư mục — không cần Udemy
4. Lưu trữ và cache kết quả AI vào database để tái sử dụng, hỗ trợ force-regenerate
5. Chạy hoàn toàn local, không phụ thuộc backend bên ngoài ngoài AI provider
6. Hỗ trợ nhiều profile AI — chuyển đổi giữa nhiều provider/model dễ dàng

---

## 5. Phạm vi (Scope)

### In Scope

- Import khóa học và transcript qua Udemy access token
- Tạo khóa học từ file `.vtt`, `.srt`, `.txt` hoặc thư mục — tự động tạo course + lessons
- Quản lý khóa học và bài học thủ công (CRUD)
- Xem và chỉnh sửa transcript từng bài học
- AI Summary: tóm tắt bài học theo chuẩn giáo học pháp (Bloom's Taxonomy)
- AI Explain: giải thích sâu bằng kỹ thuật Feynman
- AI Chat: chat nhiều lượt có streaming với context bài học
- AI Practice: Quiz tương tác (clickable MCQ), Flashcard lật thẻ (SRS), Bài tập accordion (Deliberate Practice)
- AI Roadmap: phân tích toàn khóa, đề xuất lộ trình học tập cá nhân hóa
- AI Cache: kết quả được lưu vào DB, trả về ngay khi đã có; hỗ trợ force-regenerate
- Multi-profile AI settings (base URL, API key, model, Udemy cookie per profile)
- Giao diện hoàn toàn bằng tiếng Việt
- Docker support cho deployment (port 3939)

### Out of Scope

- Xem video trực tiếp từ Udemy
- Đồng bộ tiến độ học lên Udemy
- Multi-user / authentication hệ thống
- Mobile app (chỉ web)
- Lưu lịch sử chat giữa các phiên
- Xuất nội dung ra PDF/Word

---

## 6. Yêu cầu chức năng

### 6.1 Module: Import & Quản lý khóa học

| ID | Yêu cầu |
|----|---------|
| F-01 | Người dùng nhập `access_token` cookie từ Udemy để xác thực |
| F-02 | Hệ thống gọi Udemy API lấy danh sách khóa học đã enroll |
| F-03 | Người dùng chọn khóa học cần import |
| F-04 | Hệ thống tự động import curriculum (danh sách bài học) và transcript |
| F-05 | Người dùng có thể thêm khóa học thủ công bằng tiêu đề |
| F-06 | Người dùng có thể xóa khóa học (xóa cascade cả lessons và dữ liệu AI liên quan) |
| F-07 | Danh sách khóa học hiển thị trong sidebar, sắp xếp theo thứ tự thêm vào |

### 6.2 Module: Quản lý bài học

| ID | Yêu cầu |
|----|---------|
| F-08 | Người dùng có thể thêm bài học thủ công vào khóa học |
| F-09 | Bài học hiển thị trong sidebar theo thứ tự (`order`) |
| F-10 | Chọn bài học để xem nội dung transcript trong panel chính |

### 6.3 Module: Upload & Tạo khóa học từ file

| ID | Yêu cầu |
|----|---------|
| F-11 | Người dùng mở `UploadModal` và chọn file hoặc thư mục transcript từ máy tính |
| F-12 | Hệ thống hỗ trợ 3 định dạng: `.vtt`, `.srt`, `.txt` |
| F-13 | File được đọc client-side và gửi nội dung lên server qua JSON |
| F-14 | Server parse từng định dạng: VTT/SRT loại bỏ timestamps và deduplicate dòng trùng, TXT dùng nguyên |
| F-15 | Tên file (không có extension) trở thành tiêu đề bài học mới |
| F-16a | Nếu không có khóa học nào được chọn: người dùng nhập tên khóa học → hệ thống tạo khóa học mới và thêm bài học vào đó |
| F-16b | Nếu đã chọn khóa học: file được thêm vào khóa học đang chọn |
| F-16c | Hỗ trợ chọn thư mục (`webkitdirectory`) — upload nhiều file cùng lúc từ folder |
| F-16d | Sau khi tạo khóa học mới, tự động select khóa học đó trong sidebar |

### 6.4 Module: Transcript

| ID | Yêu cầu |
|----|---------|
| F-17 | Transcript tự động được import từ Udemy khi import khóa học |
| F-18 | Người dùng có thể xem transcript của từng bài học |
| F-19 | Người dùng có thể chỉnh sửa transcript và lưu lại |

### 6.5 Module: AI Summary

| ID | Yêu cầu |
|----|---------|
| F-20 | Người dùng nhấn nút Summary để tạo tóm tắt bài học |
| F-21 | AI đóng vai Instructional Designer, dùng Bloom's Taxonomy để cấu trúc output |
| F-22 | Output tối thiểu 600 từ, có thể lên tới 2500+ từ tùy nội dung |
| F-23 | Hỗ trợ ASR degradation handling (transcript bị nhận dạng sai vẫn hoạt động) |
| F-24 | Hỗ trợ code-switching (transcript trộn tiếng Anh/Việt) |
| F-25 | Kết quả được persist vào `Lesson.summary` và tự động load lại khi chọn bài học |

### 6.6 Module: AI Explain

| ID | Yêu cầu |
|----|---------|
| F-26 | Người dùng nhấn nút Explain để nhận giải thích sâu về bài học |
| F-27 | AI áp dụng Feynman Technique: giải thích như dạy người mới |
| F-28 | Hệ thống tự phân loại Format A (nhiều code), Format B (nhiều lý thuyết), hoặc Hybrid dựa trên % code trong transcript |
| F-29 | Output tối thiểu 800 từ, có thể lên tới 3500+ từ |
| F-30 | Kết quả được persist vào `Lesson.explanation` và tự động load lại khi chọn bài học |

### 6.7 Module: AI Chat

| ID | Yêu cầu |
|----|---------|
| F-31 | Người dùng chat nhiều lượt với AI về nội dung bài học hiện tại |
| F-32 | Streaming response: text xuất hiện dần, không chờ full response |
| F-33 | AI đóng vai tutor, nhận diện 7 loại câu hỏi và điều chỉnh cách trả lời |
| F-34 | Context bài học (transcript) được đưa vào mỗi turn của chat |
| F-35 | Lịch sử chat không persist giữa các phiên (reset khi chọn bài khác) |

### 6.8 Module: AI Practice (Luyện tập tương tác)

| ID | Yêu cầu |
|----|---------|
| F-36 | Người dùng chọn tab Practice và chế độ luyện tập: Quiz, Flashcard, hoặc Bài tập |
| F-37 | **Quiz**: AI tạo 8–12 câu trắc nghiệm/đúng-sai/điền khuyết/trả lời ngắn/hoàn thành code; phân bố theo Bloom's Taxonomy 3 mức; có đáp án và giải thích chi tiết |
| F-37a | **Quiz UI tương tác**: `QuizPlayer.tsx` parse markdown → render câu hỏi MCQ; click chọn đáp án → highlight đúng (xanh) / sai (đỏ); chấm điểm tự động |
| F-38 | **Flashcard**: AI tạo 15–25 thẻ theo SRS và Minimum Information Principle; 5 loại thẻ (Term→Definition, Concept→Explanation, Code→Output, Scenario→Solution, Compare→Differences); có mnemonic |
| F-38a | **Flashcard UI tương tác**: `FlashcardDeck.tsx` render thẻ có mặt trước/sau; click để lật (flip animation); prev/next navigation; hiển thị tiến trình (x/y) |
| F-39 | **Bài tập thực hành**: AI tạo 3–5 bài theo Deliberate Practice; phân loại Tái hiện/Mở rộng/Sáng tạo/Debug/Mini Project; tự phân loại Lý thuyết/Thực hành/Hỗn hợp từ transcript; có rubric đánh giá và lời giải tham khảo |
| F-39a | **Bài tập UI tương tác**: `ExerciseList.tsx` render bài tập dạng accordion; click mở rộng/thu gọn để xem lời giải; có rubric đánh giá |
| F-40 | Kết quả Quiz persist vào `Lesson.quiz`; Flashcard vào `Lesson.flashcards`; Bài tập vào `Lesson.exercises` |
| F-41 | Kết quả tự động load lại khi chọn lại bài học |

### 6.9 Module: AI Roadmap (Lộ trình)

| ID | Yêu cầu |
|----|---------|
| F-42 | Người dùng click tab Roadmap trong AI panel để tạo lộ trình toàn khóa |
| F-43 | AI phân tích TOÀN BỘ các bài học: aggregate transcripts (truncate mỗi bài tới 4000 chars để tránh vượt context window) |
| F-44 | Output bao gồm: tổng quan khóa, phân giai đoạn học, bản đồ kiến thức, phương pháp học tối ưu, dự án tổng hợp, kế hoạch tuần |
| F-45 | Roadmap không phụ thuộc vào bài học đang chọn — là course-level |
| F-46 | Kết quả persist vào `Course.roadmap` và tự động load lại khi chọn lại khóa học |

### 6.10 Module: AI Cache & Persistence

| ID | Yêu cầu |
|----|---------|
| F-47 | Khi chọn bài học, hệ thống tự động load toàn bộ AI results đã lưu (summary, explanation, quiz, flashcards, exercises) qua `GET /api/lessons/[id]/ai` |
| F-48 | Khi chọn khóa học, hệ thống tự động load roadmap đã lưu qua `GET /api/courses/[id]/ai` |
| F-49 | Nếu đã có kết quả lưu sẵn, hiển thị ngay mà không cần generate lại (cache guard) |
| F-50 | Người dùng có thể gửi `"force": true` để generate lại; kết quả mới ghi đè kết quả cũ. UI hiển thị nút "Tạo lại" khi đã có cache |

### 6.11 Module: AI Settings (Multi-Profile)

| ID | Yêu cầu |
|----|---------|
| F-51 | Người dùng tạo nhiều profile AI, mỗi profile có: tên, base URL, API key, model, Udemy cookie |
| F-52 | Chuyển đổi giữa các profile qua dropdown trong SettingsModal |
| F-53 | Hệ thống tự fetch danh sách model từ provider và hiển thị dropdown; cache model list trong profile |
| F-54 | Xóa profile không cần thiết |
| F-55 | Toàn bộ profiles lưu trong localStorage với key `udemy_ai_profiles` (shape: `{ profiles: AIProfile[], activeId: string }`). Auto-migrate từ key cũ `udemy_ai_settings` |
| F-56 | Header hiển thị "Tên profile / model" khi đã cấu hình |

---

## 7. Yêu cầu phi chức năng

### 7.1 Performance

| Yêu cầu | Mục tiêu |
|---------|---------|
| Import khóa học | Hoàn thành trong vòng 30 giây với khóa học trung bình (50 bài) |
| AI Summary/Explain | First token xuất hiện trong vòng 3 giây |
| Chat streaming | Latency cảm nhận thấp nhờ streaming, không block UI |
| Load danh sách khóa học | Dưới 500ms từ SQLite local |
| Load AI results đã lưu | Tức thì (query DB local, cache guard trả về ngay) |

### 7.2 Security

| Yêu cầu | Chi tiết |
|---------|---------|
| Access token | Không lưu vào database, chỉ dùng trong phiên import |
| API key | Lưu client-side (localStorage), không gửi lên server ngoài |
| SQLite | Database local, không expose qua network |
| CORS | Chỉ gọi API Udemy từ server-side để tránh CORS |

### 7.3 UX

| Yêu cầu | Chi tiết |
|---------|---------|
| Ngôn ngữ giao diện | Hoàn toàn tiếng Việt |
| Responsive | Tối ưu cho desktop (màn hình 1280px+); sidebar + split panel |
| Feedback trực quan | Loading states rõ ràng cho mọi thao tác AI |
| Error handling | Hiển thị thông báo lỗi rõ ràng khi API fail |
| AI results cache | Hiển thị kết quả đã lưu ngay khi chọn bài, không cần chờ; nút "Tạo lại" để regenerate |
| Multi-profile | Chuyển đổi nhanh giữa các AI provider/model; header hiển thị profile đang dùng |
| Interactive practice | Quiz clickable, flashcard flip, exercises accordion — không chỉ hiển thị text |

### 7.4 Maintainability

- Prompt architecture dùng DRY pattern: shared ASR rule builder và language rule builder
- TypeScript strict mode trên toàn bộ codebase
- Prisma schema làm single source of truth cho data model
- Zod validation trên tất cả API routes
- Docker support cho deployment nhất quán

---

## 8. Kiến trúc kỹ thuật

### 8.1 Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16, App Router, React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Prisma ORM + SQLite (local file) |
| AI Integration | OpenAI SDK (compatible với mọi OpenAI-compatible provider) |
| Language | TypeScript |
| Validation | Zod |
| Deploy | Docker (docker-compose, port 3939) |

### 8.2 Data Model

```prisma
model Course {
  id        String   @id @default(cuid())
  url       String   @unique        // "" khi tạo thủ công
  title     String
  roadmap   String?                 // AI-generated course roadmap
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lessons   Lesson[]
}

model Lesson {
  id          String   @id @default(cuid())
  courseId    String
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title       String
  order       Int
  transcript  String?
  summary     String?               // AI-generated lesson summary
  explanation String?               // AI-generated lesson explanation
  roadmap     String?               // Reserved (không dùng hiện tại)
  quiz        String?               // AI-generated quiz
  flashcards  String?               // AI-generated flashcard set
  exercises   String?               // AI-generated practice exercises
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 8.3 API Routes

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/courses` | Lấy tất cả khóa học kèm lessons | |
| `POST` | `/api/courses` | Tạo khóa học mới | |
| `GET` | `/api/courses/[id]` | Lấy chi tiết khóa học | |
| `DELETE` | `/api/courses/[id]` | Xóa khóa học (cascade) | |
| `GET` | `/api/courses/[id]/ai` | Lấy AI data cấp khóa học | Trả về `roadmap` |
| `POST` | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học | |
| `POST` | `/api/courses/upload` | Upload file transcript → tạo khóa học hoặc thêm bài học | Nhận `courseId` hoặc `courseTitle`; Zod validation |
| `GET` | `/api/lessons/[id]/ai` | Lấy AI data cấp bài học | summary, explanation, quiz, flashcards, exercises |
| `PUT` | `/api/lessons/[id]/transcript` | Cập nhật transcript bài học | |
| `POST` | `/api/ai/summary` | Tạo AI summary; persist → `Lesson.summary` | Cache guard + `force` flag |
| `POST` | `/api/ai/explain` | Tạo AI explanation; persist → `Lesson.explanation` | Cache guard + `force` flag |
| `POST` | `/api/ai/chat` | Streaming chat (Server-Sent Events) | Không persist; không cache |
| `POST` | `/api/ai/roadmap` | Tạo lộ trình toàn khóa; persist → `Course.roadmap` | Course-level; Cache guard + `force` flag |
| `POST` | `/api/ai/quiz` | Tạo Quiz / Flashcard / Exercises | Param: `mode: "quiz" \| "flashcards" \| "exercises"`; Cache guard + `force` flag |
| `POST` | `/api/ai/models` | Lấy danh sách model từ provider | |
| `POST` | `/api/udemy/courses` | Lấy danh sách khóa học đã enroll từ Udemy | |
| `POST` | `/api/udemy/import` | Import khóa học, lessons, transcripts từ Udemy | |

### 8.4 UI Architecture

Ứng dụng là single-page với layout 3 vùng:

```
┌─────────────────────────────────────────────────────────────┐
│  Header (tên app + "ProfileName / model" + Settings button)  │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  Main Content (split panel)                  │
│  - AddCourse │  ┌──────────────────┬──────────────────────┐ │
│  - Upload    │  │  TranscriptPanel │  AIAssistantPanel    │ │
│  - CourseList│  │  (xem + edit)    │  Tab: Summary        │ │
│  - LessonList│  │                  │  Tab: Explain        │ │
│              │  │                  │  Tab: Chat           │ │
│              │  │                  │  Tab: Roadmap        │ │
│              │  │                  │  Tab: Practice       │ │
│              │  │                  │    → QuizPlayer      │ │
│              │  │                  │    → FlashcardDeck   │ │
│              │  │                  │    → ExerciseList    │ │
│              │  └──────────────────┴──────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

**Components chính:**
- `Header` — thanh navigation, hiển thị "Tên profile / model", mở Settings
- `AddCoursePanel` — form thêm khóa học thủ công + nút import Udemy + nút upload file
- `CourseList` — danh sách khóa học, select active
- `LessonList` — danh sách bài học của khóa học đang chọn
- `TranscriptPanel` — hiển thị và edit transcript
- `AIAssistantPanel` — 5 tab: Summary, Explain, Chat, Roadmap, Practice
- `SettingsModal` — multi-profile AI settings (tạo/chuyển/xóa profile)
- `ImportModal` — nhập access token và chọn khóa học từ Udemy
- `UploadModal` — chọn file/thư mục transcript; nhập tên khóa học khi tạo mới
- `QuizPlayer` — quiz tương tác: click chọn đáp án, chấm điểm, highlight đúng/sai
- `FlashcardDeck` — flashcard lật thẻ: flip animation, prev/next, tiến trình
- `ExerciseList` — bài tập accordion: mở rộng/thu gọn, lời giải tham khảo

**shadcn/ui primitives dùng:** `button`, `dialog`, `input`, `label`, `select`, `textarea`, `badge`, `alert-dialog`, `scroll-area`, `separator`, `tabs`, `card`

---

## 9. User Flows

### Flow 1: Import khóa học từ Udemy

```
1. Người dùng mở ứng dụng
2. Click "Import từ Udemy"
3. Nhập access_token cookie từ Udemy
4. Hệ thống gọi POST /api/udemy/courses → hiển thị danh sách
5. Người dùng chọn khóa học muốn import
6. Hệ thống gọi POST /api/udemy/import → lưu vào SQLite
7. Khóa học và bài học xuất hiện trong sidebar
```

### Flow 2: Tạo khóa học từ file cục bộ

```
1. Người dùng click "Upload từ file" → UploadModal mở ra
2. Nếu không có khóa học nào được chọn:
   2a. Người dùng nhập tên khóa học mới vào ô "Tên course"
3. Chọn file hoặc thư mục chứa file .vtt / .srt / .txt
4. Hệ thống đọc file client-side, gửi nội dung lên POST /api/courses/upload
   - Nếu có courseId (đã chọn khóa học): thêm bài vào khóa học đó
   - Nếu có courseTitle (tạo mới): tạo khóa học mới, thêm bài vào
5. Server parse định dạng (strip timestamps, deduplicate VTT/SRT; giữ nguyên TXT)
6. Bài học mới tạo ra với tên = tên file, transcript = nội dung đã parse
7. Nếu tạo mới: khóa học tự động được select trong sidebar
8. Bài học xuất hiện, có thể dùng AI ngay
```

### Flow 3: Dùng AI Summary (với cache)

```
1. Người dùng chọn khóa học → chọn bài học
2. Hệ thống load AI results đã lưu qua GET /api/lessons/[id]/ai
3. Nếu đã có summary: hiển thị ngay trong tab Summary + hiện nút "Tạo lại"
4. Nếu chưa có: người dùng click "Tạo tóm tắt"
5. Hệ thống gọi POST /api/ai/summary với transcript
   - Backend kiểm tra cache → nếu có và không force → trả về cache
   - Nếu không có hoặc force=true → gọi AI, persist, trả về
6. Kết quả hiển thị; lần sau load tự động
```

### Flow 4: Luyện tập tương tác với Quiz/Flashcard/Bài tập

```
1. Người dùng chọn bài học có transcript
2. Click tab "Practice" trong AI panel
3. Chọn chế độ: Quiz / Flashcard / Bài tập
4. Hệ thống gọi POST /api/ai/quiz với mode tương ứng
5. Kết quả được parse và render tương tác:
   - Quiz: QuizPlayer — click chọn đáp án, chấm điểm tự động
   - Flashcard: FlashcardDeck — lật thẻ, điều hướng prev/next
   - Bài tập: ExerciseList — accordion mở rộng xem lời giải
6. Kết quả persist vào Lesson; lần sau load tự động
```

### Flow 5: Tạo lộ trình toàn khóa

```
1. Người dùng chọn khóa học
2. Click tab "Roadmap" trong AI panel
3. Nếu đã có roadmap: hiển thị ngay (load từ Course.roadmap) + nút "Tạo lại"
4. Nếu chưa có: click "Tạo lộ trình"
5. Hệ thống gọi POST /api/ai/roadmap với tất cả transcripts (truncated)
6. Kết quả hiển thị; persist vào Course.roadmap
```

### Flow 6: Chat với AI về bài học

```
1. Người dùng chọn bài học có transcript
2. Click tab "Chat" trong AI panel
3. Nhập câu hỏi về nội dung bài học
4. Hệ thống gửi POST /api/ai/chat với lịch sử chat + transcript
5. Response stream dần vào giao diện
6. Người dùng tiếp tục hỏi trong cùng session
```

### Flow 7: Cấu hình Multi-Profile AI

```
1. Click icon Settings trên Header (hoặc "ProfileName / model")
2. SettingsModal mở ra — hiển thị profile hiện tại
3. Thao tác với profile:
   a. Tạo mới: nhấn "Thêm profile" → nhập tên, base URL, API key
   b. Chọn profile: dropdown → chuyển sang profile khác
   c. Xóa: icon xóa bên cạnh profile
4. Nhập base URL → hệ thống gọi POST /api/ai/models → load dropdown model
5. Chọn model → Lưu
6. Header cập nhật hiển thị "Tên profile / model"
```

---

## 10. Rủi ro và giải pháp

| Rủi ro | Mức độ | Giải pháp |
|--------|--------|-----------|
| Udemy thay đổi API / cookie format | Trung bình | Upload file thủ công vẫn hoạt động như fallback hoàn chỉnh |
| Access token hết hạn khi import | Thấp | Thông báo lỗi rõ ràng, yêu cầu token mới |
| Transcript chất lượng kém (ASR noise) | Cao | Prompt có ASR degradation handling tích hợp sẵn |
| AI provider không tương thích hoàn toàn | Trung bình | Test với OpenAI, Groq, Ollama; multi-profile giúp chuyển provider nhanh |
| SQLite corrupted | Thấp | Backup database file định kỳ (manual) |
| Context window vượt quá giới hạn model | Trung bình | Transcript truncate trước khi gửi; Roadmap giới hạn 4000 chars/bài |
| Reasoning model output thẻ `<think>` | Thấp | Think-tag suppression ở cả prompt-level và server-side regex |
| File transcript định dạng lạ | Thấp | Validate extension; fallback plain text nếu parse fail |

---

## 11. Roadmap / Phiên bản

### v1.0 — Foundation (đã triển khai)

- Import khóa học từ Udemy qua access token
- Upload transcript từ file `.vtt`, `.srt`, `.txt` (không cần Udemy)
- Quản lý khóa học và bài học thủ công
- Xem và chỉnh sửa transcript
- AI Summary với Bloom's Taxonomy (persist)
- AI Explain với Feynman Technique (persist)
- AI Chat streaming với context bài học (không persist)
- AI Practice: Quiz, Flashcard, Bài tập (persist)
- AI Roadmap toàn khóa (persist vào Course)
- Persistence layer: lesson-level + course-level
- AI Settings: cấu hình provider, model — lưu localStorage
- Prompt quality: DRY architecture, Think-tag suppression
- Giao diện tiếng Việt
- Docker support

### v1.1 — Cải tiến UX & AI (hiện tại)

- **Multi-profile AI settings** — tạo/chuyển/xóa nhiều profile; auto-migrate từ settings cũ
- **Tạo khóa học từ file upload** — UploadModal nhập tên khóa học, tự tạo course + lessons; auto-select sau upload
- **Folder upload** — chọn cả thư mục transcript (webkitdirectory)
- **AI cache guard + force regenerate** — tất cả AI routes kiểm tra cache trước khi gọi AI; nút "Tạo lại" để force
- **Interactive practice** — QuizPlayer (click MCQ), FlashcardDeck (flip), ExerciseList (accordion)
- **AI context enrichment** — user messages gửi kèm `lessonIndex`/`totalLessons` cho AI biết vị trí bài trong khóa
- **Header hiển thị profile** — "Tên profile / model" trên header
- **Bug fixes** — ImportModal error display, upload flow UX

### v1.x — Tiềm năng cải tiến (chưa triển khai)

> Phần này chỉ ghi nhận, không phải cam kết.

- Lưu lịch sử chat giữa các phiên
- Export summary/explain/roadmap ra file Markdown
- Hỗ trợ nhiều ngôn ngữ giao diện
- PostgreSQL thay thế SQLite cho multi-user
- Tìm kiếm toàn văn qua transcripts

---

## 12. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|----------|-----------|
| Feature List (đầy đủ) | `docs/features.md` |
| Prompt Engineering Guide | `docs/educational-prompt-engineering.md` |
| Prompts Design | `docs/PROMPTS_DESIGN.md` |
| Implementation Order | `docs/implementation-order.md` |
| Source code | https://github.com/chrisnguyen201092-dotcom/udemy-transcript-analyzer |
