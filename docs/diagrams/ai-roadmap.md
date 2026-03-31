# Diagrams: AI Roadmap

## Flow Diagram

Roadmap operates at the course level and is the most profile-sensitive AI feature. Profile data shapes time allocation, emphasis, pacing, and theory/practice ratio. Progress milestones also trigger stale notifications.

```mermaid
flowchart TD
    A([Chon khoa hoc]) --> B[GET /api/courses/id/ai]
    B --> C{roadmap != null?}
    C -->|Co| D[Hien thi roadmap da cache]
    D --> STALE{Roadmap stale?}
    STALE -->|Profile thay doi| STALEP[Hien thi thong bao cap nhat]
    STALE -->|Progress milestone 25/50/75%| STALEM[Hien thi goi y tao lai]
    STALEP --> REGEN[Nhan Tao lai]
    STALEM --> REGEN
    REGEN --> POST

    C -->|Khong| E{LearnerProfile ton tai?}
    E -->|Khong| F[Hien thi goi y tao profile\n+ nut Generate khong co profile]
    E -->|Co| G[Hien thi nut Generate\nvoi thong tin profile]
    F --> POST[POST /api/ai/roadmap\ncourseId + lesson transcripts]
    G --> POST

    POST --> H[Server: Fetch tat ca lesson transcripts\nTruncate moi transcript 4000 chars]
    H --> I[Server: Fetch LessonProgress\nAuto-included]
    I --> J{Profile ton tai?}
    J -->|Co| K[Ap dung profile:\nlevel -> time allocation\ngoal -> emphasis\ndailyTimeMin -> timeline\nknownTopics -> skip/review\nlearningStyle -> theory/practice ratio]
    J -->|Khong| L[Dung default settings]
    K --> AI[Goi AI generate roadmap]
    L --> AI
    AI --> STRIP[Strip think tags]
    STRIP --> PERSIST[Persist Course.roadmap]
    PERSIST --> RET[Tra ve roadmap]
    RET --> DISP[Hien thi roadmap]

    AI --> ERR[Loi goi AI]
    ERR --> ERRSHOW[Hien thi loi]
```

## State Diagram

Roadmap can become stale via two independent triggers: profile changes and progress milestones. Both lead back through Generating.

```mermaid
stateDiagram-v2
    [*] --> Empty : Khoa hoc chua co roadmap

    Empty --> NoProfile : Khong co LearnerProfile
    Empty --> Generating : Co LearnerProfile, nhan Generate

    NoProfile --> Generating : Nhan Generate khong co profile
    NoProfile --> Generating : Tao profile xong, nhan Generate

    Generating --> Cached : AI thanh cong
    Generating --> Error : That bai

    Cached --> StaleAfterProfileChange : Profile duoc tao moi hoac cap nhat
    Cached --> StaleAfterProgressMilestone : Dat moc 25% / 50% / 75%

    StaleAfterProfileChange --> Generating : Tao lai roadmap
    StaleAfterProgressMilestone --> Generating : Tao lai roadmap

    StaleAfterProfileChange --> Cached : Bo qua thong bao
    StaleAfterProgressMilestone --> Cached : Bo qua thong bao

    Error --> Empty : Thu lai

    Cached --> [*]
```
