'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { DEPARTMENT_OPTIONS, ShiftDepartment } from '@/types/scheduling';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function CreateShiftPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '08:00',
    end_time: '17:00',
    location: '',
    department: '' as ShiftDepartment | '',
    min_instructors: 1,
    max_instructors: '',
    repeat: '' as '' | 'weekly' | 'biweekly' | 'monthly',
    repeat_until: ''
  });

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
        // Check if user is director (admin/superadmin)
        const isAdmin = data.user.role === 'admin' || data.user.role === 'superadmin';
        if (!isAdmin) {
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
          repeat_until: formData.repeat_until || undefined
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
      </main>
    </div>
  );
}
