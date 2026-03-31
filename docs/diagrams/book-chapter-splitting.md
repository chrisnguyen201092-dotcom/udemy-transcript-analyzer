# Diagrams: Book Chapter Splitting

## Full Split Flow

The complete pipeline from file upload through chapter confirmation.

```mermaid
flowchart TD
    Upload([File uploaded]) --> Extract[Extract text from file]
    Extract --> Heuristic[Step 1: Heuristic detection]

    Heuristic --> HeuristicCount{Chapters\nfound?}
    HeuristicCount -->|2 or more| Preview[Step 2: Preview UI]
    HeuristicCount -->|0 or 1| AIDet[Step 3: AI detection]

    AIDet --> AIResult{AI\nsucceeds?}
    AIResult -->|yes| AIBadge[Mark chapters with\nAI de xuat badge]
    AIBadge --> Preview
    AIResult -->|no| Fallback[Fallback:\nTreat as 1 chapter]
    Fallback --> Preview

    Preview --> UserReview[User reviews chapters:\nrename / merge / delete]
    UserReview --> Confirm[User clicks Confirm]
    Confirm --> PostConfirm[POST /api/books/split/confirm]
    PostConfirm --> CreateLessons[Create Lesson records\nin database]
    CreateLessons --> Done([Chapters saved])
```

## Heuristic Detection Sub-flow

How the heuristic engine finds chapter boundaries per file format.

```mermaid
flowchart TD
    Start([Text extracted]) --> Format{File\nformat?}

    Format -->|PDF| PDFHeuristic[Check regex patterns\nCheck font size changes\nCheck numbered headings\nCheck page breaks]
    Format -->|EPUB| EPUBHeuristic[Parse spine structure\nParse TOC entries]
    Format -->|DOCX| DOCXHeuristic[Find Heading 1 styles\nFind Heading 2 styles]
    Format -->|TXT| TXTHeuristic[Find H1 markers\nFind ALL CAPS lines]
    Format -->|MD| MDHeuristic[Find # H1 markers\nFind ALL CAPS lines]

    PDFHeuristic --> CollectBoundaries
    EPUBHeuristic --> CollectBoundaries
    DOCXHeuristic --> CollectBoundaries
    TXTHeuristic --> CollectBoundaries
    MDHeuristic --> CollectBoundaries

    CollectBoundaries[Collect chapter boundary positions] --> Count{Count\nboundaries}
    Count -->|2 or more| ReturnChapters[Return chapter list]
    Count -->|0 or 1| ReturnNone[Return empty result\ntrigger AI fallback]
```

## AI Detection Sub-flow

How AI is used when heuristics fail to find enough chapters.

```mermaid
flowchart TD
    Trigger([Heuristic found 0-1 chapters]) --> PrepPrompt[Prepare prompt:\nSend TOC + first 100 lines]
    PrepPrompt --> CallAI[Call AI endpoint]
    CallAI --> AIResponse{AI returns\nvalid JSON?}

    AIResponse -->|yes| ValidatePage[Validate page numbers\nare in range]
    ValidatePage --> PageValid{All page\nnumbers valid?}
    PageValid -->|yes| ReturnAIChapters[Return AI chapter list\nwith ai_suggested flag]
    PageValid -->|no| FilterInvalid[Filter out invalid\nboundaries]
    FilterInvalid --> ReturnAIChapters

    AIResponse -->|no / timeout / error| ReturnFallback[Return fallback:\n1 chapter = entire book]
```

## Chapter Splitting State Diagram

States the splitting process moves through.

```mermaid
stateDiagram-v2
    [*] --> Extracting: file received

    Extracting --> HeuristicDetection: text extracted
    Extracting --> Error: extraction failed

    HeuristicDetection --> PreviewUI: 2+ chapters found
    HeuristicDetection --> AIDetection: 0-1 chapters found

    AIDetection --> PreviewUI: AI returns chapters
    AIDetection --> Fallback: AI fails or times out

    Fallback --> PreviewUI: show 1-chapter preview

    PreviewUI --> UserEditing: user modifies chapters
    UserEditing --> PreviewUI: user continues editing
    UserEditing --> Confirming: user clicks Confirm
    PreviewUI --> Confirming: user clicks Confirm without edits

    Confirming --> Complete: Lessons created in DB
    Confirming --> Error: DB write failed

    Error --> [*]
    Complete --> [*]
