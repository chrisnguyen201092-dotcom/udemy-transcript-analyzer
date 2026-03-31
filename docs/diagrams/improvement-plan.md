# Diagrams: Improvement Plan

## Implementation Dependency Graph

Shows which features depend on others and which can run in parallel across the 4 tiers.

```mermaid
flowchart TD
    subgraph Tier1 [Phase 1 - Data Foundation]
        PT[Progress Tracking]
        SRS[SRS Scheduler]
        PA[Pre-Assessment]
    end

    subgraph Tier2 [Phase 2 - Spec Fixes]
        LC[Lesson CRUD]
        TV[Transcript View]
        SM[Summary Mode]
        CS[Chat Socratic]
        ED[Explain Depth]
        RP[Roadmap Personalization]
    end

    subgraph Tier3 [Phase 3 - Analytics]
        LAD[Learning Analytics Dashboard]
    end

    subgraph Tier4 [Phase 4 - Enhancements]
        EX[Export]
        LN[Lesson Notes]
    end

    PT --> LAD
    SRS --> LAD
    PA --> ED
    PA --> RP

    Tier1 -->|unblocked after Phase 1| Tier2
    Tier2 -->|unblocked after Phase 2| Tier3
    Tier3 -->|unblocked after Phase 3| Tier4
```

## Parallel Execution Flow

Which items within each phase can run at the same time.

```mermaid
flowchart TD
    Start([Start implementation]) --> Phase1[Phase 1: Data Foundation]

    Phase1 --> P1Fork[ ]
    P1Fork --> PT[Progress Tracking\nparallel]
    P1Fork --> SRS[SRS Scheduler\nparallel]
    P1Fork --> PA[Pre-Assessment\nparallel]

    PT --> P1Join[ ]
    SRS --> P1Join
    PA --> P1Join

    P1Join --> Phase2[Phase 2: Spec Fixes]

    Phase2 --> P2Fork[ ]
    P2Fork --> LC[Lesson CRUD\nno deps]
    P2Fork --> TV[Transcript View\nno deps]
    P2Fork --> SM[Summary Mode\nno deps]
    P2Fork --> CS[Chat Socratic\nno deps]
    P2Fork --> ED[Explain Depth\nneeds Pre-Assessment]
    P2Fork --> RP[Roadmap Personalization\nneeds Pre-Assessment]

    LC --> P2Join[ ]
    TV --> P2Join
    SM --> P2Join
    CS --> P2Join
    ED --> P2Join
    RP --> P2Join

    P2Join --> Phase3[Phase 3: Analytics]
    Phase3 --> LAD[Learning Analytics Dashboard\nneeds Progress Tracking + SRS]

    LAD --> Phase4[Phase 4: Enhancements]
    Phase4 --> P4Fork[ ]
    P4Fork --> EX[Export\nminimal deps]
    P4Fork --> LN[Lesson Notes\nminimal deps]
    EX --> Done([Done])
    LN --> Done
```

## Feature Dependency Flow

Explicit dependency edges showing what blocks what.

```mermaid
flowchart LR
    PT[Progress Tracking] --> LAD[Learning Analytics\nDashboard]
    SRS[SRS Scheduler] --> LAD
    PA[Pre-Assessment] --> ED[Explain Depth]
    PA --> RP[Roadmap Personalization]

    LC[Lesson CRUD]
    TV[Transcript View]
    SM[Summary Mode]
    CS[Chat Socratic]

    EX[Export]
    LN[Lesson Notes]

    style PT fill:#4a9,color:#fff
    style SRS fill:#4a9,color:#fff
    style PA fill:#4a9,color:#fff
    style LAD fill:#69b,color:#fff
    style EX fill:#999
    style LN fill:#999
