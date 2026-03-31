# Diagrams: AI Explain

## Flow Diagram

Explain has two distinct entry points: the standard lesson-level explanation (cached, depth-aware) and the Highlight-to-Explain shortcut (ephemeral, not persisted). LearnerProfile auto-selects depth when available.

```mermaid
flowchart TD
    A([Chon bai hoc]) --> B[GET /api/lessons/id/ai]
    B --> C{explanation != null?}
    C -->|Co| D[Hien thi explanation da cache]
    D --> REGEN[Nhan Tao lai]
    REGEN --> FORCE[POST /api/ai/explain\nforce: true]
    FORCE --> SERVER

    C -->|Khong| E{LearnerProfile ton tai?}
    E -->|Co| F[Auto-chon do sau:\nbeginner=simple\nintermediate=standard\nadvanced=deep]
    E -->|Khong| G[Hien thi Depth Selector]
    F --> H[POST /api/ai/explain]
    G --> I{Chon depth}
    I -->|simple| H
    I -->|standard| H
    I -->|deep| H

    H --> SERVER[Server: Fetch transcript]
    SERVER --> J{Phan loai transcript}
    J -->|code-ratio >= 40%| K[Format A: Code-heavy]
    J -->|code-ratio <= 20%| L[Format B: Prose]
    J -->|20% - 40%| M[Hybrid]
    K --> N[Goi AI voi depth instructions]
    L --> N
    M --> N
    N --> CHECK{deep + transcript < 200 tu?}
    CHECK -->|Co| DOWN[Auto-downgrade sang standard\ntra ve depthActual]
    CHECK -->|Khong| STRIP
    DOWN --> STRIP[Strip think tags]
    STRIP --> PERSIST[Persist Lesson.explanation]
    PERSIST --> RET[Tra ve ket qua + depthActual]
    RET --> DISP[Hien thi explanation]

    N --> ERRNODE[Loi goi AI]
    ERRNODE --> ERRSHOW[Hien thi loi]

    HL([User chon doan van ban]) --> HLPOST[POST /api/ai/explain\nselectedText]
    HLPOST --> HLAI[Goi AI - giai thich doan cu the]
    HLAI --> HLSHOW[Hien thi ket qua tam thoi\nKHONG persist]
```

## State Diagram

The SelectedTextMode is a parallel, ephemeral overlay that doesn't affect the primary explanation state.

```mermaid
stateDiagram-v2
    [*] --> Empty : Bai hoc chua co explanation

    Empty --> DepthSelection : Khong co LearnerProfile
    Empty --> Generating : Co LearnerProfile, auto-select depth

    DepthSelection --> Generating : Xac nhan depth
    DepthSelection --> Empty : Huy

    Generating --> Cached : AI thanh cong
    Generating --> Error : That bai

    Cached --> Generating : Tao lai (force=true)

    Error --> DepthSelection : Thu lai

    state SelectedTextMode {
        [*] --> FetchingExplain
        FetchingExplain --> ShowingResult
        ShowingResult --> [*] : Dong
    }

    Cached --> SelectedTextMode : User highlight text
    Empty --> SelectedTextMode : User highlight text
    SelectedTextMode --> Cached : Ket thuc SelectedTextMode
    SelectedTextMode --> Empty : Ket thuc SelectedTextMode
```
