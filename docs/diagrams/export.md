# Diagrams: Export

## Lesson Export Flow

User selects content type and format from a dropdown, the server pulls data from the database and streams back a downloadable file.

```mermaid
flowchart TD
    A[User clicks Xuat dropdown] --> B[Show type options]
    B --> C{Select content type}
    C --> CT1[summary]
    C --> CT2[explanation]
    C --> CT3[quiz]
    C --> CT4[flashcards]
    C --> CT5[exercises]
    CT1 --> D[Select format]
    CT2 --> D
    CT3 --> D
    CT4 --> D
    CT5 --> D
    D --> F1[markdown]
    D --> F2[csv]
    F1 --> E[POST /api/export/lesson/id with type + format]
    F2 --> E
    E --> G[Server reads content from DB]
    G --> H[Generate file content in requested format]
    H --> I{Generation success?}
    I -->|Error| J[Return 500 - show error toast]
    I -->|Success| K[Response with Content-Disposition: attachment header]
    K --> L[Browser download dialog opens]
    L --> M[File saved to user device]
```

## Course Export Flow

Aggregates content across all lessons in a course into a single download.

```mermaid
flowchart TD
    A[User clicks Xuat toan bo] --> B[Show course export options]
    B --> C{Select type}
    C --> C1[full-notes: all lesson notes merged]
    C --> C2[all-flashcards: all cards in Anki CSV format]
    C1 --> D[POST /api/export/course/id with type]
    C2 --> D
    D --> E[Server loads all lessons for course]
    E --> F[For each lesson: fetch relevant content from DB]
    F --> G{More lessons?}
    G -->|Yes| F
    G -->|No| H[Merge all content]
    H --> I[Generate combined file]
    I --> J{Generation success?}
    J -->|Error| K[Return 500 - show error toast]
    J -->|Success| L[Response with Content-Disposition header]
    L --> M[Browser download dialog opens]
```

## CSV Format (Anki-compatible)

Illustrates how flashcard data maps to the Anki-compatible CSV output format.

```mermaid
flowchart TD
    A[Flashcard data from DB] --> B[For each card]
    B --> C[front field]
    B --> D[back field]
    C --> E[Escape special chars per RFC 4180]
    D --> E
    E --> F[Join with semicolon separator]
    F --> G[front;back]
    G --> H{More cards?}
    H -->|Yes| B
    H -->|No| I[Join all rows with newline]
    I --> J[No header row in output]
    J --> K[Final CSV string ready for download]
```

## Export Process State Diagram

Covers both lesson-level and course-level export paths through the same state machine.

```mermaid
stateDiagram-v2
    [*] --> Idle : Page loaded

    Idle --> Selecting : User opens export dropdown
    Selecting --> Idle : User dismisses dropdown
    Selecting --> Generating : User confirms export type and format

    Generating --> Downloading : Server returns file successfully
    Generating --> Error : Server returns 4xx or 5xx

    Downloading --> Idle : Browser download dialog handled
    Error --> Selecting : User clicks retry
    Error --> Idle : User dismisses error
```
