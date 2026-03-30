# Danh sách Tính năng - Udemy App

## Tổng quan

| Module | Tổng số tính năng | Hoàn thành | Đang phát triển | Kế hoạch |
|--------|-------------------|------------|-----------------|----------|
| Quản lý Khóa học | 4 | 4 | 0 | 0 |
| Udemy Import | 2 | 2 | 0 | 0 |
| Upload & Tạo khóa học từ file | 4 | 4 | 0 | 0 |
| Quản lý Transcript | 3 | 3 | 0 | 0 |
| AI Assistant — Bài học | 4 | 4 | 0 | 0 |
| AI Assistant — Luyện tập (Interactive) | 3 | 3 | 0 | 0 |
| AI Assistant — Lộ trình | 1 | 1 | 0 | 0 |
| AI Cache & Persistence | 4 | 4 | 0 | 0 |
| Cài đặt (Multi-Profile) | 5 | 5 | 0 | 0 |
| Prompt Engineering | 4 | 4 | 0 | 0 |
| UI/UX | 4 | 4 | 0 | 0 |
| **Tổng cộng** | **38** | **38** | **0** | **0** |

---

## Module 1: Quản lý Khóa học (Course Management)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Tạo khóa học thủ công | Người dùng tự tạo khóa học mới bằng cách nhập tên | ✅ Hoàn thành | `POST /api/courses` | Lưu vào SQLite qua Prisma; `url` được lưu dưới dạng chuỗi rỗng `""` khi tạo thủ công |
| Danh sách khóa học | Hiển thị toàn bộ khóa học đã tạo hoặc import vào hệ thống | ✅ Hoàn thành | `GET /api/courses` | Trả về danh sách kèm lessons, sắp xếp theo ngày tạo giảm dần |
| Xóa khóa học | Xóa khóa học và toàn bộ dữ liệu liên quan (lessons, transcripts, AI results) | ✅ Hoàn thành | `DELETE /api/courses/[id]` | Cascade delete qua Prisma relations; xóa tất cả lessons và dữ liệu AI liên quan |
| Tạo bài học trong khóa học | Thêm bài học (lesson) mới vào một khóa học cụ thể | ✅ Hoàn thành | `POST /api/courses/[id]/lessons` | Gán `courseId`, tự động tính `order` dựa trên số bài hiện có |

---

## Module 2: Udemy Import

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Lấy danh sách khóa học đã đăng ký từ Udemy | Gọi Udemy API để lấy toàn bộ khóa học mà người dùng đã mua | ✅ Hoàn thành | `POST /api/udemy/courses` | Xác thực qua `access_token` cookie từ Udemy; gọi server-side để tránh CORS; trả về `id, title, url, num_lectures` |
| Import curriculum và transcript từ Udemy | Import toàn bộ cấu trúc khóa học gồm chapters, lectures và transcript của từng bài | ✅ Hoàn thành | `POST /api/udemy/import` | Gọi Udemy curriculum API; lấy caption/transcript VTT cho từng lecture; parse VTT thành plain text; lưu Course + Lessons + transcripts vào DB |

---

## Module 3: Upload & Tạo khóa học từ file cục bộ

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Tạo khóa học mới từ file upload | Khi không có khóa học nào được chọn, người dùng nhập tên khóa học mới, hệ thống tự tạo khóa học và thêm bài học từ file | ✅ Hoàn thành | `POST /api/courses/upload` + `UploadModal` | Upload API nhận `courseTitle` (tạo mới) hoặc `courseId` (thêm vào khóa học đã có); Zod `.refine()` validate; trả về `courseId` trong response |
| Upload file transcript | Chọn file transcript từ máy tính để tạo bài học | ✅ Hoàn thành | `POST /api/courses/upload` + `UploadModal` | Hỗ trợ `.vtt`, `.srt`, `.txt`; đọc file client-side, gửi content qua JSON; server parse từng định dạng (VTT/SRT deduplicate lines, strip timestamps); tên file (không có extension) trở thành tên bài học |
| Upload thư mục (folder) | Chọn cả thư mục chứa nhiều file transcript cùng lúc | ✅ Hoàn thành | `UploadModal` | Sử dụng `webkitdirectory` attribute; lọc file theo extension `.vtt`/`.srt`/`.txt` |
| Tự động chọn khóa học mới | Sau khi upload tạo khóa học mới xong, tự động select khóa học đó trong sidebar | ✅ Hoàn thành | `UploadModal` + `page.tsx` | `onCourseCreated` callback từ UploadModal; refresh danh sách khóa học và set active course |

---

## Module 4: Quản lý Transcript

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Xem transcript trong panel | Hiển thị nội dung transcript của bài học trong panel bên trái giao diện | ✅ Hoàn thành | UI component: `TranscriptPanel` | Render plain text; hỗ trợ scroll dài; hiển thị bài học không có transcript |
| Chỉnh sửa và lưu transcript | Cho phép người dùng chỉnh sửa thủ công nội dung transcript rồi lưu lại | ✅ Hoàn thành | `PUT /api/lessons/[id]/transcript` | Textarea editable; save on button click; cập nhật state local ngay sau khi lưu |
| Tự động import transcript từ Udemy | Transcript được kéo tự động khi import khóa học từ Udemy | ✅ Hoàn thành | `POST /api/udemy/import` | Tích hợp trong luồng import; không cần thao tác thêm |

---

## Module 5: AI Assistant — Bài học

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Summary | Tóm tắt bài học theo phong cách Instructional Designer, tự động điều chỉnh độ dài (600–2500+ từ), có câu hỏi theo Bloom's Taxonomy và kỹ thuật mnemonic | ✅ Hoàn thành | `POST /api/ai/summary` | Persona: Instructional Designer; output calibrated by transcript length; Bloom's Taxonomy levels; mnemonic techniques; kết quả được persist vào `Lesson.summary` |
| AI Explain | Giải thích khái niệm theo kỹ thuật Feynman, tự phân loại Format A/B/Hybrid theo phần trăm code, gom nhóm các bước khi có hơn 10 steps | ✅ Hoàn thành | `POST /api/ai/explain` | Feynman technique; auto-classify format dựa trên code%; phase grouping khi >10 steps; kết quả persist vào `Lesson.explanation` |
| AI Chat (streaming) | Chat đa lượt với streaming, nhận diện 7 loại câu hỏi để trả lời phù hợp, persona tutor, quản lý history | ✅ Hoàn thành | `POST /api/ai/chat` | Multi-turn streaming via Server-Sent Events; 7 question types detection; tutor persona; conversation history gửi kèm mỗi lượt; **chat history không persist** (chỉ trong session) |
| AI Model Selection | Lấy danh sách model từ bất kỳ OpenAI-compatible provider nào để hiển thị trong dropdown | ✅ Hoàn thành | `POST /api/ai/models` | Compatible với OpenAI, OpenRouter, Ollama, LM Studio; fetch `/models` endpoint dynamically từ base URL |

---

## Module 6: AI Assistant — Luyện tập (Interactive Practice)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Quiz (Interactive) | Tạo bộ quiz kiểm tra kiến thức bài học: trắc nghiệm, đúng/sai, điền khuyết, trả lời ngắn, hoàn thành code (nếu có code). 8–12 câu, phân bố theo Bloom's Taxonomy 3 mức độ, có đáp án và giải thích chi tiết. **UI tương tác**: click chọn đáp án, chấm điểm tự động, hiển thị đáp án đúng/sai | ✅ Hoàn thành | `POST /api/ai/quiz` + `QuizPlayer.tsx` | Persona: Assessment Designer; `QuizPlayer` parse markdown output → render câu hỏi tương tác; click chọn đáp án → highlight đúng/sai; persist vào `Lesson.quiz` |
| AI Flashcard (Flip) | Tạo bộ flashcard ôn tập theo SRS và Minimum Information Principle: 15–25 thẻ, 5 loại thẻ. **UI tương tác**: lật thẻ (flip animation), prev/next navigation, hiển thị tiến trình | ✅ Hoàn thành | `POST /api/ai/quiz` + `FlashcardDeck.tsx` | `FlashcardDeck` parse markdown → render thẻ có mặt trước/sau; click để lật; điều hướng qua từng thẻ; persist vào `Lesson.flashcards` |
| AI Bài tập thực hành (Accordion) | Tạo bài tập luyện tập theo Deliberate Practice và PBL: 3–5 bài. **UI tương tác**: accordion expandable, mở rộng để xem lời giải tham khảo | ✅ Hoàn thành | `POST /api/ai/quiz` + `ExerciseList.tsx` | `ExerciseList` parse markdown → render bài tập dạng accordion; click mở rộng/thu gọn; có rubric + lời giải; persist vào `Lesson.exercises` |

---

## Module 7: AI Assistant — Lộ trình học tập

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Roadmap toàn khóa | Phân tích TOÀN BỘ các bài học trong khóa để đề xuất lộ trình học tập cá nhân hóa: tổng quan khóa, phân giai đoạn, bản đồ kiến thức, phương pháp học tối ưu, dự án tổng hợp, kế hoạch tuần | ✅ Hoàn thành | `POST /api/ai/roadmap` | Course-level (không phụ thuộc bài học đang chọn); aggregate tất cả transcripts (truncate mỗi bài tới 4000 chars); kết quả persist vào `Course.roadmap`; Persona: Learning Consultant (Andragogy + Deliberate Practice) |

---

## Module 8: AI Cache & Persistence

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Lưu kết quả AI theo bài học | Summary, Explanation, Quiz, Flashcard, Exercises tự động lưu vào DB sau mỗi lần generate; load lại khi chọn lại bài học | ✅ Hoàn thành | `GET /api/lessons/[id]/ai` | AI results persist vào các trường tương ứng trong `Lesson`; load khi `lesson.id` thay đổi; không cần regenerate mỗi lần |
| Lưu kết quả AI theo khóa học | Roadmap được lưu vào `Course.roadmap`; load lại khi chọn lại khóa học | ✅ Hoàn thành | `GET /api/courses/[id]/ai` | Course-level persistence trong `Course.roadmap`; load khi `courseId` thay đổi |
| Cache guard trên AI routes | Tất cả AI routes (summary, explain, quiz, roadmap) kiểm tra DB trước khi gọi AI; nếu đã có kết quả → trả về ngay | ✅ Hoàn thành | Tất cả `POST /api/ai/*` routes | Kiểm tra field tương ứng trong Lesson/Course trước khi gọi OpenAI; giảm chi phí API và thời gian chờ |
| Force regenerate | Gửi `"force": true` trong request body để bỏ qua cache, gọi AI lại và ghi đè kết quả cũ | ✅ Hoàn thành | Tất cả `POST /api/ai/*` routes + UI button "Tạo lại" | UI hiển thị nút "Tạo lại" khi đã có kết quả cached; backend xóa field cũ trước khi generate mới |

---

## Module 9: Cài đặt Multi-Profile (Settings)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Multi-profile AI | Tạo, chuyển đổi, xóa nhiều profile AI — mỗi profile có base URL, API key, model, Udemy cookie riêng | ✅ Hoàn thành | `SettingsModal` | `AIProfile` type: `{ id, name, baseUrl, apiKey, model, udemyCookie, cachedModels[] }`; lưu trong localStorage key `udemy_ai_profiles` với shape `{ profiles: AIProfile[], activeId: string }` |
| Cấu hình AI provider per-profile | Mỗi profile có base URL, API key, model dropdown riêng | ✅ Hoàn thành | `SettingsModal` | Base URL cho phép dùng bất kỳ OpenAI-compatible API; model list fetch động từ `/models` endpoint; cached trong profile |
| Cấu hình Udemy cookie per-profile | Mỗi profile có `access_token` cookie riêng | ✅ Hoàn thành | `SettingsModal` | Cookie được lưu client-side trong profile; gửi kèm request khi gọi Udemy API |
| Hiển thị profile hiện tại trên Header | Header hiển thị "Tên profile / model" khi đã cấu hình | ✅ Hoàn thành | `Header.tsx` | Đọc active profile từ localStorage; hiển thị `profile.name / profile.model` |
| Auto-migrate từ settings cũ | Tự động migrate từ `udemy_ai_settings` (single config) sang `udemy_ai_profiles` (multi-profile) | ✅ Hoàn thành | `SettingsModal` | Chạy một lần khi load; tạo profile "Default" từ settings cũ; xóa key cũ sau khi migrate |

---

## Module 10: Prompt Engineering

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| DRY prompt architecture | Các builder function dùng chung cho nhiều prompt, tránh lặp lại logic | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Shared functions: `buildASRRules(inferenceSource, fallback?)`, `buildLanguageRules(translationStyle)`; `getSystemPrompt(type)` dispatcher; 7 prompt types: `summary`, `explain`, `chat`, `roadmap`, `quiz`, `flashcards`, `exercises` |
| ASR degradation handling | Tự động phát hiện transcript chất lượng thấp (từ ASR) và điều chỉnh cách xử lý | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Parameterized per-prompt: Chat có fallback đặc biệt (gợi ý xem lại video); Roadmap/Practice có context-aware inference |
| Code-switching support | Hỗ trợ transcript có ngôn ngữ pha trộn (Tiếng Việt + English) | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Xử lý mixed-language input; giữ thuật ngữ kỹ thuật tiếng Anh trong ngoặc; `buildLanguageRules` với style khác nhau cho từng prompt type |
| Think-tag suppression | Chặn model output thẻ `<think>` (reasoning models như DeepSeek) | ✅ Hoàn thành | Tất cả routes AI + `src/lib/ai/prompts.ts` | Mỗi system prompt có dòng `KHÔNG bao giờ xuất thẻ <think>`; server-side regex strip `/<think>[\s\S]*?<\/think>/g` trước khi trả về |

---

## Module 11: UI/UX

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Sidebar layout | Layout với sidebar (272px) hiển thị AddCoursePanel, CourseList, và LessonList; scrollable độc lập | ✅ Hoàn thành | `page.tsx`, sidebar `<aside>` | Tailwind v4; sidebar cố định chiều rộng; main content chiếm phần còn lại |
| Split panel view | Giao diện hai panel: trái hiển thị transcript, phải là AI assistant; responsive về 1 cột trên màn hình nhỏ | ✅ Hoàn thành | `page.tsx` main content grid | `grid-cols-1 xl:grid-cols-2`; cả hai panel luôn hiển thị song song trên xl+ |
| shadcn/ui component library | Sử dụng primitives từ shadcn/ui để xây dựng giao diện nhất quán | ✅ Hoàn thành | Toàn bộ UI components | Components: Button, Input, Textarea, Dialog, Select, Card, Tabs, ScrollArea, Separator, Badge; Radix UI + Tailwind v4 |
| Giao diện tiếng Việt | Toàn bộ text UI hiển thị bằng tiếng Việt | ✅ Hoàn thành | Toàn bộ UI strings | Labels, placeholders, buttons, error messages, AI prompts output đều bằng tiếng Việt |

---

## API Routes (đầy đủ)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/courses` | Lấy tất cả khóa học kèm lessons | |
| `POST` | `/api/courses` | Tạo khóa học mới | |
| `GET` | `/api/courses/[id]` | Lấy chi tiết khóa học | |
| `DELETE` | `/api/courses/[id]` | Xóa khóa học (cascade) | |
| `GET` | `/api/courses/[id]/ai` | Lấy AI data cấp khóa học (roadmap) | Dùng để load persisted roadmap |
| `POST` | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học | |
| `POST` | `/api/courses/upload` | Upload file transcript → tạo khóa học hoặc thêm bài học | Nhận `courseId` (thêm vào) hoặc `courseTitle` (tạo mới); Zod validation |
| `GET` | `/api/lessons/[id]/ai` | Lấy AI data cấp bài học | summary, explanation, quiz, flashcards, exercises |
| `PUT` | `/api/lessons/[id]/transcript` | Cập nhật transcript bài học | |
| `POST` | `/api/ai/summary` | Tạo AI summary; persist → `Lesson.summary` | Cache guard + `force` flag |
| `POST` | `/api/ai/explain` | Tạo AI explanation; persist → `Lesson.explanation` | Cache guard + `force` flag |
| `POST` | `/api/ai/chat` | Streaming chat (Server-Sent Events) | Không persist; không cache |
| `POST` | `/api/ai/roadmap` | Tạo lộ trình toàn khóa; persist → `Course.roadmap` | Course-level; Cache guard + `force` flag |
| `POST` | `/api/ai/quiz` | Tạo Quiz/Flashcard/Exercises; persist → Lesson | Param: `mode: "quiz" \| "flashcards" \| "exercises"`; Cache guard + `force` flag |
| `POST` | `/api/ai/models` | Lấy danh sách model từ provider | |
| `POST` | `/api/udemy/courses` | Lấy danh sách khóa học đã enroll từ Udemy | |
| `POST` | `/api/udemy/import` | Import khóa học, lessons, transcripts từ Udemy | |

---

## Data Model (Prisma Schema)

```prisma
model Course {
  id        String   @id @default(cuid())
  url       String   @unique
  title     String
  roadmap   String?           // AI-generated course roadmap
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
  summary     String?           // AI-generated lesson summary
  explanation String?           // AI-generated lesson explanation
  roadmap     String?           // Reserved (không dùng hiện tại)
  quiz        String?           // AI-generated quiz
  flashcards  String?           // AI-generated flashcard set
  exercises   String?           // AI-generated practice exercises
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19 |
| Database ORM | Prisma + SQLite |
| AI SDK | OpenAI SDK (OpenAI-compatible) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI primitives) |
| Language | TypeScript |
| Validation | Zod |
| Deploy | Docker (docker-compose, port 3939) |
