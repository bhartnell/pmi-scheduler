# Components Directory

This directory contains reusable React components for the PMI EMS Scheduler application.

## Directory Structure

```
components/
├── clinical/             # Clinical tracking components
├── dashboard/            # Dashboard page components
│   ├── widgets/         # Dashboard widget components
│   ├── CustomizeModal.tsx
│   └── WidgetCard.tsx
├── ui/                   # Reusable UI primitives
└── [feature components] # Standalone feature components
```

## UI Primitives (`ui/`)

Core reusable UI components used throughout the application:

- **LoadingSpinner** - Simple centered spinner for loading states
- **PageLoader** - Full-page loading indicator with backdrop
- **ButtonSpinner** - Inline spinner for button loading states
- **ContentLoader** - Skeleton loader for content placeholders
- **ErrorBoundary** - Error boundary wrapper to catch React errors
- **index.ts** - Barrel export for convenient imports

Usage:
```tsx
import { LoadingSpinner, PageLoader, ErrorBoundary } from '@/components/ui';
```

## Dashboard Components

### Dashboard Widgets (`dashboard/widgets/`)

Dashboard widgets are modular cards that display key information on the main dashboard. Each widget is a self-contained component that fetches its own data and handles its own state.

Available widgets:
- **MyLabsWidget** - Upcoming lab assignments for the current user
- **NeedsAttentionWidget** - Items requiring immediate action
- **NotificationsWidget** - Recent notifications and alerts
- **OnboardingWidget** - Onboarding progress for new users
- **OpenStationsWidget** - Available lab stations needing instructors
- **OverviewStatsWidget** - Summary statistics (students, labs, etc.)
- **QuickLinksWidget** - Frequently accessed pages
- **RecentFeedbackWidget** - Recent feedback submissions

Widgets follow a consistent pattern:
```tsx
export default function MyWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch widget data
  }, []);

  return (
    <WidgetCard title="Widget Title" icon={IconComponent}>
      {/* Widget content */}
    </WidgetCard>
  );
}
```

### Dashboard Utilities

- **WidgetCard** - Wrapper component for consistent widget styling
- **CustomizeModal** - Modal for customizing dashboard widget visibility

## Clinical Components

- **SummativeEvaluationsSection** - Clinical summative evaluation management

## Feature Components

Standalone components used across multiple pages:

- **BLSPlatinumChecklist** - BLS certification checklist tracker
- **EmailSettingsPanel** - Email notification preferences UI
- **ExportDropdown** - Multi-format export menu (Excel, PDF, Print)
- **FeedbackButton** - Floating feedback submission button
- **FieldTripAttendance** - Field trip attendance tracking
- **GlobalTimerBanner** - System-wide lab timer banner
- **LabHeader** - Standard header for lab management pages
- **LabTimer** - Lab timer control component
- **NotificationBell** - Notification bell with unread badge
- **Scheduler** - Scheduling poll/doodle component
- **SiteVisitAlerts** - Clinical site visit reminder alerts
- **StudentPicker** - Student selection dropdown
- **TaskKanban** - Kanban board for instructor tasks
- **ThemeToggle** - Light/dark mode toggle
- **TimerBanner** - Lab-specific timer banner

## Component Conventions

### File Organization
- Components are organized by feature or purpose
- Shared/reusable components live at the root level
- Feature-specific components are grouped in subdirectories

### Styling
- All components use Tailwind CSS for styling
- Dark mode support via `dark:` variant classes
- Responsive design with Tailwind breakpoints

### Data Fetching
- Most components fetch their own data via API routes
- Use `useEffect` + `fetch()` pattern for data loading
- Handle loading and error states appropriately

### Icons
- Use Lucide React for all icons
- Import only the icons you need: `import { IconName } from 'lucide-react'`

### Type Safety
- Components are written in TypeScript
- Props interfaces are defined inline or in separate type files
- Use proper typing for state and API responses

## Adding New Components

When creating new components:

1. Choose the appropriate directory:
   - Shared/reusable? Root level or `ui/`
   - Feature-specific? Feature subdirectory
   - Dashboard widget? `dashboard/widgets/`

2. Follow existing patterns:
   - Look at similar components for structure
   - Use consistent styling and spacing
   - Include proper loading/error states

3. Export properly:
   - Default export for standalone components
   - Named exports for utilities
   - Update barrel exports in `index.ts` files

4. Document complex components:
   - Add comments for non-obvious logic
   - Document props interfaces
   - Include usage examples if helpful
