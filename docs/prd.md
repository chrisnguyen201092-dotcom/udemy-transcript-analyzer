# PRD: Udemy Learner

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 2.0  
> **Ngày:** 2026-03-30  
> **Trạng thái:** v1.1 đã triển khai · v2.0 đang thiết kế (Book/Textbook support)

---

## 1. Tổng quan sản phẩm

**Udemy Learner** là một ứng dụng web hỗ trợ học tập hiệu quả hơn nhờ AI. Ứng dụng cho phép import khóa học từ tài khoản Udemy, tạo khóa học từ file transcript cục bộ, hoặc **upload sách/giáo trình (PDF, EPUB, DOCX)** — sau đó dùng AI để tóm tắt, giải thích sâu, chat trực tiếp, luyện tập tương tác (quiz/flashcard/bài tập), và tạo lộ trình học tập cá nhân hóa.

Mục tiêu cốt lõi: **biến nội dung học tập thô (transcript, sách, tài liệu) thành kiến thức có cấu trúc**, giúp người học nắm bài nhanh hơn và sâu hơn.

> **v2.0 Note:** Từ phiên bản 2.0, app mở rộng từ "Udemy transcript analyzer" thành **"AI Learning Assistant đa nguồn"** — hỗ trợ cả sách, giáo trình, tài liệu bên cạnh video courses.

---

## 2. Vấn đề cần giải quyết

### 2.1 Vấn đề với khóa học video (v1.x)

Học viên Udemy gặp một số rào cản phổ biến:

- Transcript bài học thường dài, rời rạc, khó đọc lại
- Không có công cụ tóm tắt hay giải thích nội dung theo nhu cầu
- Phải chuyển qua lại nhiều tab để tra cứu khi học
- Không thể hỏi đáp tương tác với nội dung khóa học
- Không có cách luyện tập kiến thức vừa học một cách có hệ thống
- Khó định hướng học toàn khóa khi chưa biết tầm quan trọng của từng bài

### 2.2 Vấn đề với sách/giáo trình (v2.0)

Người đọc sách kỹ thuật và giáo trình gặp thêm các rào cản riêng:

- Sách dày hàng trăm trang, khó nắm được cấu trúc tổng thể và trọng tâm từng chương
- Không có công cụ AI tóm tắt hay giải thích từng chương sách một cách tương tác
- Không thể tự kiểm tra kiến thức đã đọc bằng quiz/flashcard tự động
- Thiếu lộ trình đọc: không biết nên đọc chương nào trước, chương nào có thể bỏ qua
- File sách (PDF, EPUB, DOCX) cần được parse và chia chương tự động — thao tác thủ công mất thời gian
- Thuật ngữ chuyên ngành rải rác khắp sách, khó tổng hợp thành glossary

**Udemy Learner** giải quyết tất cả vấn đề này trong một giao diện duy nhất — cho cả video courses lẫn sách/giáo trình.

---

## 3. Đối tượng người dùng

| Nhóm | Mô tả |
|------|-------|
| **Học viên kỹ thuật** | Lập trình viên, data scientist học khóa Udemy để nâng kỹ năng |
| **Self-learner** | Người tự học có tài khoản Udemy, muốn học có hệ thống hơn |
| **Người học từ file cục bộ** | Không cần Udemy — upload transcript từ máy tính để học với AI |
| **Người đọc sách/giáo trình** | Upload PDF/EPUB/DOCX sách → AI tóm tắt, giải thích, quiz theo chương **(v2.0)** |
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
7. **Upload sách/giáo trình (PDF, EPUB, DOCX)** và áp dụng toàn bộ AI features cho nội dung sách — tóm tắt chương, giải thích, quiz, flashcard, lộ trình đọc **(v2.0)**

---

## 5. Phạm vi (Scope)

### In Scope

- Import khóa học và transcript qua Udemy access token
- Tạo khóa học từ file `.vtt`, `.srt`, `.txt` hoặc thư mục — tự động tạo course + lessons
- **Upload sách/giáo trình từ file `.pdf`, `.epub`, `.docx`, `.txt`, `.md`** — tự động tạo course (contentType="book") + lessons (chương) **(v2.0)**
- **Auto chapter splitting** — phát hiện chương tự động từ heading/page break + AI-assisted detection + xác nhận thủ công **(v2.0)**
- **Book metadata** — lưu tác giả, ISBN, nhà xuất bản cho sách **(v2.0)**
- Quản lý khóa học và bài học thủ công (CRUD)
- Xem và chỉnh sửa transcript từng bài học
- AI Summary: tóm tắt bài học theo chuẩn giáo học pháp (Bloom's Taxonomy)
- AI Explain: giải thích sâu bằng kỹ thuật Feynman
- AI Chat: chat nhiều lượt có streaming với context bài học
- AI Practice: Quiz tương tác (clickable MCQ), Flashcard lật thẻ (SRS), Bài tập accordion (Deliberate Practice)
- AI Roadmap: phân tích toàn khóa, đề xuất lộ trình học tập cá nhân hóa
- **AI Prompt Adaptation cho sách** — prompt thay đổi theo contentType: bỏ ASR rules, đổi label "bài học"→"chương", thêm academic framing **(v2.0)**
- **UI Adaptation cho sách** — label, icon, badge phân biệt sách vs khóa học **(v2.0)**
- AI Cache: kết quả được lưu vào DB, trả về ngay khi đã có; hỗ trợ force-regenerate
- Multi-profile AI settings (base URL, API key, model, Udemy cookie per profile)
- Giao diện hoàn toàn bằng tiếng Việt
- Docker support cho deployment (port 3939)

### Out of Scope

- Xem video trực tiếp từ Udemy
- Đồng bộ tiến độ học lên Udemy
- Multi-user / authentication hệ thống
- Mobile app (chỉ web)
- Xuất nội dung ra PDF/Word (hiện hỗ trợ Markdown/CSV — xem Module Export)

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
| F-35 | ~~Lịch sử chat không persist giữa các phiên~~ → Đã triển khai Chat Persistence (v1.2) — xem Module 6.24. Lịch sử chat được lưu vào DB qua `ChatMessage` model |

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

### 6.12 Module: Schema & Content Type cho Sách (v2.0)

| ID | Yêu cầu |
|----|---------|
| B-00 | **[Bug fix]** Upload route `POST /api/courses/upload` set `url: ""` khi tạo course mới → vi phạm unique constraint khi tạo 2+ course. Đổi thành `url: "manual:{uuid}"` |
| B-01 | Thêm field `contentType String @default("course")` vào model Course để phân biệt "course" vs "book"; migration non-breaking, backward compatible |
| B-02 | Thêm fields `author`, `isbn`, `publisher` (nullable) vào Course cho metadata sách; chỉ hiển thị khi `contentType === "book"` |
| B-03 | Thêm fields `chapterNumber Int?`, `pageRange String?` vào Lesson cho metadata chương sách |

### 6.13 Module: Upload Sách (v2.0)

| ID | Yêu cầu |
|----|---------|
| B-04 | Upload file `.pdf`, server extract text từ từng trang bằng `pdf-parse` hoặc `pdfjs-dist` |
| B-05 | Upload file `.epub`, server extract text từ từng chapter bằng `epub2`; mỗi chapter tạo ra một Lesson riêng |
| B-06 | Upload file `.docx`, server extract text có cấu trúc heading bằng `mammoth`; tạo Lesson theo heading H1/H2 nếu có |
| B-07 | Upload `.txt` / `.md` chứa nội dung sách; markdown có heading `#` thì split theo heading thành các Lesson |
| B-08 | `UploadModal` thêm mode "Sách/Giáo trình" với dropzone mở rộng (`.pdf`, `.epub`, `.docx`, `.txt`, `.md`) và form metadata (tên sách bắt buộc, tác giả/ISBN/NXB tùy chọn) |

### 6.14 Module: AI Prompt Adaptation cho Sách (v2.0)

| ID | Yêu cầu |
|----|---------|
| B-09 | Mở rộng `getSystemPrompt(type)` thành `getSystemPrompt(type, contentType?)` — khi `contentType === "book"` trả về prompt variant dành cho sách; bỏ hoàn toàn `buildASRRules()` cho sách |
| B-10 | Prompt tóm tắt chương sách: academic structure, luận điểm chính, lập luận, trích dẫn; giữ Bloom's Taxonomy |
| B-11 | Prompt giải thích chương sách: Feynman Technique nhưng không giả định ASR noise; thay "video" → "chương/trang" |
| B-12 | Prompt luyện tập từ sách (quiz/flashcard/exercise): tham chiếu "trang/phần" thay vì "bài học", dùng "văn bản đã viết" thay vì "transcript" |

### 6.15 Module: UI Adaptation cho Sách (v2.0)

| ID | Yêu cầu |
|----|---------|
| B-13 | Sidebar hiển thị "Sách" thay vì "Khóa học", "Chương" thay vì "Bài học" khi `contentType === "book"` |
| B-14 | Icon/badge phân biệt sách vs khóa học trong CourseList (shadcn Badge hoặc Lucide icon) |
| B-15 | Hiển thị tác giả, ISBN (nếu có) trong sidebar khi chọn sách |
| B-16 | TranscriptPanel hiển thị "Nội dung chương" thay vì "Transcript" khi content type là book |

### 6.16 Module: Auto Chapter Splitting & Key Concepts (v2.0)

| ID | Yêu cầu |
|----|---------|
| B-17 | Upload 1 file PDF → hệ thống detect headings/chapter breaks bằng heuristic (regex, font size, page breaks) → tự tạo Lesson[] cho mỗi chương |
| B-18 | Nếu heuristic thất bại → AI phân tích TOC/tiêu đề trang đầu → đề xuất chapter boundaries; hiển thị cảnh báo "AI đề xuất, cần xác nhận" |
| B-19 | Sau auto-split → hiển thị preview chapters (modal bước 2), user có thể gộp/tách/đổi tên trước khi confirm tạo Lessons |
| B-20 | AI extract thuật ngữ, định nghĩa, concepts quan trọng từ mỗi chương; persist vào `Lesson.keyConcepts` (field mới, nullable JSON string) |
| B-21 | Aggregate key concepts từ tất cả chapters → glossary toàn sách; persist vào `Course.glossary` (field mới) |
| B-22 | AI Reading Plan cho sách: thứ tự đọc tối ưu, chương quan trọng, chương có thể skip; reuse `/api/ai/roadmap` với prompt adapted |
| B-23 | AI đánh giá độ khó mỗi chương (beginner/intermediate/advanced) kèm trong Reading Plan output |

### 6.17 Module: Tính năng nâng cao cho Sách (v2.0)

| ID | Yêu cầu |
|----|---------|
| B-24 | Concept cross-reference: AI detect khi concept X ở chương này liên quan đến concept Y ở chương khác → liên kết |
| B-25 | UI hiển thị links "Xem thêm ở chương..." trong AI output hoặc sidebar panel |
| B-26 | Generate knowledge graph data: AI phân tích toàn sách → nodes (concepts) + edges (relationships); persist JSON vào Course level |
| B-27 | Visual knowledge graph: render interactive graph, click node → jump to relevant chapter |
| B-28 | Difficulty-based quiz generation: quiz khó hơn/dễ hơn dựa trên SRS performance history |
| B-29 | Spaced repetition across chapters: ôn concept từ chương cũ dựa trên SRS cross-chapter |
| B-30 | Link chapter ↔ Udemy lesson: liên kết 1 chương sách với 1 bài Udemy cùng chủ đề (manual linking) |
| B-31 | Combined study view: xem nội dung sách + video transcript cùng lúc cho 1 topic |
| B-32 | Time-based study plan: "Tôi có 2 tuần" → AI tạo kế hoạch đọc theo ngày dựa trên chapters + difficulty |
| B-33 | Progress-aware replanning: cập nhật plan dựa trên progress thực tế (chapters đã đọc, quiz scores) |

### 6.18 Module: Lesson Notes (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-57 | Người dùng ghi chú riêng cho từng bài học; nội dung lưu vào `Lesson.notes` |
| F-58 | Hệ thống hỗ trợ tìm kiếm ghi chú toàn khóa qua `GET /api/courses/[id]/notes/search` |

### 6.19 Module: Progress Tracking (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-59 | Hệ thống theo dõi tiến độ từng bài học: trạng thái hoàn thành, thời gian học, điểm quiz, flashcard đã thuộc |
| F-60 | Hệ thống tổng hợp tiến độ toàn khóa: % hoàn thành, streak hiện tại/dài nhất, thời gian học tổng, ngày học gần nhất |
| F-61 | API `POST /api/lessons/[id]/progress` tạo/cập nhật tiến độ bài học; `PATCH` cập nhật từng field |
| F-62 | API `GET /api/courses/[id]/progress` trả về tiến độ tổng hợp toàn khóa |

### 6.20 Module: SRS Spaced Repetition (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-63 | Hệ thống áp dụng thuật toán SM-2 (SuperMemo 2) để lên lịch ôn tập flashcard; implementation tại `src/lib/srs.ts` |
| F-64 | API `POST /api/lessons/[id]/srs/init` khởi tạo `FlashcardReview` records cho tất cả flashcards của bài học |
| F-65 | API `POST /api/lessons/[id]/srs/review` nhận đánh giá chất lượng (0-5) từ người dùng, cập nhật easinessFactor, interval, nextReviewAt theo SM-2 |
| F-66 | API `GET /api/lessons/[id]/srs/due` trả về danh sách flashcards đến hạn ôn tập; `GET /api/srs/dashboard` trả về tổng quan SRS toàn hệ thống |

### 6.21 Module: Learning Analytics (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-67 | API `GET /api/analytics/overview` trả về tổng quan học tập: tổng khóa học, bài học, thời gian, streaks, flashcard stats |
| F-68 | API `GET /api/analytics/course/[id]` trả về phân tích chi tiết từng khóa: tiến độ bài học, quiz scores, SRS performance |

### 6.22 Module: Export (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-69 | API `POST /api/export/lesson/[id]` xuất nội dung bài học (transcript, summary, explanation, quiz, flashcards, exercises, notes) ra định dạng Markdown hoặc CSV |
| F-70 | API `POST /api/export/course/[id]` xuất toàn bộ nội dung khóa học (bao gồm tất cả bài học) ra Markdown hoặc CSV |

### 6.23 Module: Learner Profile / Pre-Assessment (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-71 | Mỗi khóa học có một `LearnerProfile` riêng, lưu: trình độ (`level`), mục tiêu (`goal`), thời gian học/ngày (`dailyTimeMin`), kiến thức đã biết (`knownTopics`), phong cách học (`learningStyle`). API: `GET/PUT /api/courses/[id]/profile` |

### 6.24 Module: Chat Persistence (v1.2 — đã triển khai backend)

| ID | Yêu cầu |
|----|---------|
| F-72 | Lịch sử chat được lưu vào DB qua model `ChatMessage` (role, content, lessonId, createdAt) |
| F-73 | API `GET /api/lessons/[id]/chat` trả về lịch sử chat đã lưu của bài học |
| F-74 | API `POST /api/lessons/[id]/chat` lưu tin nhắn mới; `DELETE /api/lessons/[id]/chat` xóa toàn bộ lịch sử |

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

### 8.2 Data Model (Actual — 7 models)

> **Lưu ý:** Schema dưới đây phản ánh trạng thái THỰC TẾ của `prisma/schema.prisma` tính đến v1.2. Các fields `glossary`, `keyConcepts`, `Lesson.roadmap` trong kế hoạch v2.0 CHƯA được thêm vào schema — sẽ thêm khi implement Tier 2.

```prisma
model Course {
  id             String           @id @default(cuid())
  url            String?          @unique  // nullable — manual courses dùng null
  title          String
  contentType    String           @default("course")  // v2.0: "course" | "book"
  author         String?          // v2.0: tác giả sách
  isbn           String?          // v2.0: mã ISBN
  publisher      String?          // v2.0: nhà xuất bản
  roadmap        String?          // AI-generated course roadmap / reading plan
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
  chapterNumber    Int?               // v2.0: số thứ tự chương sách
  pageRange        String?            // v2.0: "12-34" — phạm vi trang
  transcript       String?
  summary          String?            // AI-generated summary
  explanation      String?            // AI-generated explanation
  quiz             String?            // AI-generated quiz (JSON string)
  flashcards       String?            // AI-generated flashcard set (JSON string)
  exercises        String?            // AI-generated exercises (JSON string)
  notes            String?            // User notes — v1.2
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
  level         String              // beginner | intermediate | advanced
  goal          String              // mục tiêu học tập
  dailyTimeMin  Int                 // phút/ngày
  knownTopics   String?             // JSON string — topics đã biết
  learningStyle String              // visual | reading | kinesthetic | auditory
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([courseId])
}

model ChatMessage {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  role      String                  // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
}
```

> **v2.0 Planned additions** (chưa trong schema): `Course.glossary String?`, `Lesson.keyConcepts String?` — sẽ thêm khi implement Tier 2.

### 8.3 API Routes

> **Lưu ý:** Bảng dưới đây phản ánh TOÀN BỘ routes thực tế trong codebase tính đến v1.2.

#### Core — Course & Lesson Management

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/courses` | Lấy tất cả khóa học kèm lessons | |
| `POST` | `/api/courses` | Tạo khóa học mới | |
| `DELETE` | `/api/courses/[id]` | Xóa khóa học (cascade) | |
| `POST` | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học | |
| `PUT` | `/api/courses/[id]/lessons/reorder` | Sắp xếp lại thứ tự bài học | v1.2 |
| `POST` | `/api/courses/upload` | Upload file transcript → tạo khóa học hoặc thêm bài học | Zod validation |
| `GET` | `/api/lessons/[id]` | Lấy chi tiết bài học | |
| `PUT` | `/api/lessons/[id]` | Cập nhật bài học | |
| `DELETE` | `/api/lessons/[id]` | Xóa bài học | |
| `PUT` | `/api/lessons/[id]/transcript` | Cập nhật transcript bài học | |

#### AI Features

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/lessons/[id]/ai` | Lấy AI data cấp bài học | summary, explanation, quiz, flashcards, exercises |
| `GET` | `/api/courses/[id]/ai` | Lấy AI data cấp khóa học | Trả về `roadmap` |
| `POST` | `/api/ai/summary` | Tạo AI summary; persist → `Lesson.summary` | Cache guard + `force` flag; v2.0: nhận `contentType` |
| `POST` | `/api/ai/explain` | Tạo AI explanation; persist → `Lesson.explanation` | Cache guard + `force` flag; v2.0: nhận `contentType` |
| `POST` | `/api/ai/chat` | Streaming chat (Server-Sent Events) | Không persist tự động; v2.0: nhận `contentType` |
| `POST` | `/api/ai/roadmap` | Tạo lộ trình toàn khóa; persist → `Course.roadmap` | Course-level; Cache guard + `force` flag |
| `POST` | `/api/ai/quiz` | Tạo Quiz / Flashcard / Exercises | `mode: "quiz" \| "flashcards" \| "exercises"` |
| `POST` | `/api/ai/models` | Lấy danh sách model từ provider | |

#### Udemy Integration

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `POST` | `/api/udemy/courses` | Lấy danh sách khóa học đã enroll từ Udemy | |
| `POST` | `/api/udemy/import` | Import khóa học, lessons, transcripts từ Udemy | |

#### Book Upload (v2.0)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `POST` | `/api/books` | Tạo sách mới | |
| `POST` | `/api/books/upload` | Upload sách (PDF/EPUB/DOCX/TXT/MD) | multipart/form-data |
| `POST` | `/api/books/split` | Auto chapter splitting (heuristic + AI) | Trả về preview chapters |
| `POST` | `/api/books/split/confirm` | Xác nhận chapters → tạo Lessons | |
| `DELETE` | `/api/books` | Xóa sách | |

#### Lesson Notes (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/lessons/[id]/notes` | Lấy ghi chú bài học | |
| `PUT` | `/api/lessons/[id]/notes` | Cập nhật ghi chú bài học | |
| `GET` | `/api/courses/[id]/notes/search` | Tìm kiếm ghi chú toàn khóa | Query param: `q` |

#### Progress Tracking (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `POST` | `/api/lessons/[id]/progress` | Tạo tiến độ bài học | |
| `PATCH` | `/api/lessons/[id]/progress` | Cập nhật tiến độ bài học | Partial update |
| `GET` | `/api/courses/[id]/progress` | Lấy tiến độ tổng hợp khóa học | Bao gồm streak, completionPct |

#### SRS Spaced Repetition (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `POST` | `/api/lessons/[id]/srs/init` | Khởi tạo FlashcardReview records | Tạo record cho mỗi flashcard |
| `POST` | `/api/lessons/[id]/srs/review` | Ghi nhận đánh giá + cập nhật SM-2 | Body: `{ cardIndex, quality }` |
| `GET` | `/api/lessons/[id]/srs/due` | Lấy flashcards đến hạn ôn tập | |
| `GET` | `/api/srs/dashboard` | Tổng quan SRS toàn hệ thống | Due today, total reviews, streaks |

#### Learning Analytics (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/analytics/overview` | Tổng quan học tập toàn hệ thống | Courses, lessons, time, streaks |
| `GET` | `/api/analytics/course/[id]` | Phân tích chi tiết khóa học | Progress, scores, SRS stats |

#### Export (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `POST` | `/api/export/lesson/[id]` | Xuất bài học ra Markdown/CSV | Body: `{ format }` |
| `POST` | `/api/export/course/[id]` | Xuất toàn khóa ra Markdown/CSV | Body: `{ format }` |

#### Learner Profile (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/courses/[id]/profile` | Lấy learner profile khóa học | |
| `PUT` | `/api/courses/[id]/profile` | Tạo/cập nhật learner profile | Body: level, goal, dailyTimeMin, etc. |

#### Chat Persistence (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/lessons/[id]/chat` | Lấy lịch sử chat bài học | |
| `POST` | `/api/lessons/[id]/chat` | Lưu tin nhắn chat mới | |
| `DELETE` | `/api/lessons/[id]/chat` | Xóa toàn bộ lịch sử chat bài học | |

#### Course Collection (v1.2)

| Method | Endpoint | Chức năng | Ghi chú |
|--------|----------|-----------|---------|
| `GET` | `/api/courses/[id]/collection` | Lấy collection data khóa học | |

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
- `MarkdownRenderer` — render markdown content với syntax highlighting (v1.2)
- `ModeToggle` — chuyển đổi dark/light mode (v1.2)
- `OnboardingCard` — hướng dẫn người dùng mới, hiển thị 1 lần (v1.2)
- `ThemeProvider` — context provider cho theme system (v1.2)

**Custom hooks:**
- `useUrlState` — đồng bộ app state với URL search params (v1.2)
- `useMediaQuery` — responsive breakpoint detection (v1.2)
- `useKeyboardShortcuts` — keyboard shortcuts handler (v1.2)

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

### Flow 8: Upload sách/giáo trình (v2.0)

```
1. Người dùng click "Upload từ file" → UploadModal mở ra
2. Chuyển sang mode "Sách/Giáo trình" (tab/button switcher)
3. Nhập tên sách (bắt buộc); tùy chọn: tác giả, ISBN, nhà xuất bản
4. Chọn file .pdf / .epub / .docx / .txt / .md
5. Client gửi file lên POST /api/books/upload (multipart/form-data)
6. Server extract text:
   - PDF: pdf-parse → text toàn bộ → tạo 1 Lesson (Tier 1) hoặc auto-split (Tier 2)
   - EPUB: epub2 → mỗi chapter → 1 Lesson
   - DOCX: mammoth → split theo heading H1/H2
   - TXT/MD: parseTxt() mở rộng; MD split theo heading #
7. Course tạo với contentType = "book", metadata sách được lưu
8. Modal đóng, sách xuất hiện trong sidebar với icon/badge phân biệt
9. Các chương (Lessons) có thể dùng AI ngay (summary, explain, quiz...)
```

### Flow 9: Auto chapter splitting (v2.0 — Tier 2)

```
1. Sau upload file sách (Flow 8 bước 6), nếu file là PDF/DOCX lớn:
2. Server chạy heuristic detection: regex "Chapter X", font size, page breaks
3. Nếu tìm được ≥2 chương → trả về splitPreview
4. Nếu heuristic thất bại → AI phân tích TOC/tiêu đề → đề xuất boundaries
5. Client hiển thị modal bước 2 "Xem lại chương" (ChapterPreviewModal):
   - Danh sách chapters với tên, số trang, số từ
   - Badge "AI đề xuất" nếu dùng AI detection
   - Nút Đổi tên / Gộp / Xóa cho mỗi chapter
6. Người dùng điều chỉnh nếu cần → click "Xác nhận"
7. Client gửi POST /api/books/split/confirm → tạo Lesson records
8. Sidebar cập nhật danh sách chương mới
```

### Flow 10: Dùng AI cho chương sách (v2.0)

```
1. Người dùng chọn sách → chọn chương trong sidebar
2. Hệ thống load AI results đã lưu qua GET /api/lessons/[id]/ai
3. TranscriptPanel hiển thị "Nội dung chương" (không gọi "Transcript")
4. AIAssistantPanel hoạt động giống video course nhưng:
   - Prompt AI dùng book variant (không có ASR rules)
   - Nhãn UI: "chương" thay vì "bài học", "sách" thay vì "khóa học"
   - Tab Roadmap hiển thị "Kế hoạch đọc" thay vì "Lộ trình"
5. Tất cả AI features (summary, explain, chat, quiz, flashcard, exercise) hoạt động bình thường
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
| v2.0: PDF dạng scan/ảnh không extract được text | Cao | Hiển thị warning "PDF scan"; cho phép edit transcript thủ công; hỗ trợ OCR trong tương lai |
| v2.0: EPUB structure không chuẩn | Trung bình | Fallback tạo 1 Lesson duy nhất; cho phép manual split (B-19) |
| v2.0: Auto chapter splitting sai boundaries | Trung bình | Manual confirmation UI (B-19); luôn cho phép re-split |
| v2.0: Sách quá dài vượt AI context window | Trung bình | Chapter splitting chia nhỏ nội dung; truncate strategy đã có (4000 chars/lesson) |
| v2.0: File binary lớn (>50MB) | Thấp | Client-side size check trước upload; server reject 413 |
| v2.0: Knowledge graph AI hallucination | Trung bình | User review/edit graph; base on extracted key concepts (B-20) |

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

- Hỗ trợ nhiều ngôn ngữ giao diện
- PostgreSQL thay thế SQLite cho multi-user
- Tìm kiếm toàn văn qua transcripts

### v1.2 — Backend Feature Layer (đã triển khai backend, UI integration pending)

> Các features dưới đây đã có đầy đủ backend (Prisma models + API routes + business logic). UI integration sẽ được thực hiện trong Giai đoạn 2 của roadmap.

- **Lesson Notes** — ghi chú riêng cho từng bài học; tìm kiếm ghi chú toàn khóa (`Lesson.notes`, 2 routes + search)
- **Progress Tracking** — theo dõi tiến độ bài học và khóa học; streak, completionPct, timeSpent (`LessonProgress` + `CourseProgress`, 3 routes)
- **SRS Spaced Repetition** — SM-2 algorithm cho flashcard scheduling; init, review, due, dashboard (`FlashcardReview`, `src/lib/srs.ts`, 4 routes)
- **Learning Analytics** — tổng quan học tập và phân tích chi tiết khóa; phụ thuộc Progress + SRS data (2 routes)
- **Export** — xuất bài học/khóa học ra Markdown hoặc CSV (2 routes)
- **Learner Profile / Pre-Assessment** — profile học viên per-course: level, goal, dailyTime, learningStyle (`LearnerProfile`, 2 routes)
- **Chat Persistence** — lưu lịch sử chat vào DB, load lại khi quay lại bài (`ChatMessage`, 3 routes)

### v2.0 — Hỗ trợ Sách/Giáo trình (kế hoạch)

> Mở rộng từ "trợ lý học từ khóa Udemy" thành **"trợ lý học tập đa nguồn"**.

**Tier 0 — Prerequisite:**
- B-00: Fix upload URL unique constraint bug

**Tier 1 — Nền tảng (~2-3 ngày):**
- B-01 → B-03: Schema changes (contentType, metadata sách, metadata chương)
- B-04 → B-08: Upload sách (PDF, EPUB, DOCX, TXT/MD, UI mở rộng)
- B-09 → B-12: AI prompt adaptation (book-aware prompts, bỏ ASR rules)
- B-13 → B-16: UI adaptation (conditional labels, icons, metadata display)

**Tier 2 — Trải nghiệm nâng cao (~3-5 ngày):**
- B-17 → B-19: Auto chapter splitting (heuristic + AI + manual confirm)
- B-20 → B-21: Key concepts extraction + glossary
- B-22 → B-23: Reading plan + difficulty estimation

**Tier 3 — Tính năng nâng cao (~5-10 ngày):**
- B-24 → B-25: Cross-reference giữa chapters
- B-26 → B-27: Knowledge graph
- B-28 → B-29: Adaptive quizzing
- B-30 → B-31: Multi-source learning (sách ↔ Udemy)
- B-32 → B-33: Study plan generator

---

## 12. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|----------|-----------|
| Feature List (đầy đủ) | `docs/features.md` |
| Prompt Engineering Guide | `docs/educational-prompt-engineering.md` |
| Prompts Design | `docs/PROMPTS_DESIGN.md` |
| Implementation Order | `docs/implementation-order.md` |
| Feature List: Sách/Giáo trình (v2.0) | `docs/features-book.md` |
| Spec: Schema & Content Type cho Sách | `docs/specs/book-schema.md` |
| Spec: Upload Sách/Giáo trình | `docs/specs/book-upload.md` |
| Spec: Book-Aware AI Prompt Adaptation | `docs/specs/book-ai.md` |
| Spec: Tự động chia chương sách | `docs/specs/book-chapter-splitting.md` |
| Source code | https://github.com/chrisnguyen201092-dotcom/udemy-transcript-analyzer |
