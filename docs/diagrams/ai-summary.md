# Diagrams: AI Summary

## Flow Diagram

The main generation flow follows the cache-first pattern: check DB for existing summary, display if found, otherwise let the user pick a mode and trigger generation. The regenerate path bypasses the cache with `force:true`.

```mermaid
flowchart TD
    A([Chon bai hoc]) --> B[GET /api/lessons/id/ai]
    B --> C{summary != null?}
    C -->|Co| D[Hien thi summary da cache]
    D --> E[Nut Tao lai]
    E --> F[POST /api/ai/summary\nforce: true]
    F --> G[Bo qua cache]
    G --> H[Fetch transcript tu DB]

    C -->|Khong| I[Hien thi Mode Selector]
    I --> J{Chon mode}
    J -->|quick| K[300-500 tu, bullets]
    J -->|detailed| L[600-2500 tu, Bloom Taxonomy]
    K --> M[POST /api/ai/summary\nmode: quick]
    L --> N[POST /api/ai/summary\nmode: detailed]
    M --> O[Fetch transcript tu DB]
    N --> O

    H --> P[Goi AI]
    O --> P
    P --> Q[Strip think tags]
    Q --> R[Persist Lesson.summary]
    R --> S[Tra ve ket qua]
    S --> T[Hien thi:\nKey Takeaways 3 diem\n+ noi dung mode]

    P --> ERR[Loi goi AI]
    ERR --> ERRSHOW[Hien thi thong bao loi]
    ERRSHOW --> I
```

## State Diagram

Summary content cycles through five states. Once cached, the user can force a regeneration which returns it to the Generating state.

```mermaid
stateDiagram-v2
    [*] --> Empty : Bai hoc chua co summary

    Empty --> ModeSelection : Nhan Generate

    ModeSelection --> Generating : Chon mode va xac nhan
    ModeSelection --> Empty : Huy

    Generating --> Cached : AI thanh cong
    Generating --> Error : Goi AI that bai

    Cached --> Generating : Nhan Tao lai (force=true)

    Error --> ModeSelection : Thu lai
    Error --> Empty : Reset

    Cached --> [*]
```
