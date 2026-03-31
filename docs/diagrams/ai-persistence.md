# Diagrams: AI Persistence

## Flow Diagram

Persistence is the data-loading layer that drives all AI tabs. An AbortController cancels in-flight requests when the user switches lessons or courses, preventing stale data from populating the wrong tab.

```mermaid
flowchart TD
    A([selectedLessonId thay doi]) --> B[Huy request cu\nAbortController.abort]
    B --> C[GET /api/lessons/id/ai\nvoi AbortSignal moi]
    C --> D{Request thanh cong?}
    D -->|Bi huy| E[Bo qua, doi request moi]
    D -->|Loi mang| ERR[Hien thi trang thai Error]
    D -->|Thanh cong| F[Nhan AI data payload]

    F --> G[Populate Summary tab:\nnull = hien nut Generate\nco data = hien thi noi dung]
    F --> H[Populate Explanation tab:\nnull = hien nut Generate\nco data = hien thi noi dung]
    F --> I[Populate Quiz sub-tab:\nnull = hien nut Generate\nco data = hien thi noi dung]
    F --> J[Populate Flashcard sub-tab:\nnull = hien nut Generate\nco data = hien thi noi dung]
    F --> K[Populate Exercises sub-tab:\nnull = hien nut Generate\nco data = hien thi noi dung]

    COURSE([selectedCourseId thay doi]) --> BC[Huy request cu\nAbortController.abort]
    BC --> CC[GET /api/courses/id/ai\nvoi AbortSignal moi]
    CC --> DC{Request thanh cong?}
    DC -->|Bi huy| EC[Bo qua, doi request moi]
    DC -->|Loi mang| ERRC[Hien thi trang thai Error]
    DC -->|Thanh cong| FC[Nhan course AI data]
    FC --> LC[Populate Roadmap tab:\nnull = hien nut Generate\nco data = hien thi roadmap]
```

## State Diagram

The loading state machine applies to both lesson and course AI data slots. Stale covers the case where the source lesson or course has been deleted.

```mermaid
stateDiagram-v2
    [*] --> Idle : Component mount

    Idle --> Loading : selectedLessonId hoac selectedCourseId thay doi

    Loading --> Loaded : Fetch thanh cong
    Loading --> Error : Fetch that bai
    Loading --> Idle : Request bi huy (AbortController)

    Loaded --> Loading : ID thay doi, fetch moi

    Loaded --> Stale : Bai hoc / khoa hoc bi xoa
    Stale --> Idle : Reset selection

    Error --> Loading : Thu lai
    Error --> Idle : Reset

    Loaded --> [*]
```
