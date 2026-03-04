# PMI EMS Scheduler - Components Reference

> Auto-generated from codebase scan on 2026-03-04

## Table of Contents

1. [Reusable UI Components](#reusable-ui-components)
2. [Layout & Navigation](#layout--navigation)
3. [Lab Management Components](#lab-management-components)
4. [Clinical Components](#clinical-components)
5. [Dashboard Widgets](#dashboard-widgets)
6. [Dashboard Infrastructure](#dashboard-infrastructure)
7. [Scheduling Components](#scheduling-components)
8. [Student Components](#student-components)
9. [Form & Input Components](#form--input-components)
10. [Feedback & Communication](#feedback--communication)
11. [UI Primitives](#ui-primitives)

---

## Reusable UI Components

### `LoadingSpinner`
**Path:** `components/LoadingSpinner.tsx`
**Type:** Reusable UI
**Description:** Simple animated spinner for loading states. No props required.

### `LoadingSkeleton`
**Path:** `components/LoadingSkeleton.tsx`
**Type:** Reusable UI
**Description:** Skeleton placeholder component for content loading states.

### `EmptyState`
**Path:** `components/EmptyState.tsx`
**Type:** Reusable UI
**Props:** `icon`, `title`, `description`, `action`
**Description:** Empty state display with icon, message, and optional action button. Used when lists or tables have no data.

### `ErrorBoundary`
**Path:** `components/ErrorBoundary.tsx`
**Type:** Reusable UI
**Props:** `children`, `fallback`
**Description:** React error boundary that catches render errors and displays a fallback UI.

### `PageErrorBoundary`
**Path:** `components/PageErrorBoundary.tsx`
**Type:** Reusable UI
**Props:** `children`, `featureName`
**Description:** Page-level error boundary with retry functionality and error reporting.

### `SectionErrorPage`
**Path:** `components/SectionErrorPage.tsx`
**Type:** Reusable UI
**Props:** `title`, `message`, `icon`, `actions`
**Description:** Full-page error display for section-level errors with customizable actions.

### `Toast` / `ToastProvider`
**Path:** `components/Toast.tsx`
**Type:** Reusable UI (Context Provider)
**Exports:** `ToastProvider`, `useToast`
**Description:** Toast notification system with success/error/info variants. Provider wraps app; `useToast()` hook for triggering notifications.

### `HelpTooltip`
**Path:** `components/HelpTooltip.tsx`
**Type:** Reusable UI
**Props:** `text`, `className`, `size`
**Description:** Small help icon that shows tooltip text on hover. Used next to form labels and headings.

### `ShareLink`
**Path:** `components/ShareLink.tsx`
**Type:** Reusable UI
**Props:** `url`, `title`, `description`, `compact`
**Description:** Shareable link display with copy-to-clipboard functionality.

### `QRCodeDisplay`
**Path:** `components/QRCodeDisplay.tsx`
**Type:** Reusable UI
**Props:** `url`, `size`, `title`, `subtitle`
**Description:** QR code generator and display component. Used for lab check-in URLs.

### `ExportDropdown`
**Path:** `components/ExportDropdown.tsx`
**Type:** Reusable UI
**Props:** `config`, `disabled`
**Description:** Dropdown menu for data export actions (CSV, PDF, etc.). Used across report pages.

### `ThemeToggle`
**Path:** `components/ThemeToggle.tsx`
**Type:** Reusable UI
**Description:** Dark/light mode toggle button. Uses next-themes for theme switching.

### `AutoSaveIndicator`
**Path:** `components/AutoSaveIndicator.tsx`
**Type:** Reusable UI
**Props:** `isSaving`, `lastSaved`, `error`
**Description:** Visual indicator showing auto-save status (saving, saved, error).

### `ButtonLoading`
**Path:** `components/ButtonLoading.tsx`
**Type:** Reusable UI
**Description:** Button component with built-in loading spinner state.

---

## Layout & Navigation

### `AppBanner`
**Path:** `components/AppBanner.tsx`
**Type:** Layout
**Description:** Application-wide banner for system messages and alerts. Displays at the top of the page.

### `LabHeader`
**Path:** `components/LabHeader.tsx`
**Type:** Layout
**Props:** `breadcrumbs`, `title`, `actions`
**Description:** Page header component with breadcrumb navigation and action buttons. Used across lab management pages.

### `CommandPalette`
**Path:** `components/CommandPalette.tsx`
**Type:** Layout
**Description:** Cmd+K command palette for quick navigation and actions. Searches pages, students, and scenarios.

### `QuickActionsMenu`
**Path:** `components/QuickActionsMenu.tsx`
**Type:** Layout
**Description:** Floating action menu with quick links to common operations.

### `NotificationBell`
**Path:** `components/NotificationBell.tsx`
**Type:** Layout
**Description:** Notification bell icon in the header. Shows unread count badge and dropdown preview of notifications.

### `KeyboardShortcutsHelp`
**Path:** `components/KeyboardShortcutsHelp.tsx`
**Type:** Layout
**Props:** `shortcuts`, `isOpen`, `onClose`
**Description:** Modal overlay showing available keyboard shortcuts for the current page.

### `OfflineBanner`
**Path:** `components/OfflineBanner.tsx`
**Type:** Layout
**Description:** Banner that appears when the user loses internet connectivity.

### `OfflineProvider`
**Path:** `components/OfflineProvider.tsx`
**Type:** Context Provider
**Exports:** `OfflineProvider`, `useOffline`
**Description:** Context provider for offline detection. Wraps app and provides `useOffline()` hook.

### `ServiceWorkerRegistration`
**Path:** `components/ServiceWorkerRegistration.tsx`
**Type:** Utility
**Description:** Registers the service worker for PWA functionality and offline support.

### `ActivityTracker`
**Path:** `components/ActivityTracker.tsx`
**Type:** Utility
**Description:** Invisible component that logs page visits to the user_activity table for analytics.

---

## Lab Management Components

### `LabTimer`
**Path:** `components/LabTimer.tsx`
**Type:** Feature
**Props:** `labDayId`, `isLabLead`, `mode`, `duration`, etc.
**Description:** Full lab rotation timer with countdown/countup modes, pause/resume, rotation tracking, and audio alerts for debrief time.

### `InlineTimerWidget`
**Path:** `components/InlineTimerWidget.tsx`
**Type:** Feature
**Props:** `labDayId`, `onOpenFullTimer`
**Description:** Compact timer display that shows current rotation status inline. Click to expand to full timer.

### `TimerBanner`
**Path:** `components/TimerBanner.tsx`
**Type:** Feature
**Props:** `labDayId`, `rotation`, `status`, `timeRemaining`, etc.
**Description:** Sticky banner showing timer status at the top of lab day pages.

### `GlobalTimerBanner`
**Path:** `components/GlobalTimerBanner.tsx`
**Type:** Feature
**Description:** App-wide banner showing active timer status. Appears on all pages when a timer is running.

### `AttendanceSection`
**Path:** `components/AttendanceSection.tsx`
**Type:** Feature
**Props:** `labDayId`, `cohortId`
**Description:** Student attendance tracking section for lab days. Mark present/absent/excused/late with notes.

### `AttendanceAlertBanner`
**Path:** `components/AttendanceAlertBanner.tsx`
**Type:** Feature
**Props:** `studentId`
**Description:** Alert banner shown on student profiles when attendance issues are detected.

### `FieldTripAttendance`
**Path:** `components/FieldTripAttendance.tsx`
**Type:** Feature
**Props:** `cohortId`, `students`
**Description:** Field trip attendance tracking interface with student checkboxes.

### `BLSPlatinumChecklist`
**Path:** `components/BLSPlatinumChecklist.tsx`
**Type:** Feature
**Props:** `stationId`, `studentId`, `labDayId`, `skills`, etc.
**Description:** BLS/Platinum skill checklist grading interface. Used at lab stations for skill evaluation.

### `LabCalendarPanel`
**Path:** `components/LabCalendarPanel.tsx`
**Type:** Feature
**Props:** `cohortId`, `labDays`, `selectedDate`, `onSelect`, etc.
**Description:** Calendar panel showing lab day schedule with date selection. Used in lab schedule views.

### `LabDayTemplateSelector`
**Path:** `components/LabDayTemplateSelector.tsx`
**Type:** Feature
**Props:** `onSelect`, `selectedTemplateId`, `program`, `semester`
**Description:** Template browser and selector for creating new lab days from templates. Searchable with filters.

### `TemplateDiffModal`
**Path:** `components/TemplateDiffModal.tsx`
**Type:** Feature
**Props:** `isOpen`, `onClose`, `currentData`, `templateData`, etc.
**Description:** Side-by-side diff comparison modal showing changes between template versions or current vs. template.

### `TemplateGuideSection`
**Path:** `components/TemplateGuideSection.tsx`
**Type:** Feature
**Props:** `metadata`
**Description:** Displays template metadata and guidance notes when applying a lab day template.

### `StudentPicker`
**Path:** `components/StudentPicker.tsx`
**Type:** Feature
**Props:** `students`, `selectedIds`, `onSelect`, `cohortId`
**Description:** Searchable student picker/selector for assigning students to groups, stations, etc.

### `CapacityWarning`
**Path:** `components/CapacityWarning.tsx`
**Type:** Feature
**Props:** `current`, `max`, `label`, `showBar`
**Description:** Visual capacity indicator with warning colors when approaching or exceeding limits.

---

## Scenario Components

### `ScenarioVersionHistory`
**Path:** `components/ScenarioVersionHistory.tsx`
**Type:** Feature
**Props:** `scenarioId`, `versions`, `onRestore`
**Description:** Version history timeline for scenarios. Shows diffs between versions with restore capability.

### `ScenarioDifficultyRecommendation`
**Path:** `components/ScenarioDifficultyRecommendation.tsx`
**Type:** Feature
**Props:** `scenarioId`, `studentId`, `cohortId`
**Description:** AI-assisted scenario difficulty recommendation based on student performance history.

---

## Clinical Components

### `CloseoutSection`
**Path:** `components/clinical/CloseoutSection.tsx`
**Type:** Feature
**Props:** `internshipId`, `studentId`, `canEdit`, `onUpdate`
**Description:** Internship closeout workflow section. Manages closeout checklist, documents, and completion status.

### `CloseoutSurveyModal`
**Path:** `components/clinical/CloseoutSurveyModal.tsx`
**Type:** Feature
**Props:** `isOpen`, `onClose`, `internshipId`, `surveyType`, `agencyName`, etc.
**Description:** Modal form for completing internship closeout surveys (hospital and field preceptor types).

### `PreceptorsSection`
**Path:** `components/clinical/PreceptorsSection.tsx`
**Type:** Feature
**Props:** `internshipId`, `canEdit`
**Description:** Multi-preceptor assignment management section. Add, edit, and manage preceptor assignments for an internship.

### `PreceptorEvalModal`
**Path:** `components/clinical/PreceptorEvalModal.tsx`
**Type:** Feature
**Props:** `isOpen`, `onClose`, `internshipId`, `studentId`
**Description:** Modal for sending preceptor evaluation request emails with configurable token expiration.

### `EmploymentVerificationModal`
**Path:** `components/clinical/EmploymentVerificationModal.tsx`
**Type:** Feature
**Props:** `isOpen`, `onClose`, `internshipId`, `studentName`, etc.
**Description:** Employment verification form modal for post-graduation tracking.

### `SummativeEvaluationsSection`
**Path:** `components/clinical/SummativeEvaluationsSection.tsx`
**Type:** Feature
**Props:** `studentId`, `cohortId`, `canEdit`
**Description:** Section showing summative evaluation results and progress for a student.

### `SiteVisitAlerts`
**Path:** `components/SiteVisitAlerts.tsx`
**Type:** Feature
**Props:** `cohortId`, `siteId`
**Description:** Alert component showing overdue or upcoming site visit reminders.

---

## Dashboard Widgets

### `QuickStatsWidget`
**Path:** `components/dashboard/widgets/QuickStatsWidget.tsx`
**Type:** Dashboard Widget
**Description:** Quick statistics card showing counts for students, lab days, and active scenarios.

### `OverviewStatsWidget`
**Path:** `components/dashboard/widgets/OverviewStatsWidget.tsx`
**Type:** Dashboard Widget
**Description:** Overview statistics with trend indicators for key program metrics.

### `MyLabsWidget`
**Path:** `components/dashboard/widgets/MyLabsWidget.tsx`
**Type:** Dashboard Widget
**Description:** Shows the current user's upcoming lab day assignments with date and station info.

### `MyTasksWidget`
**Path:** `components/dashboard/widgets/MyTasksWidget.tsx`
**Type:** Dashboard Widget
**Description:** Personal task list widget showing pending and in-progress tasks.

### `NotificationsWidget`
**Path:** `components/dashboard/widgets/NotificationsWidget.tsx`
**Type:** Dashboard Widget
**Description:** Recent notifications preview widget with link to full notification center.

### `QuickLinksWidget`
**Path:** `components/dashboard/widgets/QuickLinksWidget.tsx`
**Type:** Dashboard Widget
**Props:** `links`
**Description:** Configurable quick links grid widget. Links are customizable per user preferences.

### `OnboardingWidget`
**Path:** `components/dashboard/widgets/OnboardingWidget.tsx`
**Type:** Dashboard Widget
**Description:** Onboarding progress widget showing task completion status for new instructors.

### `RecentActivityWidget`
**Path:** `components/dashboard/widgets/RecentActivityWidget.tsx`
**Type:** Dashboard Widget
**Description:** Activity feed showing recent actions across the system (new students, graded stations, etc.).

### `RecentFeedbackWidget`
**Path:** `components/dashboard/widgets/RecentFeedbackWidget.tsx`
**Type:** Dashboard Widget
**Description:** Shows recent feedback submissions and their resolution status. Admin-focused.

### `NeedsAttentionWidget`
**Path:** `components/dashboard/widgets/NeedsAttentionWidget.tsx`
**Type:** Dashboard Widget
**Description:** Aggregated attention items (overdue tasks, expiring certs, pending approvals).

### `CertExpiryWidget`
**Path:** `components/dashboard/widgets/CertExpiryWidget.tsx`
**Type:** Dashboard Widget
**Description:** Shows upcoming certification expirations for the current user.

### `AtRiskStudentsWidget`
**Path:** `components/dashboard/widgets/AtRiskStudentsWidget.tsx`
**Type:** Dashboard Widget
**Description:** Lists students flagged as at-risk based on attendance, performance, or compliance.

### `OverdueTasksWidget`
**Path:** `components/dashboard/widgets/OverdueTasksWidget.tsx`
**Type:** Dashboard Widget
**Description:** Shows overdue tasks across all assignees for admin visibility.

### `OpenStationsWidget`
**Path:** `components/dashboard/widgets/OpenStationsWidget.tsx`
**Type:** Dashboard Widget
**Description:** Lists lab stations that still need instructor assignments.

---

## Dashboard Infrastructure

### `WidgetCard`
**Path:** `components/dashboard/WidgetCard.tsx`
**Type:** Dashboard Infrastructure
**Props:** `title`, `icon`, `children`, `headerAction`, `collapsible`
**Description:** Card container for dashboard widgets. Provides consistent header, collapse, and styling.

### `ResizableWidget`
**Path:** `components/dashboard/ResizableWidget.tsx`
**Type:** Dashboard Infrastructure
**Props:** `widgetId`, `title`, `children`, `defaultSize`
**Description:** Wrapper that adds resize controls (small/medium/large) to dashboard widgets.

### `DraggableWidgetGrid`
**Path:** `components/dashboard/DraggableWidgetGrid.tsx`
**Type:** Dashboard Infrastructure
**Props:** `widgets`, `onReorder`
**Description:** Grid container supporting drag-and-drop widget reordering.

### `CustomizeModal`
**Path:** `components/dashboard/CustomizeModal.tsx`
**Type:** Dashboard Infrastructure
**Props:** `isOpen`, `onClose`, `widgets`, `onSave`
**Description:** Modal for customizing which dashboard widgets are visible and their order.

### `AnnouncementBanner`
**Path:** `components/dashboard/AnnouncementBanner.tsx`
**Type:** Dashboard Feature
**Description:** Displays active system announcements as dismissible banners on the dashboard.

---

## Scheduling Components

### `Scheduler`
**Path:** `components/Scheduler.tsx`
**Type:** Feature
**Props:** `mode`, `pollData`, `onComplete`
**Description:** Scheduling poll interface component. Handles poll creation mode and response mode.

### `SwapInterestPanel`
**Path:** `components/SwapInterestPanel.tsx`
**Type:** Feature
**Props:** `swapRequestId`, `currentUserId`, `isRequester`
**Description:** Panel showing interest in a shift swap request with accept/decline controls.

---

## Student Components

### `StudentCommunications`
**Path:** `components/StudentCommunications.tsx`
**Type:** Feature
**Props:** `studentId`, `studentName`
**Description:** Communication log for a student. Add and view phone, email, meeting, and text interactions.

### `LearningStyleBadge`
**Path:** `components/LearningStyleBadge.tsx`
**Type:** Reusable UI
**Props:** `style`, `size`, `showTooltip`
**Description:** Color-coded badge displaying a student's learning style (visual, auditory, kinesthetic, reading/writing).

### `LearningStyleDistribution`
**Path:** `components/LearningStyleDistribution.tsx`
**Type:** Feature
**Props:** `students`, `title`, `compact`
**Description:** Bar chart visualization showing learning style distribution across a student group.

### `LearningPlanBanner`
**Path:** `components/LearningPlanBanner.tsx`
**Type:** Feature
**Props:** `studentId`
**Description:** Banner alert shown when a student has an active learning plan. Links to plan details.

### `BulkPhotoUpload`
**Path:** `components/BulkPhotoUpload.tsx`
**Type:** Feature
**Props:** `students`, `onComplete`, `onClose`
**Description:** Bulk photo upload interface for matching student photos to records by name.

---

## Onboarding Components

### `OnboardingTour`
**Path:** `components/OnboardingTour.tsx`
**Type:** Feature
**Props:** `steps`, `onComplete`, `onSkip`, `role`
**Description:** Interactive guided tour overlay that highlights page elements with step-by-step instructions.

### `OnboardingTourWrapper`
**Path:** `components/OnboardingTourWrapper.tsx`
**Type:** Feature
**Description:** Wrapper that initializes and manages the onboarding tour state. Checks if tour has been completed.

### `WelcomeModal`
**Path:** `components/WelcomeModal.tsx`
**Type:** Feature
**Props:** `userName`, `role`, `onStartTour`, `onSkip`
**Description:** Welcome modal shown to new users with option to start the guided tour.

### `WhatsNewModal`
**Path:** `components/WhatsNewModal.tsx`
**Type:** Feature
**Props:** `forceShow`, `onClose`
**Description:** Modal showing recent feature updates and changes. Tracks which version the user has seen.

### `WhatsNewWrapper`
**Path:** `components/WhatsNewWrapper.tsx`
**Type:** Feature
**Description:** Wrapper that checks if there are new features to show and renders WhatsNewModal.

---

## Form & Input Components

### `FormField`
**Path:** `components/FormField.tsx`
**Type:** Reusable UI
**Props:** `label`, `id`, `error`, `required`, `helpText`, `children`
**Description:** Consistent form field wrapper with label, error message display, and help text.

### `FormError`
**Path:** `components/FormError.tsx`
**Type:** Reusable UI
**Props:** `message`
**Description:** Inline form validation error message display.

### `EmailSettingsPanel`
**Path:** `components/EmailSettingsPanel.tsx`
**Type:** Feature
**Props:** `compact`
**Description:** Email notification preferences panel. Configure which email notifications to receive.

### `TwoFactorPanel`
**Path:** `components/TwoFactorPanel.tsx`
**Type:** Feature
**Description:** Two-factor authentication setup and management panel. QR code display, backup codes, enable/disable.

---

## Feedback & Communication

### `FeedbackButton`
**Path:** `components/FeedbackButton.tsx`
**Type:** Feature
**Description:** Floating feedback button that opens a bug report/feature request form. Present on all pages.

### `TaskKanban`
**Path:** `components/TaskKanban.tsx`
**Type:** Feature
**Props:** `tasks`, `onUpdate`, `onDelete`, `currentUser`, etc.
**Description:** Kanban board view for task management. Columns for pending, in-progress, and completed tasks with drag-and-drop.

---

## UI Primitives (`components/ui/`)

### `ButtonLoading`
**Path:** `components/ui/ButtonLoading.tsx`
**Type:** UI Primitive
**Props:** Extends `ButtonHTMLAttributes` + `loading`, `loadingText`, `variant`
**Description:** Button with loading state. Shows spinner and optional loading text when `loading` is true.

### `ButtonSpinner`
**Path:** `components/ui/ButtonSpinner.tsx`
**Type:** UI Primitive
**Props:** `className`
**Description:** Small spinner icon sized for use inside buttons.

### `LoadingSpinner`
**Path:** `components/ui/LoadingSpinner.tsx`
**Type:** UI Primitive
**Props:** `size`, `className`, `label`
**Description:** Configurable loading spinner with size variants and accessible label.

### `PageLoader`
**Path:** `components/ui/PageLoader.tsx`
**Type:** UI Primitive
**Props:** `text`, `fullPage`
**Description:** Full-page loading state with centered spinner and optional text.

### `ContentLoader`
**Path:** `components/ui/ContentLoader.tsx`
**Type:** UI Primitive
**Exports:** `ContentLoader`, `SkeletonCard`, `SkeletonTableRow`, `SkeletonTable`, `SkeletonForm`, `SkeletonText`, `SkeletonStats`
**Description:** Collection of skeleton loading components for different content types (cards, tables, forms, text blocks, stat cards).

### `ErrorBoundary`
**Path:** `components/ui/ErrorBoundary.tsx`
**Type:** UI Primitive
**Exports:** `ErrorBoundary` (class), `ErrorFallback`, `PageErrorFallback`
**Description:** Error boundary class component with two fallback UI variants - inline and full-page.

---

## Summary

| Category | Count |
|----------|-------|
| Reusable UI | 15 |
| Layout & Navigation | 11 |
| Lab Management | 15 |
| Scenario | 2 |
| Clinical | 7 |
| Dashboard Widgets | 14 |
| Dashboard Infrastructure | 5 |
| Scheduling | 2 |
| Student | 5 |
| Onboarding | 5 |
| Form & Input | 4 |
| Feedback & Communication | 2 |
| UI Primitives | 6 |
| **Total** | **93** |
