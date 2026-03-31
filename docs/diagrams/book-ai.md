# Diagrams: Book AI Prompt Routing

## Prompt Selection Flow

How the AI route selects the correct system prompt variant based on `contentType`.

```mermaid
flowchart TD
    Request([AI route receives request]) --> FetchCourse[Fetch Course.contentType\nfrom database]
    FetchCourse --> ContentType{contentType\nvalue?}

    ContentType -->|book| BookPath[Use BOOK prompt variant]
    ContentType -->|course or default| CoursePath[Use COURSE prompt variant]

    BookPath --> SkipASR[Skip buildASRRules\nno ASR/transcript rules]
    BookPath --> AcademicFrame[Apply academic framing\nchuong sach, trang, phan]

    CoursePath --> IncludeASR[Include buildASRRules\nautomatic speech recognition fixes]
    CoursePath --> VideoFrame[Apply video/lesson framing\nbai hoc, xem lai video]

    AcademicFrame --> SelectPromptType{Prompt\ntype?}
    VideoFrame --> SelectPromptType

    SelectPromptType -->|summary| SummaryPrompt[Summary\nbook: chuong sach\ncourse: bai hoc]
    SelectPromptType -->|explain| ExplainPrompt[Explain\nbook: xem lai chuong\ncourse: xem lai video]
    SelectPromptType -->|quiz| QuizPrompt[Quiz\nbook: trang/phan\ncourse: bai hoc]
    SelectPromptType -->|flashcard| FlashPrompt[Flashcard\nbook: trang/phan\ncourse: bai hoc]
    SelectPromptType -->|exercise| ExercisePrompt[Exercise\nbook: trang/phan\ncourse: bai hoc]
    SelectPromptType -->|chat| ChatPrompt[Chat tutor\nbook: xem lai chuong/trang\ncourse: xem lai video]
    SelectPromptType -->|roadmap| RoadmapPrompt[Roadmap\nbook: Ke hoach doc\ncourse: Lo trinh hoc]

    SummaryPrompt --> SendToAI([Send to AI model])
    ExplainPrompt --> SendToAI
    QuizPrompt --> SendToAI
    FlashPrompt --> SendToAI
    ExercisePrompt --> SendToAI
    ChatPrompt --> SendToAI
    RoadmapPrompt --> SendToAI
```

## ContentType Routing Decision Diagram

Simple view of the two routing branches and their key behavioral differences.

```mermaid
flowchart LR
    Entry([AI API Request]) --> DB[(DB lookup\nCourse.contentType)]

    DB --> BookBranch[contentType = book]
    DB --> CourseBranch[contentType = course]

    subgraph BookBranch [Book Branch]
        B1[Academic language\nchuong, trang, phan]
        B2[No ASR correction rules]
        B3[Bloom taxonomy kept]
        B4[Roadmap becomes\nKe hoach doc]
    end

    subgraph CourseBranch [Course Branch]
        C1[Video language\nbai hoc, xem lai video]
        C2[ASR correction rules included]
        C3[Bloom taxonomy kept]
        C4[Roadmap stays\nLo trinh hoc]
    end

    BookBranch --> Response([AI Response])
    CourseBranch --> Response
```
