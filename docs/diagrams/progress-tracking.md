# Diagrams: Progress Tracking

## Auto-Complete Flow

The system marks a lesson completed automatically when three conditions are all met: the summary was viewed, the explanation was viewed, and the quiz score reached 70% or higher.

```mermaid
flowchart TD
    A[User interacts with lesson] --> B{Summary viewed?}
    B -->|No| C[Track summary view]
    B -->|Yes| D{Explanation viewed?}
    C --> D
    D -->|No| E[Track explanation view]
    D -->|Yes| F{Quiz score >= 70%?}
    E --> F
    F -->|No| G[Wait for quiz attempt]
    F -->|Yes| H[All conditions met]
    H --> I[POST /api/lessons/id/progress with completed: true]
    I --> J[Update LessonProgress in DB]
    J --> K[Recalculate CourseProgress.completionPct]
    K --> L[Update UI - lesson marked complete]
    G --> M[User takes quiz]
    M --> N{Score >= 70%?}
    N -->|No| O[Show result - not completed yet]
    N -->|Yes| F
```

## Manual Complete Flow

Users can toggle lesson completion manually via a checkbox, overriding auto-complete logic.

```mermaid
flowchart TD
    A[User clicks lesson checkbox] --> B{Current state?}
    B -->|Not completed| C[POST /api/lessons/id/progress with completed: true]
    B -->|Completed| D[POST /api/lessons/id/progress with completed: false]
    C --> E[Mark lesson completed in DB]
    D --> F[Mark lesson not completed in DB]
    E --> G[Recalculate CourseProgress.completionPct]
    F --> G
    G --> H[Update UI checkbox state]
```

## Time Tracking Flow

Session time accumulates incrementally. Each lesson switch or session end flushes the delta to the server without overwriting cumulative time.

```mermaid
flowchart TD
    A[User opens lesson] --> B[Start session timer]
    B --> C[Timer increments every second]
    C --> D{Lesson switch or session end?}
    D -->|No| C
    D -->|Yes| E[Calculate deltaTimeMs since last flush]
    E --> F[PATCH /api/lessons/id/progress with deltaTimeMs]
    F --> G[DB: timeSpentMs += deltaTimeMs]
    G --> H{Opening new lesson?}
    H -->|Yes| I[Start timer for new lesson]
    H -->|No| J[Session ended - stop timer]
    I --> C
```

## Streak Logic Flow

The streak counter tracks consecutive daily study sessions, resetting on any gap longer than one day.

```mermaid
flowchart TD
    A[User studies a lesson] --> B[Read lastStudiedAt from UserStats]
    B --> C{lastStudiedAt exists?}
    C -->|No| D[Set streak = 1]
    C -->|Yes| E{When was last study?}
    E -->|Yesterday| F[streak += 1]
    E -->|Today - same day| G[No change to streak]
    E -->|More than 1 day ago| H[Reset streak = 1]
    D --> I[Update lastStudiedAt = today]
    F --> I
    G --> I
    H --> I
    I --> J[Save to UserStats]
```

## LessonProgress State Diagram

```mermaid
stateDiagram-v2
    [*] --> NotStarted : Lesson added to course

    NotStarted --> InProgress : User opens lesson
    InProgress --> InProgress : User views content, takes quiz
    InProgress --> Completed : Auto-complete conditions met OR manual check
    Completed --> InProgress : User unchecks manually

    Completed --> [*] : Terminal state unless unchecked
```

## CourseProgress State Diagram

```mermaid
stateDiagram-v2
    [*] --> NotStarted : Course enrolled, no lessons started

    NotStarted --> InProgress : First lesson started
    InProgress --> InProgress : completionPct between 1 and 99
    InProgress --> Completed : completionPct reaches 100

    Completed --> InProgress : A completed lesson is unchecked
```

## Streak State Diagram

```mermaid
stateDiagram-v2
    [*] --> NoStreak : User has no study history

    NoStreak --> Active : User studies first lesson
    Active --> Active : User studies again yesterday (streak+1)
    Active --> Active : User studies again today (no change)
    Active --> Broken : Gap greater than 1 day detected
    Broken --> Active : User resumes study (streak reset to 1)
```
