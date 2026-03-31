# Diagrams: Learning Analytics

## Overview Analytics Flow

The overview page aggregates data from three sources and renders metric cards plus a study activity heatmap.

```mermaid
flowchart TD
    A[User opens Analytics page] --> B[GET /api/analytics/overview]
    B --> C[Query LessonProgress table]
    B --> D[Query FlashcardReview table]
    B --> E[Query CourseProgress table]
    C --> F[Compute: completion rate, total time, avg quiz score]
    D --> G[Compute: retention rate, mastery count]
    E --> H[Compute: current streak, overall progress %]
    F --> I[Merge all metrics]
    G --> I
    H --> I
    I --> J[Aggregate daily study activity for heatmap]
    J --> K[Return 6 metric cards + heatmap data]
    K --> L[Render overview dashboard]
```

## Course Detail Analytics Flow

Drills down into per-lesson data for a specific course, showing quiz score distribution and a study timeline.

```mermaid
flowchart TD
    A[User clicks course in analytics] --> B[GET /api/analytics/course/id]
    B --> C[Load all LessonProgress for course]
    C --> D[For each lesson: completion status + time spent + quiz scores]
    D --> E[Build per-lesson breakdown table]
    B --> F[Load all quiz attempt scores]
    F --> G[Bucket scores into histogram bins]
    G --> H[Build quiz score histogram]
    B --> I[Load timestamped study events]
    I --> J[Sort by date - build timeline]
    E --> K[Merge and return course detail payload]
    H --> K
    J --> K
    K --> L[Render per-lesson table + histogram + timeline]
    L --> M{User clicks a lesson row?}
    M -->|Yes| N[Navigate to that lesson]
    M -->|No| O[Stay on analytics page]
```

## Data Sources and Metrics Flow

Shows how each data source feeds into the analytics layer. This is a read-only aggregation - no writes occur.

```mermaid
flowchart TD
    LP[LessonProgress] --> A1[completion rate per lesson]
    LP --> A2[time spent per lesson]
    LP --> A3[quiz scores history]

    FR[FlashcardReview] --> B1[retention rate per card]
    FR --> B2[mastery count interval >= 21]
    FR --> B3[average ease factor]

    CP[CourseProgress] --> C1[overall completionPct]
    CP --> C2[current study streak]
    CP --> C3[lastStudiedAt timestamp]

    A1 --> Dashboard[Analytics Dashboard]
    A2 --> Dashboard
    A3 --> Dashboard
    B1 --> Dashboard
    B2 --> Dashboard
    B3 --> Dashboard
    C1 --> Dashboard
    C2 --> Dashboard
    C3 --> Dashboard

    Dashboard --> M1[6 Metric Cards]
    Dashboard --> M2[Activity Heatmap]
    Dashboard --> M3[Course Detail View]
```
