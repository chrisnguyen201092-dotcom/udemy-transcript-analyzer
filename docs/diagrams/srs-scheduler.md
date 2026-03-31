# Diagrams: SRS Scheduler

## SRS Initialization Flow

Creates FlashcardReview records for every card in a lesson. The operation is idempotent - existing cards are skipped.

```mermaid
flowchart TD
    A[User opens SRS for lesson] --> B[POST /api/lessons/id/srs/init]
    B --> C[Load all flashcards for lesson]
    C --> D{For each flashcard}
    D --> E{FlashcardReview already exists?}
    E -->|Yes| F[Skip - no duplicate created]
    E -->|No| G[Create FlashcardReview with defaults]
    G --> H[interval=0, EF=2.5, repetitions=0, nextReviewAt=now]
    F --> I{More cards?}
    H --> I
    I -->|Yes| D
    I -->|No| J[Return total cards initialized]
```

## Due Cards Flow

Fetches only cards that are due for review right now.

```mermaid
flowchart TD
    A[User opens SRS review session] --> B[GET /api/lessons/id/srs/due]
    B --> C[Query: nextReviewAt <= now()]
    C --> D{Any due cards?}
    D -->|None| E[Show all-caught-up screen]
    D -->|Has cards| F[Return due card list]
    F --> G[Start review session with first card]
```

## Review Session Flow

The main review loop: show each card, collect quality rating, apply SM-2, then move to next card.

```mermaid
flowchart TD
    A[Review session starts] --> B[Show card front]
    B --> C[User clicks Flip]
    C --> D[Show card back]
    D --> E{User rates quality}
    E -->|Quen quality=1| F[POST /api/lessons/id/srs/review with cardIndex + quality=1]
    E -->|Kho quality=3| G[POST /api/lessons/id/srs/review with cardIndex + quality=3]
    E -->|De quality=5| H[POST /api/lessons/id/srs/review with cardIndex + quality=5]
    F --> I[Apply SM-2 algorithm]
    G --> I
    H --> I
    I --> J[Update FlashcardReview: interval, EF, repetitions, nextReviewAt]
    J --> K{More cards in session?}
    K -->|Yes| L[Load next card]
    L --> B
    K -->|No| M[Show completion screen with stats]
```

## SM-2 Algorithm Flow

Calculates the next review interval and ease factor for a given quality score.

```mermaid
flowchart TD
    A[Receive quality score q] --> B{quality >= 3?}
    B -->|No| C[repetitions = 0]
    C --> D[interval = 1]
    D --> E[EF = max 1.3, EF + 0.1 - 5-q * 0.08 + 5-q * 0.02]
    B -->|Yes| F{repetitions value?}
    F -->|0| G[interval = 1]
    F -->|1| H[interval = 6]
    F -->|2 or more| I[interval = round interval * EF]
    G --> J[repetitions += 1]
    H --> J
    I --> J
    J --> K[EF = max 1.3, EF + 0.1 - 5-q * 0.08 + 5-q * 0.02]
    E --> L[nextReviewAt = now + interval days]
    K --> L
    L --> M[Save to DB]
```

## SRS Dashboard Flow

Aggregates per-lesson SRS stats for the dashboard overview.

```mermaid
flowchart TD
    A[User opens SRS Dashboard] --> B[GET /api/srs/dashboard]
    B --> C[For each lesson with flashcards]
    C --> D[Count totalCards]
    D --> E[Count dueCount where nextReviewAt <= now]
    E --> F[Count masteredCount where interval >= 21]
    F --> G{More lessons?}
    G -->|Yes| C
    G -->|No| H[Return aggregated list]
    H --> I[Render dashboard with lesson cards]
    I --> J[User clicks lesson to start review]
    J --> K[Navigate to review session]
```

## FlashcardReview SM-2 Lifecycle State Diagram

Cards progress through stages based on interval length. Forgetting a card resets it to Learning.

```mermaid
stateDiagram-v2
    [*] --> New : FlashcardReview created on init

    New --> Learning : First review any quality
    Learning --> Learning : quality >= 3, interval stays 1-6 days
    Learning --> Learning : quality < 3, interval reset to 1
    Learning --> Review : quality >= 3, interval reaches 7+
    Review --> Review : quality >= 3, interval 7-20 days
    Review --> Mastered : quality >= 3, interval reaches 21+
    Review --> Learning : quality < 3, repetitions reset to 0
    Mastered --> Review : quality < 3, interval drops below 21
```
