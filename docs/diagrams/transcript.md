# Diagrams: Transcript

## Flow Diagrams

### Xem và chỉnh sửa Transcript

Người dùng xem transcript ở chế độ ReadOnly mặc định, có thể chuyển sang Edit để chỉnh sửa nội dung.

```mermaid
flowchart TD
    A([Chọn bài học]) --> B[Load transcript từ server]
    B --> C{Transcript tồn tại?}
    C -->|Không| D[Hiển thị trạng thái trống]
    C -->|Có| E[Hiển thị ReadOnly mode - mặc định]
    D --> F[Gợi ý upload transcript]

    E --> G{Người dùng click Edit?}
    G -->|Không| E
    G -->|Có| H[Chuyển sang EditMode]
    H --> I[Người dùng chỉnh sửa nội dung]
    I --> J{Hành động?}
    J -->|Click Save| K[PUT /api/lessons/id/transcript]
    J -->|Click Cancel| L{Có thay đổi chưa lưu?}
    L -->|Không| E
    L -->|Có| M[Hiển thị confirm dialog]
    M -->|Hủy thay đổi| E
    M -->|Tiếp tục chỉnh sửa| H
    K --> N{Lưu thành công?}
    N -->|Thất bại| O[Hiển thị error - giữ trong EditMode]
    N -->|Thành công| E
    O --> H
```

### Tìm kiếm trong Transcript

Người dùng dùng Ctrl+F để tìm kiếm từ khóa và điều hướng qua các kết quả.

```mermaid
flowchart TD
    A([Nhấn Ctrl+F]) --> B[Search bar xuất hiện]
    B --> C[Người dùng nhập từ khóa]
    C --> D{Có kết quả?}
    D -->|Không tìm thấy| E[Hiển thị: Không có kết quả]
    D -->|Có kết quả| F[Highlight tất cả matches]
    F --> G[Focus vào match đầu tiên]
    G --> H{Người dùng điều hướng?}
    H -->|Click Next hoặc Enter| I[Focus match tiếp theo]
    H -->|Click Prev| J[Focus match trước đó]
    H -->|Nhấn Escape| K[Đóng search bar]
    H -->|Xóa keyword| L{Còn keyword?}
    I --> H
    J --> H
    L -->|Có| C
    L -->|Không| M[Bỏ highlight tất cả]
    M --> H
    K --> N([Trở về ReadOnly bình thường])
```

### Highlight để Giải thích (AI Explain)

Người dùng chọn đoạn text, nhận giải thích AI cho đoạn đó.

```mermaid
flowchart TD
    A([Người dùng chọn text trong transcript]) --> B{Có text được chọn?}
    B -->|Không| C([Không có gì xảy ra])
    B -->|Có| D[Floating button xuất hiện]
    D --> E{Người dùng click Giai thich doan nay?}
    E -->|Không / Click ra ngoài| F[Button biến mất]
    F --> C
    E -->|Có| G[POST /api/ai/explain với selectedText]
    G --> H[Tab Explain kích hoạt]
    H --> I{API đang xử lý}
    I -->|Đang chờ| J[Hiển thị loading indicator]
    I -->|Thành công| K[Hiển thị giải thích AI]
    I -->|Thất bại| L[Hiển thị error trong tab Explain]
    J --> I
    K --> M([Người dùng đọc giải thích])
    L --> N([Người dùng thử lại])
```

### Copy Transcript

```mermaid
flowchart TD
    A([Người dùng click Copy button]) --> B[Clipboard.write toàn bộ nội dung]
    B --> C{Copy thành công?}
    C -->|Thất bại| D[Hiển thị error toast]
    C -->|Thành công| E[Hiển thị toast: Da sao chep]
    E --> F[Icon thay đổi thành checkmark]
    F --> G[Chờ 2 giây]
    G --> H[Icon trở lại biểu tượng copy]
    D --> I([Kết thúc])
    H --> I
```

---

## State Diagram: TranscriptPanel Modes

Sơ đồ trạng thái mô tả các chế độ hoạt động của TranscriptPanel và điều kiện chuyển đổi.

```mermaid
stateDiagram-v2
    [*] --> ReadOnly: Load bài học - trạng thái mặc định

    ReadOnly --> EditMode: Click nút Edit
    ReadOnly --> SearchActive: Nhấn Ctrl+F
    ReadOnly --> HighlightToExplain: Chọn text trong transcript

    EditMode --> ReadOnly: Save thành công
    EditMode --> ReadOnly: Cancel - không có thay đổi
    EditMode --> EditMode: Cancel - có thay đổi chưa lưu - người dùng chọn tiếp tục chỉnh sửa
    EditMode --> ReadOnly: Cancel - người dùng xác nhận hủy thay đổi

    SearchActive --> ReadOnly: Nhấn Escape hoặc đóng search bar
    SearchActive --> SearchActive: Nhập keyword - điều hướng prev/next

    HighlightToExplain --> ReadOnly: Click ra ngoài hoặc bỏ chọn text
    HighlightToExplain --> ReadOnly: Sau khi gửi yêu cầu giải thích - tab Explain mở

    note right of EditMode
        Unsaved changes:
        Cảnh báo khi người dùng
        rời EditMode mà chưa lưu
    end note

    note right of SearchActive
        Có thể đồng thời với
        HighlightToExplain
    end note
```
