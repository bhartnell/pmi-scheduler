'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Clock,
  ArrowLeft,
  Home,
  Calendar,
  MapPin,
  Users,
  FileText,
  Repeat,
  X,
  ChevronDown
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import HelpTooltip from '@/components/HelpTooltip';
import LabCalendarPanel from '@/components/LabCalendarPanel';
import FormField from '@/components/FormField';
import FormError from '@/components/FormError';
import { validators } from '@/lib/validation';
import { DEPARTMENT_OPTIONS, type ShiftDepartment, type CurrentUser } from '@/types';
import { PageLoader } from '@/components/ui';

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  cohort: {
    cohort_number: string;
    program: { name: string; abbreviation: string } | null;
  } | null;
}

interface ExistingShift {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  department: string | null;
}

function formatDateDisplay(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function generateRecurringDates(
  startDate: string,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  untilDate: string
): string[] {
  if (!startDate || !untilDate) return [];

  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(untilDate + 'T12:00:00');

  if (end < start) return [];

  let current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);

    if (frequency === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (frequency === 'biweekly') {
      current.setDate(current.getDate() + 14);
    } else if (frequency === 'monthly') {
      const originalDay = start.getDate();
      current.setMonth(current.getMonth() + 1);
      // Handle months with fewer days (e.g. Jan 31 -> Feb 28)
      const maxDays = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      current.setDate(Math.min(originalDay, maxDays));
    }
  }

  return dates;
}

function CreateShiftPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: searchParams.get('date') || '',
    start_time: searchParams.get('start') || '08:00',
    end_time: searchParams.get('end') || '17:00',
    location: '',
    department: '' as ShiftDepartment | '',
    min_instructors: 1,
    max_instructors: '',
    lab_day_id: searchParams.get('labDayId') || ''
  });

  // Repeat settings (separate from main formData for clarity)
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [repeatUntil, setRepeatUntil] = useState('');

  // Preview date list — starts as the generated list, user can remove individual dates
  const [previewDates, setPreviewDates] = useState<string[]>([]);

  const [upcomingLabDays, setUpcomingLabDays] = useState<LabDay[]>([]);
  const [existingShifts, setExistingShifts] = useState<ExistingShift[]>([]);
  // Tracks whether the date was filled by clicking the calendar (for visual feedback)
  const [calendarFilledFrom, setCalendarFilledFrom] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        const isAdmin = data.user.role === 'admin' || data.user.role === 'superadmin';
        const hasDirectorEndorsement = Array.isArray(data.user.endorsements) &&
          data.user.endorsements.some((e: { endorsement_type: string }) => e.endorsement_type === 'director');
        if (!isAdmin && !hasDirectorEndorsement) {
          alert('Only directors can create shifts');
          router.push('/scheduling/shifts');
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  // Fetch upcoming lab days and existing shifts (90 days out for calendar coverage)
  useEffect(() => {
    const fetchScheduleData = async () => {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);
      const endDate = futureDate.toISOString().split('T')[0];

      try {
        const [labDaysRes, shiftsRes] = await Promise.all([
          fetch(`/api/lab-management/lab-days?startDate=${today}&endDate=${endDate}&limit=100`),
          fetch(`/api/scheduling/shifts?start_date=${today}&end_date=${endDate}`)
        ]);

        const labDaysData = await labDaysRes.json();
        const shiftsData = await shiftsRes.json();

        if (labDaysData.success) {
          setUpcomingLabDays(labDaysData.labDays || []);
        }
        if (shiftsData.success) {
          setExistingShifts(shiftsData.shifts || []);
        }
      } catch (error) {
        console.error('Error fetching schedule data:', error);
      }
    };

    fetchScheduleData();
  }, []);

  // Regenerate preview dates whenever repeat settings change
  useEffect(() => {
    if (repeatEnabled && formData.date && repeatUntil) {
      const generated = generateRecurringDates(formData.date, repeatFrequency, repeatUntil);
      setPreviewDates(generated);
    } else if (repeatEnabled && formData.date && !repeatUntil) {
      // Show just the start date when until date not yet set
      setPreviewDates(formData.date ? [formData.date] : []);
    } else {
      setPreviewDates([]);
    }
  }, [repeatEnabled, formData.date, repeatFrequency, repeatUntil]);

  const validateShiftForm = (): boolean => {
    const errors: Record<string, string> = {};

    const titleErr = validators.required(formData.title, 'Title');
    if (titleErr) errors.title = titleErr;

    const dateErr = validators.required(formData.date, 'Date');
    if (dateErr) errors.date = dateErr;

    const startErr = validators.required(formData.start_time, 'Start time');
    if (startErr) errors.start_time = startErr;

    const endErr = validators.required(formData.end_time, 'End time');
    if (endErr) errors.end_time = endErr;

    if (!errors.start_time && !errors.end_time) {
      const timeRangeErr = validators.timeRange(formData.start_time, formData.end_time);
      if (timeRangeErr) errors.end_time = timeRangeErr;
    }

    if (!errors.date && formData.date) {
      const today = new Date().toISOString().split('T')[0];
      if (formData.date < today) {
        errors.date = 'Date must be today or in the future';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: keyof typeof formData) => {
    const value = String(formData[field] ?? '');
    let error: string | null = null;

    if (field === 'title') {
      error = validators.required(value, 'Title');
    } else if (field === 'date') {
      error = validators.required(value, 'Date');
      if (!error && value) {
        const today = new Date().toISOString().split('T')[0];
        if (value < today) error = 'Date must be today or in the future';
      }
    } else if (field === 'start_time') {
      error = validators.required(value, 'Start time');
    } else if (field === 'end_time') {
      error = validators.required(value, 'End time');
      if (!error && formData.start_time) {
        error = validators.timeRange(formData.start_time, value);
      }
    }

    setFormErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const removePreviewDate = (dateToRemove: string) => {
    setPreviewDates(prev => prev.filter(d => d !== dateToRemove));
  };

  const handleToggleRepeat = (enabled: boolean) => {
    setRepeatEnabled(enabled);
    if (!enabled) {
      setRepeatUntil('');
      setPreviewDates([]);
    }
  };

  // Handler: called when a date or lab day is clicked in LabCalendarPanel
  const handleCalendarSelect = (date: string, labDay?: LabDay) => {
    const updates: Partial<typeof formData> = { date };

    if (labDay) {
      // Auto-fill times from the lab day when available
      if (labDay.start_time) updates.start_time = labDay.start_time.slice(0, 5);
      if (labDay.end_time) updates.end_time = labDay.end_time.slice(0, 5);
      // Link to this lab day
      updates.lab_day_id = labDay.id;
      setCalendarFilledFrom(labDay.id);
    } else {
      // Plain date click - just set the date, clear any stale calendar-fill state
      setCalendarFilledFrom(null);
    }

    setFormData(prev => ({ ...prev, ...updates }));

    // Scroll/focus the date field so the coordinator can see what was filled
    const dateInput = document.getElementById('shift-date-input');
    if (dateInput) dateInput.focus({ preventScroll: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateShiftForm()) {
      return;
    }

    if (repeatEnabled && !repeatUntil) {
      setFormErrors(prev => ({ ...prev, repeat_until: 'Please select an end date for recurring shifts' }));
      return;
    }

    if (repeatEnabled && previewDates.length === 0) {
      setFormErrors(prev => ({ ...prev, repeat_until: 'No dates to create. Please check your repeat settings.' }));
      return;
    }

    setSaving(true);

    try {
      if (repeatEnabled && previewDates.length > 1) {
        // Bulk create all preview dates at once via the dates array
        setSaveProgress(`Creating ${previewDates.length} shifts...`);

        const res = await fetch('/api/scheduling/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description || undefined,
            date: previewDates[0],
            start_time: formData.start_time,
            end_time: formData.end_time,
            location: formData.location || undefined,
            department: formData.department || undefined,
            min_instructors: formData.min_instructors,
            max_instructors: formData.max_instructors ? parseInt(formData.max_instructors) : undefined,
            dates: previewDates,
            lab_day_id: formData.lab_day_id || undefined
          })
        });

        const data = await res.json();
        if (data.success) {
          router.push('/scheduling/shifts');
        } else {
          alert(data.error || 'Failed to create shifts');
        }
      } else {
        // Single shift
        const res = await fetch('/api/scheduling/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description || undefined,
            date: formData.date,
            start_time: formData.start_time,
            end_time: formData.end_time,
            location: formData.location || undefined,
            department: formData.department || undefined,
            min_instructors: formData.min_instructors,
            max_instructors: formData.max_instructors ? parseInt(formData.max_instructors) : undefined,
            lab_day_id: formData.lab_day_id || undefined
          })
        });

        const data = await res.json();
        if (data.success) {
          router.push('/scheduling/shifts');
        } else {
          alert(data.error || 'Failed to create shift');
        }
      }
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('Failed to create shift');
    }

    setSaving(false);
    setSaveProgress('');
  };

  if (status === 'loading' || loading) {
    return <PageLoader message="Loading shift form..." />;
  }

  if (!session || !currentUser) return null;

  const submitLabel = saving
    ? (saveProgress || 'Creating...')
    : repeatEnabled && previewDates.length > 1
      ? `Create ${previewDates.length} Shifts`
      : 'Create Shift';

  const isSubmitDisabled = saving || (repeatEnabled && (!repeatUntil || previewDates.length === 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling/shifts" className="hover:text-blue-600 dark:hover:text-blue-400">
              Shifts
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">New</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Shift</h1>
          </div>
        </div>
      </header>

      {/* Main Content — two-column layout on lg+ */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/scheduling/shifts"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shifts
        </Link>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ---- LEFT: Shift Form ---- */}
        <div className="flex-1 min-w-0">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            {/* Title */}
            <FormField
              label="Title"
              htmlFor="shift-title"
              required
              error={formErrors.title}
            >
              <input
                id="shift-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onBlur={() => handleBlur('title')}
                aria-invalid={!!formErrors.title}
                aria-describedby={formErrors.title ? 'shift-title-error' : undefined}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  formErrors.title
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="e.g., EMT Lab Coverage"
                required
                aria-required="true"
              />
            </FormField>

            {/* Description */}
            <div>
              <label htmlFor="shift-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="shift-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Additional details about the shift..."
              />
            </div>

            {/* Date and Times */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Date"
                htmlFor="shift-date-input"
                required
                error={formErrors.date}
              >
                <>
                  <input
                    id="shift-date-input"
                    type="date"
                    value={formData.date}
                    onChange={(e) => {
                      setFormData({ ...formData, date: e.target.value });
                      setCalendarFilledFrom(null);
                    }}
                    onBlur={() => handleBlur('date')}
                    min={new Date().toISOString().split('T')[0]}
                    aria-invalid={!!formErrors.date}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${
                      formErrors.date
                        ? 'border-red-400 dark:border-red-500'
                        : calendarFilledFrom
                        ? 'border-green-400 dark:border-green-500 ring-1 ring-green-300 dark:ring-green-700'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    required
                    aria-required="true"
                  />
                  {calendarFilledFrom && !formErrors.date && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      Date and times filled from lab calendar
                    </p>
                  )}
                </>
              </FormField>

              <FormField
                label="Start Time"
                htmlFor="shift-start-time"
                required
                error={formErrors.start_time}
              >
                <input
                  id="shift-start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  onBlur={() => handleBlur('start_time')}
                  aria-invalid={!!formErrors.start_time}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.start_time
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                  aria-required="true"
                />
              </FormField>

              <FormField
                label="End Time"
                htmlFor="shift-end-time"
                required
                error={formErrors.end_time}
              >
                <input
                  id="shift-end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  onBlur={() => handleBlur('end_time')}
                  aria-invalid={!!formErrors.end_time}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.end_time
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                  aria-required="true"
                />
              </FormField>
            </div>

            {/* Location and Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="shift-location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Location
                </label>
                <input
                  id="shift-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., EMT Classroom, Skills Lab"
                />
              </div>

              <div>
                <label htmlFor="shift-department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Department
                </label>
                <select
                  id="shift-department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as ShiftDepartment | '' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENT_OPTIONS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Instructor counts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="shift-min-instructors" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Minimum Instructors Needed
                </label>
                <input
                  id="shift-min-instructors"
                  type="number"
                  min="1"
                  value={formData.min_instructors}
                  onChange={(e) => setFormData({ ...formData, min_instructors: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="shift-max-instructors" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Maximum Instructors (optional)
                </label>
                <input
                  id="shift-max-instructors"
                  type="number"
                  min="1"
                  value={formData.max_instructors}
                  onChange={(e) => setFormData({ ...formData, max_instructors: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Leave blank for unlimited"
                />
              </div>
            </div>

            {/* Link to Lab Day */}
            <div>
              <label htmlFor="shift-lab-day" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Link to Lab Day (optional)
              </label>
              <select
                id="shift-lab-day"
                value={formData.lab_day_id}
                onChange={(e) => {
                  setFormData({ ...formData, lab_day_id: e.target.value });
                  if (!e.target.value) setCalendarFilledFrom(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Not linked to any lab day</option>
                {upcomingLabDays.map(labDay => (
                  <option key={labDay.id} value={labDay.id}>
                    {new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                    {' - '}
                    {labDay.cohort?.program?.abbreviation || 'PMD'} {labDay.cohort?.cohort_number}
                    {labDay.title && ` - ${labDay.title}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Link this shift to a scheduled lab day. Clicking a lab day in the calendar panel (right) will auto-fill this field and the date.
              </p>
            </div>

            {/* Repeat Section */}
            <div className="border dark:border-gray-700 rounded-lg p-4">
              {/* Toggle Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                  <span id="repeat-shift-label" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    Repeat Shift
                    <HelpTooltip text="Creates multiple shifts on a recurring schedule until the end date. Choose weekly, bi-weekly, or monthly frequency." />
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={repeatEnabled}
                  aria-labelledby="repeat-shift-label"
                  onClick={() => handleToggleRepeat(!repeatEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    repeatEnabled
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      repeatEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Repeat Options — only shown when toggle is on */}
              {repeatEnabled && (
                <div className="mt-4 space-y-4">
                  {/* Frequency and Until on same row on md+ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Frequency dropdown */}
                    <div>
                      <label htmlFor="repeat-frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Frequency
                      </label>
                      <div className="relative">
                        <select
                          id="repeat-frequency"
                          value={repeatFrequency}
                          onChange={(e) => setRepeatFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                          className="w-full appearance-none px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="weekly">Weekly (every 7 days)</option>
                          <option value="biweekly">Bi-weekly (every 14 days)</option>
                          <option value="monthly">Monthly (same day each month)</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                      </div>
                    </div>

                    {/* Until date */}
                    <FormField
                      label="Until"
                      htmlFor="repeat-until"
                      required
                      error={formErrors.repeat_until}
                    >
                      <input
                        id="repeat-until"
                        type="date"
                        value={repeatUntil}
                        onChange={(e) => {
                          setRepeatUntil(e.target.value);
                          setFormErrors(prev => {
                            const next = { ...prev };
                            delete next.repeat_until;
                            return next;
                          });
                        }}
                        min={formData.date || new Date().toISOString().split('T')[0]}
                        aria-invalid={!!formErrors.repeat_until}
                        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          formErrors.repeat_until
                            ? 'border-red-400 dark:border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        aria-required={repeatEnabled}
                      />
                    </FormField>
                  </div>

                  {/* Preview list */}
                  {previewDates.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {previewDates.length === 1
                            ? '1 shift will be created'
                            : `${previewDates.length} shifts will be created`}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Click X to remove a date
                        </span>
                      </div>

                      <ul className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                        {previewDates.map((date, index) => (
                          <li
                            key={date}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs w-6 text-right text-gray-400 dark:text-gray-500 tabular-nums">
                                {index + 1}.
                              </span>
                              <span className="text-sm text-gray-800 dark:text-gray-200">
                                {formatDateDisplay(date)}
                              </span>
                              {upcomingLabDays.some(l => l.date === date) && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded">
                                  Lab day
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removePreviewDate(date)}
                              title="Remove this date"
                              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* No dates warning when until date is set but list is empty */}
                  {repeatUntil && previewDates.length === 0 && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      No dates remain. All were removed or the end date is before the start date.
                    </p>
                  )}

                  {/* Prompt to set until date */}
                  {!repeatUntil && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Select an end date above to preview the recurring dates.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t dark:border-gray-700">
            <Link
              href="/scheduling/shifts"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitLabel}
            </button>
          </div>
        </form>
        </div>{/* end LEFT column */}

        {/* ---- RIGHT: Lab Calendar Panel (sticky) ---- */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <div className="sticky top-6">
            <LabCalendarPanel
              labDays={upcomingLabDays}
              existingShifts={existingShifts}
              selectedDate={formData.date}
              onSelectDate={handleCalendarSelect}
            />
          </div>
        </div>

        </div>{/* end two-column flex wrapper */}
      </main>
    </div>
  );
}

export default function CreateShiftPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading shift form..." />}>
      <CreateShiftPageInner />
    </Suspense>
  );
}
