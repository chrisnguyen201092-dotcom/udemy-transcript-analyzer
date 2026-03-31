# Diagrams: Book Schema

## Entity Relationship Diagram

The full data model after migration, highlighting new fields added for book support.

```mermaid
erDiagram
    Course {
        string id PK
        string url
        string title
        string contentType "NEW: course or book"
        string author "NEW: nullable"
        string isbn "NEW: nullable"
        string publisher "NEW: nullable"
        string roadmap "nullable"
        datetime createdAt
        datetime updatedAt
    }

    Lesson {
        string id PK
        string courseId FK
        string title
        int order
        string transcript "nullable"
        int chapterNumber "NEW: nullable"
        string pageRange "NEW: nullable e.g. 12-24"
        string summary "nullable"
        string explanation "nullable"
        string quiz "nullable JSON"
        string flashcards "nullable JSON"
        string exercises "nullable JSON"
        string notes "nullable"
    }

    Course ||--o{ Lesson : "has"
```

## Schema Migration Flow

Steps to apply the migration with zero downtime.

```mermaid
flowchart TD
    Start([Start migration]) --> AddFields[Add nullable fields to schema.prisma\ncontentType, author, isbn, publisher\nchapterNumber, pageRange]
    AddFields --> Push[npx prisma db push]
    Push --> DBUpdated{Push\nsucceeded?}

    DBUpdated -->|no| FixError[Fix schema error\nand retry]
    FixError --> Push

    DBUpdated -->|yes| Defaults[Existing Course records:\ncontentType defaults to course\nauthor, isbn, publisher default to null]
    Defaults --> LessonDefaults[Existing Lesson records:\nchapterNumber defaults to null\npageRange defaults to null]
    LessonDefaults --> NoBackfill[No data backfill needed\nNo downtime required]
    NoBackfill --> Verify[Verify with:\nprisma studio or direct query]
    Verify --> Done([Migration complete])
```

## Schema Migration State Diagram

States the database schema passes through during the migration lifecycle.

```mermaid
stateDiagram-v2
    [*] --> CurrentSchema: baseline

    CurrentSchema --> MigrationPending: schema.prisma edited\nnew fields added

    MigrationPending --> MigrationApplied: npx prisma db push succeeds
    MigrationPending --> MigrationPending: push fails, fix and retry

    MigrationApplied --> Verified: query confirms new columns exist
    MigrationApplied --> MigrationPending: rollback needed

    Verified --> [*]: ready for application use
