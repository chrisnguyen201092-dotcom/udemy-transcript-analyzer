# Diagrams: UX Overhaul (Phase 6)

## Phase Overview Flow

High-level view of the three sub-phases and their items, ordered by priority.

```mermaid
flowchart TD
    Start([UX Overhaul]) --> P6A[Phase 6A: Critical Fixes]
    P6A --> A1[Markdown rendering]
    P6A --> A2[URL routing with search params]
    P6A --> A3[Responsive layout]
    P6A --> A4[Transcript panel height fix]

    P6A -->|after critical fixes| P6B[Phase 6B: Major Improvements]
    P6B --> B1[Search and filter courses]
    P6B --> B2[Regenerate confirm dialog]
    P6B --> B3[Lesson delete confirmation]
    P6B --> B4[Course rename]
    P6B --> B5[Language display fix]
    P6B --> B6[Settings validation]
    P6B --> B7[Chat context warning]

    P6B -->|after major improvements| P6C[Phase 6C: Polish]
    P6C --> C1[Toast notifications]
    P6C --> C2[Skeleton loaders]
    P6C --> C3[AI progress indicators]
    P6C --> C4[Keyboard shortcuts]
    P6C --> C5[Drag and drop upload]
    P6C --> C6[Empty states]
    P6C --> C7[Lesson reorder]
    P6C --> C8[Transcript edit mode]

    P6C --> Done([Done])
```

## URL Navigation Flow

How the app reads and writes URL search params to enable deep linking and browser history.

```mermaid
flowchart TD
    Load([Page Load]) --> ReadParams[Read search params\n?course=X and lesson=Y and tab=Z]
    ReadParams --> HasCourse{course param\nexists?}

    HasCourse -->|yes| SelectCourse[Auto-select course X]
    HasCourse -->|no| DefaultState[Show default state\nno course selected]

    SelectCourse --> HasLesson{lesson param\nexists?}
    HasLesson -->|yes| SelectLesson[Auto-select lesson Y]
    HasLesson -->|no| SelectFirstLesson[Select first lesson]

    SelectLesson --> HasTab{tab param\nexists?}
    SelectFirstLesson --> HasTab
    HasTab -->|yes| SelectTab[Activate tab Z]
    HasTab -->|no| SelectDefaultTab[Activate default tab]

    SelectTab --> Ready([UI Ready])
    SelectDefaultTab --> Ready
    DefaultState --> Ready

    Ready --> UserNav[User navigates:\nclicks course / lesson / tab]
    UserNav --> UpdateParams[Update search params\nwithout page reload]
    UpdateParams --> PushHistory[Browser history updated]
    PushHistory --> BackForward{User hits\nback or forward?}
    BackForward -->|yes| ReadParams
    BackForward -->|no| UserNav
```

## Responsive Layout Flow

How the layout adapts based on viewport width.

```mermaid
flowchart TD
    Render([Component renders]) --> CheckWidth[Check viewport width]

    CheckWidth --> IsMobile{width < 768px?}
    IsMobile -->|yes| MobileLayout[Mobile layout:\nSidebar hidden\nHamburger menu button\nSingle panel view]

    IsMobile -->|no| IsTablet{width 768-1024px?}
    IsTablet -->|yes| TabletLayout[Tablet layout:\nCollapsible sidebar\n2-panel view]

    IsTablet -->|no| DesktopLayout[Desktop layout:\n3-panel view\nSidebar always visible]

    MobileLayout --> HamburgerTap{User taps\nhamburger?}
    HamburgerTap -->|yes| ShowSidebarOverlay[Show sidebar as overlay\ndarken background]
    HamburgerTap -->|no| MobileLayout
    ShowSidebarOverlay --> TapOutside{Tap outside\noverlay?}
    TapOutside -->|yes| MobileLayout

    TabletLayout --> CollapseBtn{User clicks\ncollapse?}
    CollapseBtn -->|yes| CollapsedSidebar[Sidebar collapsed\nto icon rail]
    CollapsedSidebar --> ExpandBtn{User clicks\nexpand?}
    ExpandBtn -->|yes| TabletLayout
```

## Responsive Layout State Diagram

Entity states for the sidebar across breakpoints.

```mermaid
stateDiagram-v2
    [*] --> DetectViewport

    DetectViewport --> Mobile: width lt 768px
    DetectViewport --> Tablet: width 768-1024px
    DetectViewport --> Desktop: width gt 1024px

    state Mobile {
        [*] --> Hidden
        Hidden --> Overlay: tap hamburger
        Overlay --> Hidden: tap outside or close
    }

    state Tablet {
        [*] --> Collapsed
        Collapsed --> Expanded: click expand
        Expanded --> Collapsed: click collapse
    }

    state Desktop {
        [*] --> AlwaysVisible
    }

    Mobile --> Tablet: resize up
    Tablet --> Mobile: resize down
    Tablet --> Desktop: resize up
    Desktop --> Tablet: resize down
```
