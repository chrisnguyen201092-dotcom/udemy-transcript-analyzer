# Diagrams: Lesson Management

## Flow Diagrams

### Thêm bài học mới

Người dùng tạo bài học mới trong khóa học, hệ thống tự động gán thứ tự cuối cùng.

```mermaid
flowchart TD
    A([Người dùng click Thêm bài học]) --> B[Nhập tiêu đề bài học]
    B --> C{Tiêu đề hợp lệ?}
    C -->|Không| D[Hiển thị validation error]
    D --> B
    C -->|Có| E[POST /api/courses/id/lessons]
    E --> F[Lesson tạo với order = max + 1]
    F --> G[Cập nhật danh sách bài học]
    G --> H([Bài học mới hiển thị cuối danh sách])
```

### Xóa bài học

Xóa bài học cascade xóa transcript và dữ liệu AI liên quan.

```mermaid
flowchart TD
    A([Hover vào bài học]) --> B[Hiển thị context menu]
    B --> C[Click Xóa]
    C --> D[Hiển thị Confirm Dialog]
    D --> E{Người dùng xác nhận?}
    E -->|Hủy| F([Đóng dialog])
    E -->|Xác nhận| G[DELETE /api/lessons/id]
    G --> H[Cascade xóa transcript và AI data]
    H --> I[Cập nhật danh sách]
    I --> J([Hoàn thành])
```

### Đổi tên bài học

Người dùng double-click để chỉnh sửa tên bài học trực tiếp trong danh sách.

```mermaid
flowchart TD
    A([Double-click vào tên bài học]) --> B[Chuyển sang Inline Edit mode]
    B --> C[Người dùng chỉnh sửa nội dung]
    C --> D{Hành động?}
    D -->|Nhấn Enter| E{Tên đã thay đổi?}
    D -->|Nhấn Escape| F[Hủy thay đổi - trở về Default]
    D -->|Click ra ngoài| E
    E -->|Không thay đổi| F
    E -->|Có thay đổi| G[PATCH /api/lessons/id]
    G --> H{API thành công?}
    H -->|Thất bại| I[Hiển thị error - giữ tên cũ]
    H -->|Thành công| J[Cập nhật tên bài học]
    F --> K([Trở về Default])
    I --> K
    J --> K
```

### Sắp xếp lại thứ tự bài học

Người dùng kéo thả để thay đổi thứ tự bài học, UI cập nhật ngay lập tức (optimistic update).

```mermaid
flowchart TD
    A([Drag bài học]) --> B[Optimistic UI: cập nhật thứ tự ngay]
    B --> C[Drop vào vị trí mới]
    C --> D[PUT /api/courses/id/lessons/reorder]
    D --> E{API thành công?}
    E -->|Thành công| F([Giữ nguyên thứ tự mới])
    E -->|Thất bại| G[Rollback về thứ tự cũ]
    G --> H[Hiển thị error message]
    H --> I([Danh sách trở về trước khi kéo])
```

---

## State Diagram: Trạng thái Lesson Item

Sơ đồ trạng thái mô tả các trạng thái tương tác của một bài học trong danh sách.

```mermaid
stateDiagram-v2
    [*] --> Default: Bài học được load

    Default --> Hover: Chuột di vào
    Hover --> Default: Chuột di ra
    Hover --> ContextMenu: Click menu icon
    ContextMenu --> Default: Click ra ngoài hoặc Escape
    ContextMenu --> Deleting: Click Xóa

    Default --> Editing: Double-click vào tên
    Editing --> Default: Escape hoặc Click ra ngoài - không thay đổi
    Editing --> Default: Enter hoặc Blur - lưu thành công
    Editing --> Default: API lỗi - rollback tên cũ

    Default --> Selected: Click chọn bài học
    Selected --> Default: Click bài học khác
    Selected --> Editing: Double-click khi đang Selected
    Selected --> ContextMenu: Click menu icon khi Selected

    Deleting --> Default: Hủy dialog
    Deleting --> [*]: Xác nhận xóa
```
