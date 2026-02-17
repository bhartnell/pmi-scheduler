# PMI EMS Scheduler - React Components Inventory

## Overview

This document catalogs all shared React components in the `components/` directory, organized by category.

---

## Layout Components

### LabHeader

**File:** `components/LabHeader.tsx`

Navigation header for lab management pages with logo, breadcrumbs, user info, and action slots.

```tsx
interface Props {
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  actions?: React.ReactNode;
}
```

**Features:**
- NotificationBell integration
- ThemeToggle
- User authentication display
- Responsive breadcrumbs

**Used In:** Lab management pages, clinical pages

---

### WidgetCard

**File:** `components/dashboard/WidgetCard.tsx`

Reusable dashboard widget container with header, optional link, and loading states.

```tsx
interface Props {
  title: string;
  icon?: ReactNode;
  viewAllLink?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  loading?: boolean;
}
```

**Also Exports:** `WidgetEmpty` - Empty state component for widgets

**Used In:** Dashboard, all widget implementations

---

## Form Components

### StudentPicker

**File:** `components/StudentPicker.tsx`

Searchable dropdown for selecting a single student with photo preview.

```tsx
interface Props {
  students: Student[];
  value: string;
  onChange: (studentId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Features:**
- Photo display with initials fallback
- Search filtering
- Keyboard navigation

**Used In:** Lab management, task assignment, grading

---

### EmailSettingsPanel

**File:** `components/EmailSettingsPanel.tsx`

Email notification preferences panel with category filtering and frequency selection.

```tsx
interface Props {
  compact?: boolean;  // Without header/container styling
}
```

**Features:**
- Enable/disable toggle
- Frequency modes: immediate, daily digest, off
- Category toggles: tasks, labs, scheduling, feedback, clinical, system
- Auto-saves to API

**Used In:** Settings pages, notification center

---

### CustomizeModal

**File:** `components/dashboard/CustomizeModal.tsx`

Modal for customizing dashboard widget visibility and order.

```tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  widgets: string[];
  quickLinks: string[];
  onSave: (widgets: string[], quickLinks: string[]) => void;
  onReset: () => void;
}
```

**Features:**
- Drag-to-reorder widgets
- Enable/disable widgets
- Quick link selection
- Reset to defaults

**Used In:** Dashboard customization

---

## Data Display Components

### TaskKanban

**File:** `components/TaskKanban.tsx`

Kanban board with drag-and-drop task management across columns.

```tsx
interface KanbanTask {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  due_date?: string | null;
  created_by: string;
  assignees?: { id: string; name: string; email: string; status: string }[];
  comment_count?: number;
}

interface Props {
  tasks: KanbanTask[];
  currentUserId: string;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  showCancelled?: boolean;
}
```

**Features:**
- HTML5 drag-and-drop between columns
- Priority color indicators (low=green, medium=yellow, high=red)
- Due date display with overdue warnings
- Comment counts
- Multi-assignee indicators
- Permission-based editing

**Columns:** To Do, In Progress, Done, Cancelled (optional)

**Used In:** `/tasks` page

---

### Scheduler

**File:** `components/Scheduler.tsx` (1743 lines)

Comprehensive scheduling poll system for individual meetings and group sessions.

```tsx
interface Props {
  mode: 'create' | 'participant' | 'admin-view';
  pollData?: any;
  onComplete?: (data: any) => void;
}
```

**Features:**
- Three modes: creator setup, participant response, admin results
- Individual (hourly) and group (half-day blocks) scheduling
- Desktop drag-selection and mobile tap selection
- Best time analysis for all respondents
- Google Calendar integration
- Email notifications
- Respondent role filtering (student, FTO, agency, school, other)
- Mobile-optimized with day-by-day view

**Used In:** Meeting scheduling, internship coordination

---

### SummativeEvaluationsSection

**File:** `components/clinical/SummativeEvaluationsSection.tsx`

Display and create clinical summative evaluations for semester 4 final scenarios.

```tsx
interface Props {
  internshipId: string;
  studentId: string;
  studentName: string;
  cohortId: string | null;
  canEdit: boolean;
}
```

**Features:**
- List evaluations with status badges
- Create new evaluations with scenario selection
- Multi-student evaluation support (1-6 students)
- Student search/filter
- Scenario selection grid

**Used In:** Clinical tracking, internship details

---

### SiteVisitAlerts

**File:** `components/SiteVisitAlerts.tsx`

Display alerts for clinical sites needing visits with coverage tracking.

```tsx
interface Props {
  showOnlyWhenNeeded?: boolean;
  compact?: boolean;  // Link format vs full card
}
```

**Features:**
- Fetch and display sites needing visits
- Key site prioritization
- Last visit date tracking
- Refresh button with loading state

**Used In:** Clinical dashboard, instructor dashboards

---

### BLSPlatinumChecklist

**File:** `components/BLSPlatinumChecklist.tsx`

Checklist for tracking BLS/Platinum skills assigned to lab stations.

```tsx
interface Props {
  labDayId: string;
  currentStationId?: string;
  selectedSkillIds: string[];
  onToggleSkill?: (skillId: string) => void;
  readOnly?: boolean;
}
```

**Features:**
- Fetch skills from library and lab day
- Checkbox selection
- Show skills assigned to other stations
- Progress tracking

**Used In:** Lab station setup

---

### FieldTripAttendance

**File:** `components/FieldTripAttendance.tsx`

Manage and track field trip attendance with quick create/update.

```tsx
interface Props {
  cohortId: string;
  students: Student[];
}
```

**Features:**
- Create new field trips
- Select and manage attendance
- Mark all present quick action
- Grid-based attendance toggle
- Collapsible header

**Used In:** Lab management, cohort pages

---

## Feedback/Notification Components

### NotificationBell

**File:** `components/NotificationBell.tsx`

Header notification bell with dropdown list and category preferences.

**Props:** None (uses session from NextAuth)

**Features:**
- Unread count badge
- Dropdown with last 5 notifications
- Category-based filtering
- Notification preferences settings
- Mark as read (single and bulk)
- Polling (60s interval)
- Links to full notification view

**Used In:** LabHeader, main navigation

---

### FeedbackButton

**File:** `components/FeedbackButton.tsx`

Floating feedback submission button with modal form.

**Props:** None

**Features:**
- Floating action button (bottom-right)
- Modal form with three types: bug, feature, other
- Auto-captured info: page URL, user email, browser/OS
- Loading states and success confirmation

**Used In:** Global (all pages)

---

## Timer Components

### TimerBanner

**File:** `components/TimerBanner.tsx`

Station-level timer banner showing rotation progress with alerts.

```tsx
interface Props {
  labDayId: string;
  stationId?: string;
  userEmail?: string;
  userName?: string;
  numRotations?: number;
}
```

**Features:**
- Poll for active timer (5s running, 30s stopped)
- Countdown with color changes (green > yellow > red)
- Ready status toggle
- Sound alerts
- Connection status indicator

**Used In:** Lab grading pages

---

### LabTimer

**File:** `components/LabTimer.tsx` (1075 lines)

Full-screen lab rotation timer with controller interface.

```tsx
interface Props {
  labDayId: string;
  numRotations: number;
  rotationMinutes: number;
  onClose: () => void;
  isController?: boolean;
}
```

**Features:**
- Full-screen countdown display
- Controller buttons: play/pause, stop, reset, next rotation
- Station ready status tracking
- Large rotate/cleanup alerts
- Timer settings (countdown vs. count-up, debrief time)
- Sound control
- Fullscreen toggle
- Keyboard shortcuts (space, N, R, Esc)
- Previous timer detection

**Used In:** Lab management coordinator interface

---

### GlobalTimerBanner

**File:** `components/GlobalTimerBanner.tsx`

Global sticky banner showing active lab timer across all pages.

**Props:** None

**Features:**
- Auto-poll for active timer
- Display rotation info and time
- Quick link to open full timer
- Dismiss button
- Body padding adjustment
- Auto-dismiss when countdown reaches 0

**Used In:** Global layout

---

## Dashboard Widgets

Located in `components/dashboard/widgets/`:

| Widget | Description |
|--------|-------------|
| `MyLabsWidget` | User's assigned labs |
| `NeedsAttentionWidget` | Alerts and items needing action |
| `NotificationsWidget` | Recent notifications list |
| `OnboardingWidget` | Onboarding checklist/progress |
| `OpenStationsWidget` | Available lab stations |
| `OverviewStatsWidget` | Key statistics cards |
| `QuickLinksWidget` | Quick navigation links |
| `RecentFeedbackWidget` | Recent feedback entries |

---

## Utility Components

### ThemeToggle

**File:** `components/ThemeToggle.tsx`

Theme switcher button cycling through system/light/dark modes.

**Props:** None

**Features:**
- Three theme states with icons
- Uses next-themes for persistence
- Avoids hydration mismatch

**Used In:** LabHeader, global app

---

### ExportDropdown

**File:** `components/ExportDropdown.tsx`

Dropdown for exporting data in multiple formats.

```tsx
interface ExportConfig {
  title: string;
  filename: string;
  data: any[];
  columns: { header: string; key: string }[];
}

interface Props {
  config: ExportConfig;
  disabled?: boolean;
}
```

**Features:**
- Three export formats: print, PDF, Excel
- Loading states during export
- Click-outside to close

**Used In:** Data listing pages (rosters, schedules, reports)

---

## Component Patterns

### Common Patterns Used

1. **Client Components:** All use `'use client'` directive
2. **Dark Mode:** Support via Tailwind's `dark:` prefix
3. **Loading States:** Skeleton UI or spinner
4. **Error Handling:** API error states with retry
5. **Polling:** Intelligent intervals for real-time data
6. **Responsive Design:** Mobile-first with Tailwind breakpoints
7. **Icons:** Lucide React for consistency
8. **TypeScript:** Full type definitions with interfaces

### Import Patterns

```tsx
// Standard imports
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Icons
import { Settings, Users, Calendar } from 'lucide-react';

// Internal
import { WidgetCard, WidgetEmpty } from '@/components/dashboard/WidgetCard';
```

---

## Component Statistics

| Category | Count |
|----------|-------|
| Layout Components | 2 |
| Form Components | 4 |
| Data Display Components | 6 |
| Feedback/Notification | 2 |
| Timer Components | 3 |
| Dashboard Widgets | 8 |
| Utility Components | 2 |
| **Total** | **27** |

---

*Generated: 2026-02-17*
