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
  Repeat
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { DEPARTMENT_OPTIONS, type ShiftDepartment, type CurrentUser } from '@/types';

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

function CreateShiftPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    repeat: '' as '' | 'weekly' | 'biweekly' | 'monthly',
    repeat_until: '',
    lab_day_id: searchParams.get('labDayId') || ''
  });

  const [upcomingLabDays, setUpcomingLabDays] = useState<LabDay[]>([]);
  const [existingShifts, setExistingShifts] = useState<ExistingShift[]>([]);
  const [showCalendar, setShowCalendar] = useState(true);

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
        // Check if user is director (admin/superadmin or director endorsement)
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

  // Fetch upcoming lab days and existing shifts
  useEffect(() => {
    const fetchScheduleData = async () => {
      const today = new Date().toISOString().split('T')[0];
      // Get next 60 days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const endDate = futureDate.toISOString().split('T')[0];

      try {
        // Fetch lab days and shifts in parallel
        const [labDaysRes, shiftsRes] = await Promise.all([
          fetch(`/api/lab-management/lab-days?startDate=${today}&endDate=${endDate}`),
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

  // Calculate number of shifts that will be created
  const calculateRecurringDates = () => {
    if (!formData.repeat || !formData.repeat_until || !formData.date) return [];

    const dates: string[] = [];
    const startDate = new Date(formData.date);
    const endDate = new Date(formData.repeat_until);
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);

      if (formData.repeat === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (formData.repeat === 'biweekly') {
        currentDate.setDate(currentDate.getDate() + 14);
      } else if (formData.repeat === 'monthly') {
        const originalDay = startDate.getDate();
        currentDate.setMonth(currentDate.getMonth() + 1);
        // Handle months with fewer days
        const maxDays = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        currentDate.setDate(Math.min(originalDay, maxDays));
      }
    }

    return dates;
  };

  const recurringDates = calculateRecurringDates();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.date || !formData.start_time || !formData.end_time) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.repeat && !formData.repeat_until) {
      alert('Please select an end date for recurring shifts');
      return;
    }

    setSaving(true);
    try {
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
          repeat: formData.repeat || undefined,
          repeat_until: formData.repeat_until || undefined,
          lab_day_id: formData.lab_day_id || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        router.push('/scheduling/shifts');
      } else {
        alert(data.error || 'Failed to create shift');
      }
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('Failed to create shift');
    }
    setSaving(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/scheduling/shifts"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shifts
        </Link>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., EMT Lab Coverage"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Additional details about the shift..."
              />
            </div>

            {/* Date and Times */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Location and Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., EMT Classroom, Skills Lab"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Department
                </label>
                <select
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Minimum Instructors Needed
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.min_instructors}
                  onChange={(e) => setFormData({ ...formData, min_instructors: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Maximum Instructors (optional)
                </label>
                <input
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Link to Lab Day (optional)
              </label>
              <select
                value={formData.lab_day_id}
                onChange={(e) => setFormData({ ...formData, lab_day_id: e.target.value })}
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
                Link this shift to a scheduled lab day for better organization
              </p>
            </div>

            {/* Recurring Shifts */}
            <div className="border dark:border-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <Repeat className="w-4 h-4 inline mr-1" />
                Repeat
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="repeat"
                    value=""
                    checked={formData.repeat === ''}
                    onChange={() => setFormData({ ...formData, repeat: '', repeat_until: '' })}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Does not repeat</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="repeat"
                    value="weekly"
                    checked={formData.repeat === 'weekly'}
                    onChange={() => setFormData({ ...formData, repeat: 'weekly' })}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Weekly</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="repeat"
                    value="biweekly"
                    checked={formData.repeat === 'biweekly'}
                    onChange={() => setFormData({ ...formData, repeat: 'biweekly' })}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Bi-weekly</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="repeat"
                    value="monthly"
                    checked={formData.repeat === 'monthly'}
                    onChange={() => setFormData({ ...formData, repeat: 'monthly' })}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Monthly</span>
                </label>
              </div>

              {formData.repeat && (
                <div className="mt-4 pt-4 border-t dark:border-gray-600">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Repeat until <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.repeat_until}
                    onChange={(e) => setFormData({ ...formData, repeat_until: e.target.value })}
                    min={formData.date || new Date().toISOString().split('T')[0]}
                    className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required={!!formData.repeat}
                  />
                  {recurringDates.length > 0 && (
                    <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                      This will create <strong>{recurringDates.length}</strong> shift{recurringDates.length !== 1 ? 's' : ''}
                      {recurringDates.length <= 10 && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {' '}({recurringDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ')})
                        </span>
                      )}
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
              disabled={saving || (!!formData.repeat && !formData.repeat_until)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving
                ? `Creating${recurringDates.length > 1 ? ` ${recurringDates.length} shifts` : ''}...`
                : recurringDates.length > 1
                  ? `Create ${recurringDates.length} Shifts`
                  : 'Create Shift'
              }
            </button>
          </div>
        </form>

        {/* Upcoming Schedule Panel */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upcoming Schedule
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({upcomingLabDays.length} lab days, {existingShifts.length} shifts)
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showCalendar ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCalendar && (
            <div className="px-6 pb-6 border-t dark:border-gray-700">
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                {/* Lab Days */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    Scheduled Lab Days
                  </h3>
                  {upcomingLabDays.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No lab days scheduled</p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {upcomingLabDays.slice(0, 15).map((lab) => (
                        <li
                          key={lab.id}
                          className={`text-sm p-2 rounded-lg border dark:border-gray-600 ${
                            formData.date === lab.date
                              ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-600'
                              : 'bg-gray-50 dark:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {new Date(lab.date + 'T12:00:00').toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              {lab.title && (
                                <span className="ml-2 text-gray-600 dark:text-gray-400">
                                  {lab.title}
                                </span>
                              )}
                            </div>
                            {lab.cohort && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                                {lab.cohort.program?.abbreviation || 'PMD'} {lab.cohort.cohort_number}
                              </span>
                            )}
                          </div>
                          {lab.start_time && lab.end_time && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {lab.start_time.slice(0, 5)} - {lab.end_time.slice(0, 5)}
                            </div>
                          )}
                        </li>
                      ))}
                      {upcomingLabDays.length > 15 && (
                        <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                          +{upcomingLabDays.length - 15} more lab days...
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Existing Shifts */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    Existing Shifts
                  </h3>
                  {existingShifts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No shifts scheduled</p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {existingShifts.slice(0, 15).map((shift) => (
                        <li
                          key={shift.id}
                          className={`text-sm p-2 rounded-lg border dark:border-gray-600 ${
                            formData.date === shift.date
                              ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600'
                              : 'bg-gray-50 dark:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              <span className="ml-2 text-gray-600 dark:text-gray-400">
                                {shift.title}
                              </span>
                            </div>
                            {shift.department && (
                              <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded">
                                {shift.department}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                          </div>
                        </li>
                      ))}
                      {existingShifts.length > 15 && (
                        <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                          +{existingShifts.length - 15} more shifts...
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Conflict warning */}
              {formData.date && (
                (() => {
                  const hasLabConflict = upcomingLabDays.some(l => l.date === formData.date);
                  const hasShiftConflict = existingShifts.some(s => s.date === formData.date);
                  if (!hasLabConflict && !hasShiftConflict) return null;

                  return (
                    <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Selected date ({new Date(formData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}) already has:
                        {hasLabConflict && <span className="font-medium"> a scheduled lab day</span>}
                        {hasLabConflict && hasShiftConflict && ' and'}
                        {hasShiftConflict && <span className="font-medium"> an existing shift</span>}
                      </p>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CreateShiftPage() {
  return (
    <Suspense>
      <CreateShiftPageInner />
    </Suspense>
  );
}
