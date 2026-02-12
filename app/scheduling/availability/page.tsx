'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Trash2,
  Home
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { InstructorAvailability, formatTime } from '@/types/scheduling';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export default function MyAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<InstructorAvailability[]>([]);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingEntry, setEditingEntry] = useState<InstructorAvailability | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    is_all_day: true,
    start_time: '08:00',
    end_time: '17:00',
    notes: '',
    repeat_weeks: 0
  });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (currentUser) {
      fetchAvailability();
    }
  }, [currentUser, currentDate]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const fetchAvailability = async () => {
    try {
      // Get first and last day of current month view (including padding)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Extend range to include visible days from prev/next month
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });

      const res = await fetch(`/api/scheduling/availability?${params}`);
      const data = await res.json();
      if (data.success) {
        setAvailability(data.availability || []);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Add days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Add days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Add days from next month
    const endPadding = 6 - lastDay.getDay();
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, InstructorAvailability[]>();
    availability.forEach(entry => {
      const key = entry.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    });
    return map;
  }, [availability]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDate(dateStr);

    const entries = availabilityByDate.get(dateStr);
    if (entries && entries.length > 0) {
      // Show existing entries for editing
      setEditingEntry(entries[0]);
      setModalMode('edit');
      setFormData({
        date: dateStr,
        is_all_day: entries[0].is_all_day,
        start_time: entries[0].start_time || '08:00',
        end_time: entries[0].end_time || '17:00',
        notes: entries[0].notes || '',
        repeat_weeks: 0
      });
    } else {
      // Add new availability
      setEditingEntry(null);
      setModalMode('add');
      setFormData({
        date: dateStr,
        is_all_day: true,
        start_time: '08:00',
        end_time: '17:00',
        notes: '',
        repeat_weeks: 0
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (formData.repeat_weeks > 0 && modalMode === 'add') {
        // Bulk create for recurring availability
        const entries = [];
        for (let i = 0; i <= formData.repeat_weeks; i++) {
          const date = new Date(formData.date);
          date.setDate(date.getDate() + i * 7);
          entries.push({
            date: date.toISOString().split('T')[0],
            is_all_day: formData.is_all_day,
            start_time: formData.is_all_day ? null : formData.start_time,
            end_time: formData.is_all_day ? null : formData.end_time,
            notes: formData.notes || null
          });
        }

        const res = await fetch('/api/scheduling/availability/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'Failed to save availability');
          return;
        }
      } else if (modalMode === 'edit' && editingEntry) {
        // Update existing
        const res = await fetch(`/api/scheduling/availability/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formData.date,
            is_all_day: formData.is_all_day,
            start_time: formData.is_all_day ? null : formData.start_time,
            end_time: formData.is_all_day ? null : formData.end_time,
            notes: formData.notes || null
          })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'Failed to update availability');
          return;
        }
      } else {
        // Create single entry
        const res = await fetch('/api/scheduling/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formData.date,
            is_all_day: formData.is_all_day,
            start_time: formData.is_all_day ? null : formData.start_time,
            end_time: formData.is_all_day ? null : formData.end_time,
            notes: formData.notes || null
          })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'Failed to save availability');
          return;
        }
      }

      setShowModal(false);
      fetchAvailability();
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Failed to save availability');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    if (!confirm('Delete this availability entry?')) return;

    try {
      const res = await fetch(`/api/scheduling/availability/${editingEntry.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchAvailability();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
        <div className="max-w-6xl mx-auto px-4 py-4">
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
            <span className="text-gray-900 dark:text-white">My Availability</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <Calendar className="w-7 h-7 text-green-600 dark:text-green-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Availability</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Calendar Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {formatMonthYear(currentDate)}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const dateStr = date.toISOString().split('T')[0];
              const dayAvailability = availabilityByDate.get(dateStr) || [];
              const hasAvailability = dayAvailability.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(date)}
                  className={`
                    min-h-[80px] p-2 border-t border-r dark:border-gray-700 text-left
                    hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                    ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''}
                    ${index % 7 === 0 ? 'border-l' : ''}
                  `}
                >
                  <div className={`
                    text-sm font-medium mb-1
                    ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}
                    ${isToday(date) ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}
                  `}>
                    {date.getDate()}
                  </div>
                  {hasAvailability && (
                    <div className="space-y-1">
                      {dayAvailability.slice(0, 2).map((entry, i) => (
                        <div
                          key={i}
                          className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded px-1 py-0.5 truncate"
                        >
                          {entry.is_all_day ? 'All day' : `${formatTime(entry.start_time!)} - ${formatTime(entry.end_time!)}`}
                        </div>
                      ))}
                      {dayAvailability.length > 2 && (
                        <div className="text-xs text-gray-500">+{dayAvailability.length - 2} more</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
            <span>Today</span>
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {modalMode === 'add' ? 'Add Availability' : 'Edit Availability'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_all_day"
                  checked={formData.is_all_day}
                  onChange={(e) => setFormData({ ...formData, is_all_day: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="is_all_day" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All Day
                </label>
              </div>

              {/* Time Range (if not all day) */}
              {!formData.is_all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Any notes about your availability..."
                />
              </div>

              {/* Repeat Weekly (only for add mode) */}
              {modalMode === 'add' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Repeat weekly for
                  </label>
                  <select
                    value={formData.repeat_weeks}
                    onChange={(e) => setFormData({ ...formData, repeat_weeks: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={0}>Don't repeat</option>
                    <option value={4}>4 weeks</option>
                    <option value={8}>8 weeks</option>
                    <option value={12}>12 weeks</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
              <div>
                {modalMode === 'edit' && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
