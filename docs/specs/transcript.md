# Spec: Xem & Chỉnh sửa Transcript

## Goal
Cho phép người dùng xem transcript của bài học đang chọn và chỉnh sửa trực tiếp trong giao diện, sau đó lưu lại.

## User Stories
- Là học viên, tôi muốn xem toàn bộ transcript của bài học để đọc lại nội dung
- Là học viên, tôi muốn chỉnh sửa transcript bị lỗi (ASR noise) để AI hoạt động chính xác hơn
- Là học viên, tôi muốn lưu transcript đã chỉnh sửa mà không mất dữ liệu AI đã tạo

## Acceptance Criteria
- [ ] Khi chọn bài học → `TranscriptPanel` hiển thị `transcript` của bài học đó
- [ ] Nếu `transcript` là `null` → hiển thị trạng thái trống với hướng dẫn upload hoặc chỉnh sửa
- [ ] Transcript hiển thị trong `textarea` có thể chỉnh sửa
- [ ] Người dùng chỉnh sửa nội dung → click "Lưu" → hệ thống gọi `PUT /api/lessons/[id]/transcript`
- [ ] Sau khi lưu thành công → hiển thị toast/thông báo "Đã lưu"
- [ ] Transcript mới được dùng cho các tính năng AI tiếp theo trong cùng session

## Edge Cases
- Transcript rất dài (> 50,000 ký tự) → textarea vẫn hoạt động, không bị lỗi UI
- Người dùng thay đổi nội dung rồi chuyển sang bài học khác mà chưa lưu → không có warning hiện tại (acceptable v1)
- Lưu transcript rỗng → server chấp nhận (cho phép xóa trắng transcript)
- Save lỗi network → hiển thị thông báo lỗi, nội dung đã chỉnh sửa không bị mất (vẫn trong textarea)

## API Contract

### PUT /api/lessons/[id]/transcript
**Request:**
```json
{ "transcript": "string" }
```
**Response 200:**
```json
{
  "id": "string",
  "transcript": "string",
  "updatedAt": "string"
}
```
**Errors:**
- `400` — `transcript` field bị thiếu trong body (null/undefined, khác với chuỗi rỗng)
- `404` — lesson not found
- `500` — lỗi DB

## Data Model Changes
Không có thay đổi schema. Cập nhật field `transcript` trong bảng `Lesson`.

## UI Notes
- `TranscriptPanel`: layout full-height, textarea chiếm phần lớn không gian
- Nút "Lưu" ở góc trên phải panel, disable khi nội dung chưa thay đổi
- Khi transcript là null: hiển thị placeholder text "Chưa có transcript. Upload file hoặc nhập thủ công."
- Font monospace hoặc readable font cho textarea, line-height thoải mái để dễ đọc

---

## Tính năng mới: Tìm kiếm trong Transcript

### Goal
Cho phép học viên tìm kiếm từ khóa hoặc cụm từ ngay trong transcript, với kết quả được highlight và điều hướng qua từng kết quả khớp — tương tự Ctrl+F trong trình duyệt.

### User Stories
- Là học viên, tôi muốn tìm nhanh một khái niệm hoặc từ khóa trong transcript dài mà không cần đọc từ đầu
- Là học viên, tôi muốn thấy bao nhiêu vị trí khớp với từ tôi tìm để ước lượng mức độ xuất hiện
- Là học viên, tôi muốn điều hướng tuần tự qua từng kết quả khớp (trước/sau) để đọc từng đoạn có liên quan

### Acceptance Criteria
- [ ] Thanh tìm kiếm (search bar) hiển thị trong `TranscriptPanel`, có thể ẩn/hiện bằng phím tắt `Ctrl+F` hoặc nút icon kính lúp
- [ ] Người dùng nhập từ khóa → tất cả vị trí khớp trong transcript được highlight (màu vàng hoặc tương tự)
- [ ] Kết quả hiện tại (active match) được highlight khác màu so với các kết quả còn lại (ví dụ: cam vs vàng)
- [ ] Footer thanh tìm kiếm hiển thị số lượng kết quả dạng "3 / 12 kết quả"
- [ ] Nút "Tiếp theo" (▼) và "Trước đó" (▲) điều hướng tuần tự qua từng kết quả khớp; kết quả active tự động scroll vào viewport
- [ ] Khi đến kết quả cuối cùng, nhấn "Tiếp theo" → quay về kết quả đầu tiên (wrap around)
- [ ] Không có kết quả khớp → hiển thị "0 kết quả" và thanh tìm kiếm có viền màu đỏ nhạt
- [ ] Nhấn `Escape` hoặc nút X → đóng thanh tìm kiếm, xóa highlight, giữ nguyên vị trí scroll
- [ ] Tìm kiếm không phân biệt hoa thường (case-insensitive) theo mặc định
- [ ] Tìm kiếm hoạt động ở cả chế độ read-only và edit mode

### Edge Cases
- Từ khóa rỗng → không highlight gì, hiển thị "0 kết quả"
- Transcript rỗng hoặc null → thanh tìm kiếm disable hoặc hiển thị "Không có nội dung để tìm kiếm"
- Transcript rất dài (> 50,000 ký tự) với nhiều kết quả (> 500 matches) → chỉ render highlight cho matches trong vùng hiển thị (virtual rendering), không làm chậm UI
- Người dùng đang chỉnh sửa transcript (edit mode) → highlight tìm kiếm vẫn hiển thị, không conflict với cursor chỉnh sửa
- Từ khóa có ký tự đặc biệt regex (ví dụ: `(`, `[`, `*`) → escape trước khi dùng trong regex, không gây lỗi runtime

### API Contract
Không có thay đổi API. Tính năng này hoàn toàn client-side: tìm kiếm trong chuỗi transcript đang hiển thị trên UI.

### UI Notes
- Thanh tìm kiếm xuất hiện ở trên cùng của vùng transcript (floating bar hoặc sticky bar), không che nội dung
- Input field chiếm phần lớn thanh; bên phải có: badge đếm kết quả, nút ▲ ▼, nút X
- Khi tìm kiếm active: khu vực hiển thị transcript chuyển sang dạng HTML render (thay textarea) để hỗ trợ highlight với `<mark>` tag
- Phím tắt: `Ctrl+F` mở thanh tìm kiếm; `F3` / `Shift+F3` điều hướng next/prev; `Escape` đóng
- Animation nhẹ khi scroll đến kết quả active (smooth scroll)

---

## Tính năng mới: Highlight để Giải thích (Highlight-to-Explain)

### Goal
Cho phép học viên chọn (bôi đen) bất kỳ đoạn văn bản nào trong transcript, sau đó gửi ngay đoạn đó tới AI Explain để nhận giải thích tức thì — không cần copy-paste hay chuyển tab thủ công.

### User Stories
- Là học viên, tôi muốn bôi đen một câu khó hiểu và nhận giải thích ngay lập tức mà không cần rời khỏi transcript
- Là học viên, tôi muốn gửi đúng đoạn văn tôi đang thắc mắc để AI hiểu chính xác ngữ cảnh
- Là học viên, tôi muốn thao tác highlight-to-explain nhanh chỉ bằng một cú click

### Acceptance Criteria
- [ ] Khi người dùng chọn (bôi đen) một đoạn text trong transcript → floating button "Giải thích đoạn này" xuất hiện gần vị trí con trỏ/cuối vùng chọn
- [ ] Floating button chỉ xuất hiện khi có text được chọn (ít nhất 1 ký tự không phải whitespace)
- [ ] Nhấn floating button → hệ thống gọi `POST /api/ai/explain` với `{ lessonId, selectedText: <đoạn đã bôi đen> }`
- [ ] Tab "Giải thích" trong `AIAssistantPanel` tự động được active để hiển thị kết quả
- [ ] Kết quả giải thích xuất hiện trong tab Explain, có indicator loading trong lúc AI xử lý
- [ ] Floating button tự biến mất khi người dùng click ra ngoài vùng chọn hoặc sau khi đã nhấn
- [ ] Tính năng này hoạt động ở chế độ read-only; ở edit mode vẫn hiện floating button nếu có text được chọn
- [ ] Khi `selectedText` quá dài (> 2000 ký tự) → truncate và thêm ghi chú "[đoạn được cắt bớt]" vào cuối trước khi gửi

### Edge Cases
- Người dùng chọn text rồi nhấn Ctrl+C (copy) → floating button không chen vào, hành vi copy hoạt động bình thường
- Người dùng chọn text nhưng transcript đang ở trạng thái loading → floating button không hiển thị
- Bài học không có `lessonId` hợp lệ → disable tính năng, không hiện floating button
- Mạng bị mất khi đang gọi AI Explain → hiển thị thông báo lỗi trong tab Explain, không crash UI
- Người dùng bôi đen đoạn text có chứa newline hoặc tab → normalize whitespace trước khi gửi (replace `\n`, `\t` bằng dấu cách)
- Floating button bị che bởi edge màn hình → reposition tự động để không vượt ra ngoài viewport

### API Contract

Sử dụng lại endpoint hiện có, không cần thay đổi:

#### POST /api/ai/explain
**Request (cập nhật):**
```json
{
  "lessonId": "string",
  "selectedText": "string (đoạn text người dùng đã bôi đen)",
  "force": "boolean (optional, default: false)"
}
```
> `selectedText` được ưu tiên hơn logic explain mặc định. Server dùng `selectedText` làm nội dung cần giải thích thay vì dùng toàn bộ transcript. Transcript vẫn được đính kèm vào system prompt để AI có ngữ cảnh bài học.

**Response:** Giữ nguyên format hiện tại.

### UI Notes
- Floating button: style nhỏ gọn (pill shape), icon sparkle ✨ + text "Giải thích đoạn này", shadow nhẹ
- Vị trí: ngay phía trên hoặc dưới vùng text đã chọn (ưu tiên phía trên, fallback xuống dưới nếu gần đầu trang)
- Animation: fade-in 150ms khi xuất hiện, fade-out khi biến mất
- Sau khi nhấn, button chuyển sang trạng thái loading (spinner nhỏ) rồi biến mất
- Khi tab Explain đang ở panel khác → panel AI tự mở hoặc scroll vào view; tab "Giải thích" được focus

---

## Tính năng mới: Hiển thị Số từ và Ký tự

### Goal
Hiển thị thống kê nhanh về độ dài transcript (số ký tự, số từ) ở footer của `TranscriptPanel` để học viên ước lượng khối lượng nội dung và thời gian đọc.

### User Stories
- Là học viên, tôi muốn biết transcript này dài bao nhiêu từ để ước tính thời gian đọc
- Là học viên, tôi muốn xem số ký tự để biết AI sẽ xử lý bao nhiêu nội dung

### Acceptance Criteria
- [ ] Footer của `TranscriptPanel` hiển thị số từ (word count) và số ký tự (character count) của transcript hiện tại
- [ ] Định dạng hiển thị: "1,234 từ · 8,567 ký tự" (dấu phẩy ngăn cách hàng nghìn)
- [ ] Khi người dùng chỉnh sửa transcript (edit mode) → word count và character count cập nhật real-time theo nội dung đang nhập
- [ ] Khi transcript là null hoặc rỗng → hiển thị "0 từ · 0 ký tự"
- [ ] Word count đếm đúng với nội dung tiếng Việt (split theo whitespace, loại bỏ chuỗi rỗng)

### Edge Cases
- Transcript chứa nhiều whitespace liên tiếp → word count chỉ đếm các từ thực sự (trim + split `/\s+/`)
- Transcript chứa các ký tự đặc biệt (emoji, ký tự Unicode) → character count đếm theo số codepoint Unicode, không phải byte
- Transcript rất dài (> 100,000 ký tự) → tính toán word count không làm chậm render (debounce 300ms khi typing)
- Người dùng đang typing nhanh → debounce 300ms trước khi cập nhật word count để tránh tính toán quá nhiều lần

### API Contract
Không có thay đổi API. Tính năng này hoàn toàn client-side: đếm từ và ký tự trực tiếp từ state của transcript trong component.

### UI Notes
- Vị trí: footer cuối `TranscriptPanel`, căn phải hoặc căn giữa
- Font size nhỏ (text-xs hoặc text-sm), màu muted để không gây phân tâm
- Không có border riêng, nằm gọn trong footer row cùng với các thông tin khác nếu có
- Cập nhật số liệu mượt mà (không flash/giật) khi nội dung thay đổi

---

## Tính năng mới: Nút Copy Transcript

### Goal
Cho phép học viên sao chép toàn bộ nội dung transcript vào clipboard chỉ bằng một click, với xác nhận bằng toast thông báo.

### User Stories
- Là học viên, tôi muốn copy toàn bộ transcript để dán vào tool khác (Notion, Google Docs, v.v.) mà không cần chọn tất cả thủ công
- Là học viên, tôi muốn xác nhận rằng hành động copy đã thành công qua thông báo rõ ràng

### Acceptance Criteria
- [ ] Nút "Sao chép" (hoặc icon clipboard) hiển thị trong header của `TranscriptPanel`
- [ ] Nhấn nút → toàn bộ nội dung transcript được copy vào clipboard
- [ ] Sau khi copy thành công → hiển thị toast "Đã sao chép transcript!" trong 2 giây
- [ ] Nếu transcript rỗng hoặc null → nút bị disable, không thể nhấn
- [ ] Nút copy hoạt động ở cả chế độ read-only và edit mode (copy nội dung đang hiển thị, bao gồm cả chỉnh sửa chưa lưu)
- [ ] Icon nút chuyển sang trạng thái "đã copy" (icon checkmark) trong 2 giây rồi trở về icon clipboard

### Edge Cases
- Trình duyệt không hỗ trợ Clipboard API (`navigator.clipboard`) → fallback dùng `document.execCommand('copy')` hoặc hiển thị thông báo "Không thể copy tự động, vui lòng dùng Ctrl+A và Ctrl+C"
- Người dùng từ chối quyền clipboard → hiển thị thông báo lỗi thân thiện thay vì crash
- Transcript rất dài (> 1MB) → copy vẫn hoạt động bình thường; toast xuất hiện sau khi clipboard write hoàn tất
- Nhấn copy nhiều lần liên tiếp → mỗi lần đều copy thành công và reset lại 2 giây countdown của icon

### API Contract
Không có thay đổi API. Tính năng này hoàn toàn client-side: dùng `navigator.clipboard.writeText()`.

### UI Notes
- Vị trí nút: header của `TranscriptPanel`, bên cạnh nút toggle read-only/edit và nút Lưu
- Icon: clipboard (khi chưa copy) → checkmark xanh (khi vừa copy xong, trong 2 giây)
- Tooltip khi hover: "Sao chép toàn bộ transcript"
- Toast xuất hiện ở góc dưới phải màn hình, style nhất quán với các toast khác trong app

---

## Tính năng mới: Chế độ Đọc và Chỉnh sửa (Read-only / Edit Mode Toggle)

### Goal
Tách biệt rõ ràng giữa chế độ đọc (read-only) và chỉnh sửa (edit mode) trong `TranscriptPanel`. Mặc định hiển thị ở chế độ đọc để tối ưu trải nghiệm đọc nội dung; chỉ chuyển sang edit mode khi người dùng chủ động muốn sửa transcript.

### User Stories
- Là học viên, tôi muốn đọc transcript trong giao diện sạch sẽ không có textarea cồng kềnh để tập trung vào nội dung
- Là học viên, tôi muốn dễ dàng chuyển sang chế độ chỉnh sửa khi cần sửa lỗi ASR
- Là học viên, tôi chỉ muốn thấy nút "Lưu" khi tôi đang ở chế độ chỉnh sửa, không phải lúc nào cũng hiện
- Là học viên, tôi muốn chỉnh sửa xong và quay lại chế độ đọc không mất nội dung đã sửa (chưa lưu)

### Acceptance Criteria
- [ ] `TranscriptPanel` mặc định ở **chế độ đọc** (read-only) khi tải bài học
- [ ] Chế độ đọc hiển thị transcript dạng text thuần (không phải textarea), có thể chọn text, scroll, dễ đọc
- [ ] Nút toggle "Chỉnh sửa" hiển thị ở header panel ở chế độ đọc; nhấn → chuyển sang chế độ chỉnh sửa
- [ ] Chế độ chỉnh sửa hiển thị transcript trong `textarea` có thể gõ/sửa, giống hành vi cũ
- [ ] Nút "Lưu" chỉ hiển thị khi đang ở chế độ chỉnh sửa VÀ nội dung đã thay đổi so với bản lưu gần nhất
- [ ] Nút toggle ở chế độ chỉnh sửa đổi thành "Xong chỉnh sửa" hoặc icon close; nhấn → quay lại chế độ đọc
- [ ] Khi nhấn "Xong chỉnh sửa" mà có thay đổi chưa lưu → hiển thị confirm dialog: "Bạn có thay đổi chưa lưu. Lưu ngay hay tiếp tục không lưu?"
- [ ] Confirm dialog có 3 tùy chọn: "Lưu và thoát", "Thoát không lưu", "Hủy" (quay lại edit mode)
- [ ] Trạng thái mode (read-only / edit) được giữ nguyên khi component re-render; reset về read-only khi chuyển sang bài học khác
- [ ] Tính năng tìm kiếm (Ctrl+F), highlight-to-explain, copy, word count đều hoạt động ở cả hai chế độ

### Edge Cases
- Transcript null ở chế độ đọc → hiển thị placeholder "Chưa có transcript..." với nút "Thêm transcript" để chuyển thẳng vào edit mode
- Người dùng đang ở edit mode, nhấn F5 reload trang → tự động quay về read-only (không persist edit mode qua reload)
- Người dùng chuyển sang bài học khác khi đang ở edit mode có thay đổi chưa lưu → hiển thị cùng confirm dialog như khi nhấn "Xong chỉnh sửa"
- Edit mode với transcript rất dài → textarea có chiều cao cố định với `overflow-y: auto`, không làm layout bị vỡ
- Read-only mode với transcript rất dài → có scroll nội bộ, không ảnh hưởng scroll của page chính

### API Contract
Không có thay đổi API. Toggle mode là state hoàn toàn client-side trong `TranscriptPanel` component. API `PUT /api/lessons/[id]/transcript` chỉ được gọi khi người dùng xác nhận lưu.

### UI Notes
- Header panel: [icon bút / "Chỉnh sửa"] [icon copy] [badge mode: "Đang đọc" / "Đang sửa"] ... [nút "Lưu" (chỉ hiện ở edit mode)]
- Chế độ đọc: `div` với `prose` class hoặc style tương tự, padding thoải mái, line-height 1.7, text selectable
- Chế độ chỉnh sửa: `textarea` full-width full-height, font monospace hoặc readable, resize: none
- Transition giữa hai chế độ: fade hoặc instant (không cần animation phức tạp)
- Badge mode (nhỏ, subtle): "Đang đọc" màu xanh lá, "Đang sửa" màu cam để phân biệt nhanh
- Confirm dialog dùng `AlertDialog` từ shadcn/ui để đảm bảo nhất quán với design system
