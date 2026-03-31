# Danh sách Tính năng - Udemy App

## Tổng quan

| Module | Tổng số tính năng | Hoàn thành | Đang phát triển | Kế hoạch |
|--------|-------------------|------------|-----------------|----------|
| Quản lý Khóa học | 4 | 4 | 0 | 0 |
| Udemy Import | 2 | 2 | 0 | 0 |
| Upload & Tạo khóa học từ file | 4 | 4 | 0 | 0 |
| Upload Sách/Giáo trình | 3 | 3 | 0 | 0 |
| Quản lý Transcript | 3 | 3 | 0 | 0 |
| AI Assistant — Bài học | 4 | 4 | 0 | 0 |
| AI Assistant — Luyện tập (Interactive) | 3 | 3 | 0 | 0 |
| AI Assistant — Lộ trình | 1 | 1 | 0 | 0 |
| AI Cache & Persistence | 4 | 4 | 0 | 0 |
| Cài đặt (Multi-Profile) | 5 | 5 | 0 | 0 |
| Prompt Engineering | 4 | 4 | 0 | 0 |
| UI/UX | 4 | 4 | 0 | 0 |
| Ghi chú bài học (Lesson Notes) | 2 | 2 | 0 | 0 |
| Theo dõi tiến độ (Progress Tracking) | 4 | 4 | 0 | 0 |
| Ôn tập lặp lại (SRS — Spaced Repetition) | 4 | 4 | 0 | 0 |
| Phân tích học tập (Learning Analytics) | 2 | 2 | 0 | 0 |
| Xuất nội dung (Export) | 2 | 2 | 0 | 0 |
| Hồ sơ người học (Learner Profile) | 1 | 1 | 0 | 0 |
| Lưu lịch sử Chat (Chat Persistence) | 3 | 3 | 0 | 0 |
| Quản lý bài học nâng cao (Lesson Management) | 3 | 3 | 0 | 0 |
| Course Collections/Tags | 1 | 1 | 0 | 0 |
| **Tổng cộng** | **56** | **56** | **0** | **0** |

> **Ghi chú:** Nhiều tính năng từ Module 13–21 hiện chỉ có backend (API routes + Prisma models). UI integration đang trong kế hoạch (xem `docs/roadmap.md`).

---

## Module 1: Quản lý Khóa học (Course Management)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Tạo khóa học thủ công | Người dùng tự tạo khóa học mới bằng cách nhập tên | ✅ Hoàn thành | `POST /api/courses` | Lưu vào SQLite qua Prisma; `url` là `null` khi tạo thủ công |
| Danh sách khóa học | Hiển thị toàn bộ khóa học đã tạo hoặc import vào hệ thống | ✅ Hoàn thành | `GET /api/courses` | Trả về danh sách kèm lessons, sắp xếp theo ngày tạo giảm dần |
| Xóa khóa học | Xóa khóa học và toàn bộ dữ liệu liên quan (lessons, transcripts, AI results, progress, chat, SRS) | ✅ Hoàn thành | `DELETE /api/courses/[id]` | Cascade delete qua Prisma relations; xóa tất cả lessons và dữ liệu liên quan |
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

## Module 4: Upload Sách/Giáo trình (v2.0)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Upload sách (PDF/EPUB/DOCX/TXT/MD) | Upload file sách → tạo Course với `contentType="book"` | ✅ Hoàn thành | `POST /api/books/upload`, `POST /api/books` | Multipart upload; hỗ trợ PDF, EPUB, DOCX, TXT, MD; `POST /api/books` tạo book stub (2-step flow) |
| Tự động chia chương (Chapter Splitting) | Heuristic + AI detect headings/chapter breaks → preview → xác nhận | ✅ Hoàn thành | `POST /api/books/split`, `POST /api/books/split/confirm` | Heuristic detection + AI fallback; hiển thị preview chapters; user confirm → tạo Lessons |
| Xóa sách | Xóa sách qua API (cùng route với xóa course) | ✅ Hoàn thành | `DELETE /api/books` | Gọi lại `DELETE /api/courses/[id]` logic; cascade delete |

---

## Module 5: Quản lý Transcript

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Xem transcript trong panel | Hiển thị nội dung transcript của bài học trong panel bên trái giao diện | ✅ Hoàn thành | UI component: `TranscriptPanel` | Render plain text; hỗ trợ scroll dài; hiển thị bài học không có transcript |
| Chỉnh sửa và lưu transcript | Cho phép người dùng chỉnh sửa thủ công nội dung transcript rồi lưu lại | ✅ Hoàn thành | `PUT /api/lessons/[id]/transcript` | Textarea editable; save on button click; cập nhật state local ngay sau khi lưu |
| Tự động import transcript từ Udemy | Transcript được kéo tự động khi import khóa học từ Udemy | ✅ Hoàn thành | `POST /api/udemy/import` | Tích hợp trong luồng import; không cần thao tác thêm |

---

## Module 6: AI Assistant — Bài học

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Summary | Tóm tắt bài học theo phong cách Instructional Designer, tự động điều chỉnh độ dài (600–2500+ từ), có câu hỏi theo Bloom's Taxonomy và kỹ thuật mnemonic | ✅ Hoàn thành | `POST /api/ai/summary` | Persona: Instructional Designer; output calibrated by transcript length; Bloom's Taxonomy levels; mnemonic techniques; kết quả được persist vào `Lesson.summary`; hỗ trợ `contentType` param cho book |
| AI Explain | Giải thích khái niệm theo kỹ thuật Feynman, tự phân loại Format A/B/Hybrid theo phần trăm code, gom nhóm các bước khi có hơn 10 steps | ✅ Hoàn thành | `POST /api/ai/explain` | Feynman technique; auto-classify format dựa trên code%; phase grouping khi >10 steps; hỗ trợ `selectedText` optional field; kết quả persist vào `Lesson.explanation` |
| AI Chat (streaming + persistent) | Chat đa lượt với streaming, nhận diện 7 loại câu hỏi, hỗ trợ Socratic mode, lưu lịch sử chat | ✅ Hoàn thành | `POST /api/ai/chat` + `GET/POST/DELETE /api/lessons/[id]/chat` | Multi-turn streaming via SSE; 7 question types detection; Socratic mode; chat history persist vào `ChatMessage` model; load lịch sử khi chọn lại bài học |
| AI Model Selection | Lấy danh sách model từ bất kỳ OpenAI-compatible provider nào để hiển thị trong dropdown | ✅ Hoàn thành | `POST /api/ai/models` | Compatible với OpenAI, OpenRouter, Ollama, LM Studio; fetch `/models` endpoint dynamically từ base URL |

---

## Module 7: AI Assistant — Luyện tập (Interactive Practice)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Quiz (Interactive) | Tạo bộ quiz kiểm tra kiến thức bài học: trắc nghiệm, đúng/sai, điền khuyết, trả lời ngắn, hoàn thành code (nếu có code). 8–12 câu, phân bố theo Bloom's Taxonomy 3 mức độ, có đáp án và giải thích chi tiết. **UI tương tác**: click chọn đáp án, chấm điểm tự động, hiển thị đáp án đúng/sai | ✅ Hoàn thành | `POST /api/ai/quiz` + `QuizPlayer.tsx` | Persona: Assessment Designer; `QuizPlayer` parse markdown output → render câu hỏi tương tác; click chọn đáp án → highlight đúng/sai; persist vào `Lesson.quiz` |
| AI Flashcard (Flip) | Tạo bộ flashcard ôn tập theo SRS và Minimum Information Principle: 15–25 thẻ, 5 loại thẻ. **UI tương tác**: lật thẻ (flip animation), prev/next navigation, hiển thị tiến trình | ✅ Hoàn thành | `POST /api/ai/quiz` + `FlashcardDeck.tsx` | `FlashcardDeck` parse markdown → render thẻ có mặt trước/sau; click để lật; điều hướng qua từng thẻ; persist vào `Lesson.flashcards` |
| AI Bài tập thực hành (Accordion) | Tạo bài tập luyện tập theo Deliberate Practice và PBL: 3–5 bài. **UI tương tác**: accordion expandable, mở rộng để xem lời giải tham khảo | ✅ Hoàn thành | `POST /api/ai/quiz` + `ExerciseList.tsx` | `ExerciseList` parse markdown → render bài tập dạng accordion; click mở rộng/thu gọn; có rubric + lời giải; persist vào `Lesson.exercises` |

---

## Module 8: AI Assistant — Lộ trình học tập

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Roadmap toàn khóa | Phân tích TOÀN BỘ các bài học trong khóa để đề xuất lộ trình học tập cá nhân hóa: tổng quan khóa, phân giai đoạn, bản đồ kiến thức, phương pháp học tối ưu, dự án tổng hợp, kế hoạch tuần | ✅ Hoàn thành | `POST /api/ai/roadmap` | Course-level (không phụ thuộc bài học đang chọn); aggregate tất cả transcripts (truncate mỗi bài tới 4000 chars); kết quả persist vào `Course.roadmap`; Persona: Learning Consultant (Andragogy + Deliberate Practice); hỗ trợ `contentType` param cho book |

---

## Module 9: AI Cache & Persistence

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Lưu kết quả AI theo bài học | Summary, Explanation, Quiz, Flashcard, Exercises tự động lưu vào DB sau mỗi lần generate; load lại khi chọn lại bài học | ✅ Hoàn thành | `GET /api/lessons/[id]/ai` | AI results persist vào các trường tương ứng trong `Lesson`; load khi `lesson.id` thay đổi; không cần regenerate mỗi lần |
| Lưu kết quả AI theo khóa học | Roadmap được lưu vào `Course.roadmap`; load lại khi chọn lại khóa học | ✅ Hoàn thành | `GET /api/courses/[id]/ai` | Course-level persistence trong `Course.roadmap`; load khi `courseId` thay đổi |
| Cache guard trên AI routes | Tất cả AI routes (summary, explain, quiz, roadmap) kiểm tra DB trước khi gọi AI; nếu đã có kết quả → trả về ngay | ✅ Hoàn thành | Tất cả `POST /api/ai/*` routes | Kiểm tra field tương ứng trong Lesson/Course trước khi gọi OpenAI; giảm chi phí API và thời gian chờ |
| Force regenerate | Gửi `"force": true` trong request body để bỏ qua cache, gọi AI lại và ghi đè kết quả cũ | ✅ Hoàn thành | Tất cả `POST /api/ai/*` routes + UI button "Tạo lại" | UI hiển thị nút "Tạo lại" khi đã có kết quả cached; backend xóa field cũ trước khi generate mới |

---

## Module 10: Cài đặt Multi-Profile (Settings)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Multi-profile AI | Tạo, chuyển đổi, xóa nhiều profile AI — mỗi profile có base URL, API key, model, Udemy cookie riêng | ✅ Hoàn thành | `SettingsModal` | `AIProfile` type: `{ id, name, baseUrl, apiKey, model, udemyCookie, cachedModels[] }`; lưu trong localStorage key `udemy_ai_profiles` với shape `{ profiles: AIProfile[], activeId: string }` |
| Cấu hình AI provider per-profile | Mỗi profile có base URL, API key, model dropdown riêng | ✅ Hoàn thành | `SettingsModal` | Base URL cho phép dùng bất kỳ OpenAI-compatible API; model list fetch động từ `/models` endpoint; cached trong profile |
| Cấu hình Udemy cookie per-profile | Mỗi profile có `access_token` cookie riêng | ✅ Hoàn thành | `SettingsModal` | Cookie được lưu client-side trong profile; gửi kèm request khi gọi Udemy API |
| Hiển thị profile hiện tại trên Header | Header hiển thị "Tên profile / model" khi đã cấu hình | ✅ Hoàn thành | `Header.tsx` | Đọc active profile từ localStorage; hiển thị `profile.name / profile.model` |
| Auto-migrate từ settings cũ | Tự động migrate từ `udemy_ai_settings` (single config) sang `udemy_ai_profiles` (multi-profile) | ✅ Hoàn thành | `SettingsModal` | Chạy một lần khi load; tạo profile "Default" từ settings cũ; xóa key cũ sau khi migrate |

---

## Module 11: Prompt Engineering

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| DRY prompt architecture | Các builder function dùng chung cho nhiều prompt, tránh lặp lại logic | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Shared functions: `buildASRRules(inferenceSource, fallback?)`, `buildLanguageRules(translationStyle)`; `getSystemPrompt(type, contentType?)` dispatcher; 7 prompt types × 2 content types (course + book) |
| ASR degradation handling | Tự động phát hiện transcript chất lượng thấp (từ ASR) và điều chỉnh cách xử lý | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Parameterized per-prompt: Chat có fallback đặc biệt (gợi ý xem lại video); Roadmap/Practice có context-aware inference; **bỏ hoàn toàn** cho book content type |
| Code-switching support | Hỗ trợ transcript có ngôn ngữ pha trộn (Tiếng Việt + English) | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Xử lý mixed-language input; giữ thuật ngữ kỹ thuật tiếng Anh trong ngoặc; `buildLanguageRules` với style khác nhau cho từng prompt type |
| Think-tag suppression | Chặn model output thẻ `<think>` (reasoning models như DeepSeek) | ✅ Hoàn thành | Tất cả routes AI + `src/lib/ai/prompts.ts` + `src/lib/strip-think.ts` | Mỗi system prompt có dòng `KHÔNG bao giờ xuất thẻ <think>`; server-side regex strip `/<think>[\s\S]*?<\/think>/g` trước khi trả về |

---

## Module 12: UI/UX

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Sidebar layout | Layout với sidebar (272px) hiển thị AddCoursePanel, CourseList, và LessonList; scrollable độc lập | ✅ Hoàn thành | `page.tsx`, sidebar `<aside>` | Tailwind v4; sidebar cố định chiều rộng; main content chiếm phần còn lại |
| Split panel view | Giao diện hai panel: trái hiển thị transcript, phải là AI assistant; responsive về 1 cột trên màn hình nhỏ | ✅ Hoàn thành | `page.tsx` main content grid | `grid-cols-1 xl:grid-cols-2`; cả hai panel luôn hiển thị song song trên xl+ |
| shadcn/ui component library | Sử dụng primitives từ shadcn/ui để xây dựng giao diện nhất quán | ✅ Hoàn thành | Toàn bộ UI components | Components: Button, Input, Textarea, Dialog, Select, Card, Tabs, ScrollArea, Separator, Badge; Radix UI + Tailwind v4 |
| Giao diện tiếng Việt | Toàn bộ text UI hiển thị bằng tiếng Việt | ✅ Hoàn thành | Toàn bộ UI strings | Labels, placeholders, buttons, error messages, AI prompts output đều bằng tiếng Việt |

---

## Module 13: Ghi chú bài học (Lesson Notes)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Ghi chú theo bài học | Mỗi bài học có field `notes` để người dùng ghi chú riêng | ✅ Backend | `GET/PUT /api/lessons/[id]/notes` | Lưu vào `Lesson.notes` (nullable text); Markdown support |
| Tìm kiếm ghi chú xuyên khóa học | Tìm kiếm full-text trong tất cả ghi chú của một khóa học | ✅ Backend | `GET /api/courses/[id]/notes/search` | Full-text search across all lesson notes trong cùng course |

---

## Module 14: Theo dõi tiến độ (Progress Tracking)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Đánh dấu hoàn thành bài học | Ghi nhận lesson complete + quiz score | ✅ Backend | `POST /api/lessons/[id]/progress` | Tạo/update `LessonProgress`; lưu `completed`, `completedAt`, `quizScore` |
| Theo dõi thời gian học | Ghi nhận thời gian học từng bài (incremental) | ✅ Backend | `PATCH /api/lessons/[id]/progress` | Cộng dồn `timeSpentMs`, cập nhật `flashcardsMastered`/`flashcardsTotal` |
| Tiến độ khóa học tổng thể | Tính phần trăm hoàn thành toàn khóa học | ✅ Backend | `GET /api/courses/[id]/progress` | Trả về `CourseProgress` gồm `completionPct`, streak, `totalTimeSpentMs` + danh sách lesson progress |
| Chuỗi học tập (Study Streak) | Tính toán current streak và longest streak | ✅ Backend | `POST /api/lessons/[id]/progress` (calculateStreak) | Tính streak dựa trên `lastStudiedAt` so với ngày hôm nay; cập nhật `currentStreak` và `longestStreak` |

---

## Module 15: Ôn tập lặp lại — SRS (Spaced Repetition System)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Khởi tạo SRS cho flashcards | Tạo FlashcardReview records từ bộ flashcard đã generate | ✅ Backend | `POST /api/lessons/[id]/srs/init` | Tạo 1 record per card với `easinessFactor=2.5`, `interval=0`, `nextReviewAt=now()` |
| Lấy thẻ cần ôn tập (due cards) | Lấy danh sách flashcard đến hạn review | ✅ Backend | `GET /api/lessons/[id]/srs/due` | Filter `nextReviewAt <= now()` |
| Gửi kết quả review (SM-2 algorithm) | Cập nhật SRS state sau khi user đánh giá chất lượng nhớ (quality 0-5) | ✅ Backend | `POST /api/lessons/[id]/srs/review` | SM-2 algorithm: tính `easinessFactor`, `interval`, `repetitions`, `nextReviewAt` dựa trên `quality`; logic trong `src/lib/srs.ts` |
| Dashboard SRS toàn cục | Xem tổng quan thẻ cần ôn tập across tất cả lessons | ✅ Backend | `GET /api/srs/dashboard` | Aggregate due cards từ tất cả `FlashcardReview` records |

---

## Module 16: Phân tích học tập (Learning Analytics)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Analytics tổng quan | Thống kê toàn bộ: tổng khóa, tổng bài, thời gian học, điểm trung bình | ✅ Backend | `GET /api/analytics/overview` | Aggregate stats across all courses |
| Analytics theo khóa học | Thống kê chi tiết cho 1 khóa: completion %, streak, thời gian, quiz scores | ✅ Backend | `GET /api/analytics/course/[id]` | Per-course analytics với streak calculation |

---

## Module 17: Xuất nội dung (Export)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Export toàn khóa học | Xuất tất cả nội dung AI (summary, quiz, flashcards) của khóa học ra file | ✅ Backend | `POST /api/export/course/[id]` | Xuất Markdown hoặc CSV; gom tất cả lessons |
| Export bài học đơn lẻ | Xuất nội dung AI của 1 bài học ra file | ✅ Backend | `POST /api/export/lesson/[id]` | Xuất Markdown hoặc CSV cho single lesson |

---

## Module 18: Hồ sơ người học (Learner Profile / Pre-Assessment)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Hồ sơ cá nhân hóa AI theo khóa học | Mỗi khóa có profile riêng: level, goal, thời gian học, known topics, learning style | ✅ Backend | `GET/PUT /api/courses/[id]/profile` | `LearnerProfile` model; dùng để cá nhân hóa AI prompts (Explain, Roadmap, Practice) |

---

## Module 19: Lưu lịch sử Chat (Chat Persistence)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Lưu tin nhắn chat | Mỗi tin nhắn (user + assistant) được persist vào DB | ✅ Backend | `POST /api/lessons/[id]/chat` | `ChatMessage` model: `role` (user/assistant), `content`, `lessonId`, `createdAt` |
| Load lịch sử chat | Tải lại toàn bộ lịch sử chat khi chọn bài học | ✅ Backend | `GET /api/lessons/[id]/chat` | Trả về tất cả messages sorted by `createdAt` asc |
| Xóa lịch sử chat | Xóa toàn bộ chat history của một bài học | ✅ Backend | `DELETE /api/lessons/[id]/chat` | Xóa tất cả `ChatMessage` where `lessonId` |

---

## Module 20: Quản lý bài học nâng cao (Advanced Lesson Management)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Xem chi tiết bài học | Lấy thông tin đầy đủ 1 bài học | ✅ Hoàn thành | `GET /api/lessons/[id]` | Trả về tất cả fields của Lesson |
| Sửa bài học | Cập nhật title, transcript, etc. | ✅ Hoàn thành | `PUT /api/lessons/[id]` | Update bất kỳ field nào của Lesson |
| Sắp xếp lại bài học (Lesson Reorder) | Kéo thả để sắp xếp lại thứ tự bài học trong khóa | ✅ Hoàn thành | `POST /api/courses/[id]/lessons/reorder` | Nhận mảng ID mới → update `order` field; optimistic UI |

---

## Module 21: Course Collections/Tags

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Quản lý collection/tags cho khóa học | CRUD tags/collections per course | ✅ Backend | `GET/POST/DELETE /api/courses/[id]/collection` | Phân loại và tổ chức khóa học |

---

## API Routes (đầy đủ)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/courses` | Lấy tất cả khóa học kèm lessons | |
| `POST` | `/api/courses` | Tạo khóa học mới | |
| `GET` | `/api/courses/[id]` | Lấy chi tiết khóa học | |
| `DELETE` | `/api/courses/[id]` | Xóa khóa học (cascade) | |
| `GET` | `/api/courses/[id]/ai` | Lấy AI data cấp khóa học (roadmap) | |
| `PUT` | `/api/courses/[id]/ai` | Cập nhật AI data cấp khóa học | |
| `POST` | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học | |
| `POST` | `/api/courses/[id]/lessons/reorder` | Sắp xếp lại thứ tự bài học | Nhận mảng ID |
| `GET` | `/api/courses/[id]/progress` | Lấy tiến độ khóa học + tất cả lesson progress | |
| `GET/PUT` | `/api/courses/[id]/profile` | Lấy/cập nhật Learner Profile | AI personalization |
| `GET/POST/DELETE` | `/api/courses/[id]/collection` | CRUD course collection/tags | |
| `GET` | `/api/courses/[id]/notes/search` | Tìm kiếm ghi chú xuyên khóa học | Full-text search |
| `POST` | `/api/courses/upload` | Upload file transcript → tạo khóa học hoặc thêm bài học | Zod validation |
| `GET` | `/api/lessons/[id]` | Lấy chi tiết bài học | |
| `PUT` | `/api/lessons/[id]` | Cập nhật bài học | |
| `DELETE` | `/api/lessons/[id]` | Xóa bài học | |
| `GET` | `/api/lessons/[id]/ai` | Lấy AI data cấp bài học | summary, explanation, quiz, flashcards, exercises |
| `PUT` | `/api/lessons/[id]/ai` | Cập nhật AI data cấp bài học | |
| `PUT` | `/api/lessons/[id]/transcript` | Cập nhật transcript bài học | |
| `GET/PUT` | `/api/lessons/[id]/notes` | Lấy/cập nhật ghi chú bài học | |
| `POST` | `/api/lessons/[id]/progress` | Đánh dấu hoàn thành (+ quiz score) | Tạo/update LessonProgress |
| `PATCH` | `/api/lessons/[id]/progress` | Cập nhật thời gian học incremental | timeSpentMs, flashcard counts |
| `GET/POST/DELETE` | `/api/lessons/[id]/chat` | Lấy/lưu/xóa lịch sử chat | ChatMessage persistence |
| `GET` | `/api/lessons/[id]/srs/due` | Lấy flashcard cần ôn tập | Filter nextReviewAt <= now |
| `POST` | `/api/lessons/[id]/srs/init` | Khởi tạo SRS records | 1 FlashcardReview per card |
| `POST` | `/api/lessons/[id]/srs/review` | Gửi kết quả review SM-2 | Update easinessFactor, interval |
| `GET` | `/api/srs/dashboard` | Dashboard SRS toàn cục | Due cards across all lessons |
| `GET` | `/api/analytics/overview` | Thống kê tổng quan | Aggregate all courses |
| `GET` | `/api/analytics/course/[id]` | Thống kê theo khóa học | Per-course with streak |
| `POST` | `/api/export/course/[id]` | Xuất nội dung AI toàn khóa | Markdown/CSV |
| `POST` | `/api/export/lesson/[id]` | Xuất nội dung AI bài học đơn | Markdown/CSV |
| `POST` | `/api/ai/summary` | Tạo AI summary | Cache guard + `force` + `contentType` |
| `POST` | `/api/ai/explain` | Tạo AI explanation | Cache guard + `force` + `contentType` |
| `POST` | `/api/ai/chat` | Streaming chat (SSE) | Socratic mode; `contentType` |
| `POST` | `/api/ai/roadmap` | Tạo lộ trình toàn khóa | Course-level; `contentType` |
| `POST` | `/api/ai/quiz` | Tạo Quiz/Flashcard/Exercises | `mode` param; `contentType` |
| `POST` | `/api/ai/models` | Lấy danh sách model từ provider | |
| `POST` | `/api/books` | Tạo book stub (contentType="book") | 2-step flow |
| `DELETE` | `/api/books` | Xóa sách | |
| `POST` | `/api/books/upload` | Upload sách (PDF/EPUB/DOCX/TXT/MD) | Multipart |
| `POST` | `/api/books/split` | Chapter splitting preview | Heuristic + AI |
| `POST` | `/api/books/split/confirm` | Xác nhận chapters → tạo Lessons | |
| `POST` | `/api/udemy/courses` | Lấy danh sách khóa học từ Udemy | |
| `POST` | `/api/udemy/import` | Import khóa học từ Udemy | |

---

## Data Model (Prisma Schema — Thực tế)

```prisma
model Course {
  id             String           @id @default(cuid())
  url            String?          @unique
  title          String
  contentType    String           @default("course")  // "course" | "book"
  author         String?                               // Tác giả sách
  isbn           String?                               // Mã ISBN
  publisher      String?                               // Nhà xuất bản
  roadmap        String?                               // AI-generated roadmap / reading plan
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
  chapterNumber    Int?                               // Số thứ tự chương sách
  pageRange        String?                            // "12-34" — phạm vi trang
  transcript       String?
  summary          String?                            // AI-generated summary
  explanation      String?                            // AI-generated explanation
  quiz             String?                            // AI-generated quiz
  flashcards       String?                            // AI-generated flashcard set
  exercises        String?                            // AI-generated exercises
  notes            String?                            // Ghi chú người dùng
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  progress         LessonProgress?
  flashcardReviews FlashcardReview[]
  chatMessages     ChatMessage[]
}

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
  courseId          String
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

model FlashcardReview {
  id             String   @id @default(cuid())
  lessonId       String
  lesson         Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  cardIndex      Int
  easinessFactor Float    @default(2.5)
  interval       Int      @default(0)
  repetitions    Int      @default(0)
  nextReviewAt   DateTime @default(now())
  lastQuality    Int      @default(0)
  totalReviews   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([lessonId, cardIndex])
}

model LearnerProfile {
  id            String   @id @default(cuid())
  courseId      String
  course        Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  level         String
  goal          String
  dailyTimeMin  Int
  knownTopics   String?
  learningStyle String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([courseId])
}

model ChatMessage {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  role      String                                   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
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
