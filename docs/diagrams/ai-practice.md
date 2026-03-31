# Diagrams: AI Practice

## Flow Diagram

Practice has three sub-tabs (Quiz, Flashcard, Exercises) each with independent cache slots. All follow the same cache-first pattern, and JSON parse failures degrade gracefully by showing raw output.

```mermaid
flowchart TD
    A([Chon tab Practice]) --> B{Chon sub-tab}
    B -->|Quiz| CQ[Check cache: Lesson.quiz]
    B -->|Flashcard| CF[Check cache: Lesson.flashcards]
    B -->|Exercises| CE[Check cache: Lesson.exercises]

    CQ --> DQ{Cache ton tai?}
    CF --> DF{Cache ton tai?}
    CE --> DE{Cache ton tai?}

    DQ -->|Co| SHOWQ[Hien thi Quiz\n8-12 cau: MCQ, true-false,\nfill-blank, short-answer,\ncode-completion, Bloom]
    DF -->|Co| SHOWF[Hien thi Flashcards\n15-25 the, 5 loai,\nMinimum Information,\nmnemonic]
    DE -->|Co| SHOWE[Hien thi Exercises\n3-5 bai, Deliberate Practice,\n5 loai]

    DQ -->|Khong| GENQ[Nhan Generate]
    DF -->|Khong| GENF[Nhan Generate]
    DE -->|Khong| GENE[Nhan Generate]

    GENQ --> POSTQ[POST /api/ai/quiz\nmode: quiz]
    GENF --> POSTF[POST /api/ai/quiz\nmode: flashcard]
    GENE --> POSTE[POST /api/ai/quiz\nmode: exercises]

    POSTQ --> FETCH[Server: Fetch transcript]
    POSTF --> FETCH
    POSTE --> FETCH

    FETCH --> AI[Goi AI generate]
    AI --> STRIP[Strip think tags]
    STRIP --> PARSE{Parse JSON thanh cong?}
    PARSE -->|Co| PERSIST[Persist vao Lesson field tuong ung]
    PARSE -->|Khong| PARSERAW[Hien thi raw output\nvoi canh bao ParseError]
    PERSIST --> RET[Tra ve ket qua]
    RET --> SHOW[Hien thi noi dung]

    AI --> ERR[Loi goi AI]
    ERR --> ERRSHOW[Hien thi thong bao loi]
```

## State Diagram

Each sub-tab slot is independent, but they share the same state machine pattern. ParseError is a recoverable degraded state.

```mermaid
stateDiagram-v2
    [*] --> Empty : Sub-tab chua co noi dung

    Empty --> Generating : Nhan Generate

    Generating --> Cached : Parse JSON thanh cong
    Generating --> ParseError : JSON parse that bai
    Generating --> Error : Goi AI that bai

    ParseError --> Empty : Xoa va thu lai
    ParseError --> [*] : Hien thi raw output

    Cached --> Generating : Tao lai

    Error --> Empty : Thu lai

    Cached --> [*]
```
