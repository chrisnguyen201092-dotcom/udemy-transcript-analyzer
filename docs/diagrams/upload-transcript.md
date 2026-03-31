# Diagrams: Upload Transcript

## Flow Diagrams

### Luồng Upload tổng quan

Người dùng upload file transcript (.vtt/.srt/.txt), hệ thống đọc và parse file phía client trước khi gửi lên server.

```mermaid
flowchart TD
    A([Người dùng click Upload]) --> B[UploadModal mở]
    B --> C[Chọn file - .vtt, .srt, .txt]
    C --> D{File hợp lệ?}
    D -->|Sai định dạng| E[Hiển thị lỗi định dạng file]
    E --> C
    D -->|Hợp lệ| F[FileReader đọc file phía client]
    F --> G[POST /api/courses/upload - JSON payload]
    G --> H[Server parse nội dung theo định dạng]
    H --> I[Tạo Lessons từ nội dung đã parse]
    I --> J{Tất cả file thành công?}
    J -->|Tất cả thành công| K[State: Success]
    J -->|Một phần thất bại| L[State: PartialSuccess - hiển thị chi tiết]
    J -->|Tất cả thất bại| M[State: Error]
    K --> N[Modal tự đóng]
    L --> O[Hiển thị kết quả - người dùng đóng thủ công]
    M --> P[Hiển thị lỗi - người dùng thử lại]
```

### Parse logic theo định dạng

Server xử lý nội dung khác nhau tùy theo định dạng file.

```mermaid
flowchart TD
    A([Nhận nội dung file]) --> B{Định dạng?}

    B -->|.vtt| C[Bỏ qua header WEBVTT]
    C --> D[Loại bỏ dòng timestamp]
    D --> E[Loại bỏ dòng trùng lặp liên tiếp]
    E --> F[Ghép thành transcript text]

    B -->|.srt| G[Loại bỏ số thứ tự sequence]
    G --> H[Loại bỏ dòng timestamp]
    H --> I[Loại bỏ dòng trùng lặp liên tiếp]
    I --> F

    B -->|.txt| J[Trim khoảng trắng đầu cuối]
    J --> F

    F --> K([Trả về nội dung đã xử lý])
```

### Luồng xử lý nhiều file

```mermaid
flowchart TD
    A([Bắt đầu upload batch]) --> B[Lặp qua từng file]
    B --> C[FileReader đọc file i]
    C --> D[Parse nội dung theo định dạng]
    D --> E{Còn file nào nữa không?}
    E -->|Có| B
    E -->|Không| F[Gộp tất cả vào payload JSON]
    F --> G[POST /api/courses/upload]
    G --> H[Server tạo Lessons hàng loạt]
    H --> I{Kết quả?}
    I -->|Tất cả OK| J[State: Success]
    I -->|Một số lỗi| K[State: PartialSuccess]
    I -->|Lỗi hoàn toàn| L[State: Error - hiển thị nguyên nhân]
```

---

## State Diagram: Trạng thái Upload

Sơ đồ trạng thái mô tả vòng đời của quá trình upload từ lúc mở modal đến khi hoàn thành.

```mermaid
stateDiagram-v2
    [*] --> Idle: Mở UploadModal

    Idle --> FilesSelected: Người dùng chọn file hợp lệ
    FilesSelected --> Idle: Xóa tất cả file đã chọn
    FilesSelected --> Uploading: Click Upload
    FilesSelected --> FilesSelected: Thêm hoặc bỏ file

    Uploading --> Success: Tất cả file được tạo thành công
    Uploading --> PartialSuccess: Một số file thất bại
    Uploading --> Error: Tất cả file thất bại hoặc lỗi server

    Success --> [*]: Modal tự động đóng

    PartialSuccess --> Idle: Người dùng đóng modal
    PartialSuccess --> FilesSelected: Người dùng thử lại với file lỗi

    Error --> Idle: Người dùng đóng modal
    Error --> FilesSelected: Người dùng thử lại
```
