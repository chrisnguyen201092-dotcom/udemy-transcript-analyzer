# Diagrams: Course Management

## Flow Diagrams

### Import from Udemy

Người dùng nhập access token để lấy danh sách khóa học từ Udemy, chọn khóa học, và import vào hệ thống.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Nhập Udemy Access Token]
    B --> C[POST /api/udemy/courses]
    C --> D{Token hợp lệ?}
    D -->|Không| E[Hiển thị lỗi: Token hết hạn]
    E --> B
    D -->|Có| F[Hiển thị danh sách khóa học]
    F --> G[Chọn khóa học]
    G --> H[POST /api/udemy/import]
    H --> I{URL đã tồn tại?}
    I -->|Có| J[Upsert khóa học]
    I -->|Không| K[Tạo mới Course + Lessons]
    J --> L([Hoàn thành: Course sẵn sàng])
    K --> L
```

### Tạo khóa học thủ công

Người dùng tạo khóa học mới bằng cách nhập tiêu đề trực tiếp, không cần kết nối Udemy.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Nhập tiêu đề khóa học]
    B --> C{Tiêu đề hợp lệ?}
    C -->|Không| D[Hiển thị validation error]
    D --> B
    C -->|Có| E[POST /api/courses]
    E --> F[Course tạo thành công - url=null]
    F --> G([Hiển thị trong danh sách])
```

### Xóa khóa học

Xóa khóa học sẽ cascade xóa toàn bộ lessons và dữ liệu liên quan.

```mermaid
flowchart TD
    A([Người dùng click Xóa]) --> B[Hiển thị Confirm Dialog]
    B --> C{Người dùng xác nhận?}
    C -->|Hủy| D([Đóng dialog, không thay đổi])
    C -->|Xác nhận| E[DELETE /api/courses/id]
    E --> F[Cascade xóa tất cả Lessons]
    F --> G{Đang xem khóa học này?}
    G -->|Có| H[Reset UI về trang danh sách]
    G -->|Không| I[Cập nhật danh sách]
    H --> J([Hoàn thành])
    I --> J
```

### Tổng quan luồng Course Management

```mermaid
flowchart TD
    Start([Trang chủ]) --> Q{Có khóa học không?}
    Q -->|Không| Empty[Trạng thái Empty - Hiển thị hướng dẫn]
    Q -->|Có| List[Danh sách khóa học]

    Empty --> Action{Chọn hành động}
    Action -->|Import từ Udemy| Import[Nhập Access Token]
    Action -->|Tạo thủ công| Manual[Nhập tiêu đề]

    Import --> FetchAPI[POST /api/udemy/courses]
    FetchAPI -->|Thất bại| TokenErr[Lỗi token - quay lại]
    FetchAPI -->|Thành công| SelectCourse[Chọn khóa học]
    SelectCourse --> ImportAPI[POST /api/udemy/import]
    ImportAPI --> List

    Manual --> CreateAPI[POST /api/courses]
    CreateAPI --> List

    List --> SelectAction{Thao tác}
    SelectAction -->|Chọn xem| ViewCourse[Xem khóa học]
    SelectAction -->|Xóa| DeleteConfirm[Confirm dialog]
    DeleteConfirm -->|Xác nhận| DeleteAPI[DELETE /api/courses/id]
    DeleteAPI -->|Còn khóa học| List
    DeleteAPI -->|Không còn| Empty
```

---

## State Diagram: Vòng đời Course

Sơ đồ trạng thái mô tả các trạng thái chính của giao diện quản lý khóa học.

```mermaid
stateDiagram-v2
    [*] --> Empty: Khởi động ứng dụng

    Empty --> HasCourses: Tạo hoặc import khóa học
    HasCourses --> Empty: Xóa khóa học cuối cùng
    HasCourses --> CourseSelected: Chọn một khóa học
    CourseSelected --> HasCourses: Bỏ chọn hoặc quay lại
    CourseSelected --> CourseSelected: Import thêm / Sửa tên
    CourseSelected --> HasCourses: Xóa khóa học đang xem - còn khóa học khác
    CourseSelected --> Empty: Xóa khóa học đang xem - không còn khóa học nào
```
