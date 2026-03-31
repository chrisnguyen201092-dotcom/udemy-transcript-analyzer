# Diagrams: Lesson Notes

## Note Editing Flow

User selects a lesson, the app loads existing notes from the database and renders them in the editor. Changes trigger a 2-second debounce before auto-saving. Status indicators keep the user informed throughout.

```mermaid
flowchart TD
    A[User selects lesson] --> B[GET /api/lessons/id/notes]
    B --> C{Notes exist?}
    C -->|Null| D[Show placeholder text]
    C -->|Exists| E[Load notes into editor]
    D --> F[User types in editor]
    E --> F
    F --> G[Status: Chua luu...]
    G --> H[Debounce 2 seconds]
    H --> I[PUT /api/lessons/id/notes]
    I --> J{Save result}
    J -->|Success| K[Status: Da luu luc HH:mm]
    J -->|Error| L[Status: Loi luu - thu lai]
    L --> M[User retries manually]
    M --> I
    K --> F

    N[User switches lesson] --> O[Flush debounce immediately]
    O --> I
```

## Insert from AI Flow

When the user clicks "Chèn vào ghi chú" on an AI response in the Chat tab, the cited text appends to the current notes editor.

```mermaid
flowchart TD
    A[User in Chat tab] --> B[AI response displayed]
    B --> C[User clicks Chen vao ghi chu]
    C --> D[Extract response text + citation]
    D --> E{Notes editor open?}
    E -->|Yes| F[Append text + citation to editor]
    E -->|No| G[Open notes editor first]
    G --> F
    F --> H[Status: Chua luu...]
    H --> I[Debounce triggers save]
```

## Search Notes Flow

Search runs across all notes for a course, returns snippets, and navigates to the matching lesson on click.

```mermaid
flowchart TD
    A[User enters keyword in search bar] --> B{Keyword length >= 2?}
    B -->|No| C[No request - wait for more input]
    B -->|Yes| D[GET /api/courses/id/notes/search?q=keyword]
    D --> E{Results found?}
    E -->|Empty| F[Show no results message]
    E -->|Results| G[Display results with snippets + lesson names]
    G --> H[User clicks a result]
    H --> I[Navigate to that lesson]
    I --> J[Scroll to / highlight matching text in editor]
```

## Preview Toggle Flow

The editor supports two modes: raw Markdown editing and rendered HTML preview.

```mermaid
flowchart TD
    A[Editor in Edit Mode] --> B[User clicks Preview button]
    B --> C[Render Markdown to HTML]
    C --> D[Display rendered preview]
    D --> E[User clicks Edit button]
    E --> F[Switch back to raw Markdown editor]
    F --> A
```

## Note Save Status State Diagram

Tracks the lifecycle of the save status indicator shown to the user.

```mermaid
stateDiagram-v2
    [*] --> Saved : Notes loaded from DB

    Saved --> Editing : User starts typing
    Editing --> Debouncing : Key press detected
    Debouncing --> Debouncing : Another key press within 2s
    Debouncing --> Saving : 2s timer expires
    Saving --> Saved : PUT request succeeds
    Saving --> SaveFailed : PUT request fails
    SaveFailed --> Editing : User resumes typing
    SaveFailed --> Saving : User retries

    Editing --> Saving : User switches lesson (flush)
    Debouncing --> Saving : User switches lesson (flush)
    Saved --> [*] : User leaves page
```
