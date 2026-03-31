# Diagrams: AI Chat

## Flow Diagram

Chat is a streaming, history-aware conversation. Socratic mode changes how the AI responds. When history grows beyond 20 messages, old turns are summarized and pruned to keep context manageable.

```mermaid
flowchart TD
    A([Mo tab Chat]) --> B[GET /api/lessons/id/chat\nLoad lich su, max 50 msgs]
    B --> C[Hien thi lich su tin nhan]
    C --> D{Socratic mode?}
    D -->|Check localStorage| E[Lay trang thai Socratic per lesson]
    E --> F[Hien thi chat input]

    F --> G[User nhap tin nhan]
    G --> H[POST /api/ai/chat\nmessages array + socraticMode]
    H --> I{socraticMode = ON?}
    I -->|Co| J[AI hoi nguoc lai\nthay vi tra loi truc tiep]
    J --> K{Da hoi > 3 luot?}
    K -->|Co| L[Tiet lo dap an]
    K -->|Khong| M[Tiep tuc Socratic]
    I -->|Khong| N[AI tra loi truc tiep]

    L --> STREAM[text/plain chunked stream]
    M --> STREAM
    N --> STREAM
    STREAM --> O[Client render tang dan]
    O --> P[Stream hoan tat]
    P --> Q[Luu User msg + Assistant msg\nvao ChatMessage table]
    Q --> F

    H --> ERR[Loi mang hoac AI]
    ERR --> ERRSHOW[Hien thi thong bao loi]
    ERRSHOW --> F

    Q --> R{So messages > 20?}
    R -->|Co| S[Auto-summarize tin nhan cu]
    S --> T[Luu summary voi role=system]
    T --> U[Xoa tin nhan cu]
    U --> F

    DEL([Nhan Xoa lich su]) --> V[DELETE /api/lessons/id/chat]
    V --> W[Reset UI]
    W --> F
```

## State Diagram

The chat session transitions between loading, ready, and streaming states. Socratic mode is a sub-mode of Ready, not a separate top-level state.

```mermaid
stateDiagram-v2
    [*] --> LoadingHistory : Mo tab Chat

    LoadingHistory --> Ready : Load lich su thanh cong
    LoadingHistory --> Error : Load that bai

    Ready --> Streaming : Gui tin nhan
    Ready --> LoadingHistory : Chuyen sang bai hoc khac

    state Ready {
        [*] --> NormalMode
        NormalMode --> SocraticMode : Bat Socratic toggle
        SocraticMode --> NormalMode : Tat Socratic toggle
    }

    Streaming --> Ready : Stream hoan tat, luu tin nhan
    Streaming --> Error : Stream that bai

    Error --> Ready : Thu lai
    Error --> LoadingHistory : Tai lai

    Ready --> LoadingHistory : Xoa lich su
```
