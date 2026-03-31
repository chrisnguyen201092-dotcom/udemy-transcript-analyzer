# Diagrams: Pre-Assessment

## Profile Trigger Flow

The first time a user opens the Roadmap tab, the app checks for an existing profile. A 404 response triggers the profiling modal.

```mermaid
flowchart TD
    A[User opens Roadmap tab] --> B[GET /api/courses/id/profile]
    B --> C{Response status?}
    C -->|200 - profile exists| D[Load profile data]
    C -->|404 - no profile| E[Show profiling modal]
    D --> F[Render personalized Roadmap]
    E --> G[Start modal question flow]
    G --> H{User completes or skips?}
    H -->|Skips - closes modal| I[Render generic Roadmap without personalization]
    H -->|Completes| J[POST /api/courses/id/profile]
    J --> K[201 Created]
    K --> L[Auto-trigger Roadmap generation]
    L --> F
```

## Modal Question Flow

Five questions collected in sequence. Users can navigate back to revise earlier answers before submitting.

```mermaid
flowchart TD
    A[Modal opens - Step 1] --> B[Question: level]
    B --> C{User answers}
    C --> D[Step 2: goal]
    D --> E{User answers}
    E --> F[Step 3: dailyTimeMin]
    F --> G{User answers}
    G --> H[Step 4: knownTopics - select from lesson titles]
    H --> I{User answers}
    I --> J[Step 5: learningStyle]
    J --> K{User answers}
    K --> L[Submit button enabled]
    L --> M[User clicks Submit]
    M --> N[POST /api/courses/id/profile]
    N --> O{Response}
    O -->|201 Created| P[Close modal]
    O -->|Error| Q[Show error - retry available]
    P --> R[Auto-trigger Roadmap generation]

    C -->|Back| S[Step 1 - already first step]
    E -->|Back| B
    G -->|Back| D
    I -->|Back| F
    K -->|Back| H
```

## Update Profile Flow

Users can update their profile at any time. A confirmation dialog offers to regenerate the Roadmap with the new data.

```mermaid
flowchart TD
    A[User clicks Cap nhat ho so] --> B[GET /api/courses/id/profile]
    B --> C[Populate modal with existing values]
    C --> D[Modal opens in edit mode]
    D --> E[User modifies one or more answers]
    E --> F[User clicks Submit]
    F --> G[PUT /api/courses/id/profile]
    G --> H{Update success?}
    H -->|Error| I[Show error toast - retry]
    H -->|Success| J[Show confirmation dialog]
    J --> K{Tao lai Roadmap voi ho so moi?}
    K -->|Yes| L[Trigger Roadmap regeneration with new profile]
    K -->|No| M[Close dialog - keep existing Roadmap]
    L --> N[Render updated personalized Roadmap]
```

## LearnerProfile Lifecycle State Diagram

Tracks the full profile from non-existence through creation, updates, and how it affects AI personalization.

```mermaid
stateDiagram-v2
    [*] --> NotCreated : Course enrolled, no profile yet

    NotCreated --> Creating : User opens profiling modal
    Creating --> NotCreated : User closes modal without saving
    Creating --> Created : POST /api/courses/id/profile returns 201

    Created --> Updating : User clicks Cap nhat ho so
    Updating --> Created : User closes modal without saving
    Updating --> Updated : PUT /api/courses/id/profile succeeds
    Updated --> Updating : User updates again

    NotCreated --> NoProfile : Roadmap rendered
    Created --> HasProfile : Roadmap rendered
    Updated --> HasProfile : Roadmap re-rendered

    NoProfile --> HasProfile : Profile created mid-session

    note right of NoProfile : Generic AI responses\nno personalization
    note right of HasProfile : Personalized AI responses\nbased on learner profile
```
