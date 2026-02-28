'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Home,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { type InstructorAvailability, formatTime, type CurrentUser } from '@/types';

// ─── Suggestion types ───────────────────────────────────────────────────────

interface AvailabilitySuggestion {
  day_of_week: number;
  day_name: string;
  suggested: 'available' | 'unavailable';
  confidence: number;
  pattern: string;
}

interface SuggestionsResponse {
  success: boolean;
  suggestions: AvailabilitySuggestion[];
  weeks_analyzed: number;
}

// ─── Confidence helpers ──────────────────────────────────────────────────────

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return 'bg-green-500';
  if (confidence >= 60) return 'bg-amber-400';
  return 'bg-gray-400';
}

function confidenceTextColor(confidence: number): string {
  if (confidence >= 80) return 'text-green-700 dark:text-green-400';
  if (confidence >= 60) return 'text-amber-700 dark:text-amber-400';
  return 'text-gray-500 dark:text-gray-400';
}

function confidenceBadgeBg(confidence: number): string {
  if (confidence >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (confidence >= 60) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-gray-100 dark:bg-gray-700';
}

// ─── Suggestions Panel ───────────────────────────────────────────────────────

interface SuggestionsPanelProps {
  suggestions: AvailabilitySuggestion[];
  weeksAnalyzed: number;
  onApplyAll: (suggestions: AvailabilitySuggestion[]) => void;
  onApplyOne: (suggestion: AvailabilitySuggestion) => void;
  onDismiss: () => void;
}

function SuggestionsPanel({
  suggestions,
  weeksAnalyzed,
  onApplyAll,
  onApplyOne,
  onDismiss,
}: SuggestionsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [appliedDays, setAppliedDays] = useState<Set<number>>(new Set());

  const handleApplyOne = (suggestion: AvailabilitySuggestion) => {
    onApplyOne(suggestion);
    setAppliedDays(prev => new Set(prev).add(suggestion.day_of_week));
  };

  const handleApplyAll = () => {
    onApplyAll(suggestions);
    setAppliedDays(new Set(suggestions.map(s => s.day_of_week)));
  };

  // Only show suggestions with meaningful confidence (>= 50%)
  const actionable = suggestions.filter(s => s.confidence >= 50);

  if (actionable.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 mb-4 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold text-sm hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          Smart Suggestions
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center gap-2">
          {expanded && (
            <button
              onClick={handleApplyAll}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply All
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Dismiss suggestions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel body */}
      {expanded && (
        <div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Based on your last {weeksAnalyzed} weeks of submissions
          </p>

          <div className="space-y-2">
            {actionable.map(suggestion => {
              const applied = appliedDays.has(suggestion.day_of_week);
              return (
                <div
                  key={suggestion.day_of_week}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    applied
                      ? 'bg-green-50 dark:bg-green-900/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {/* Day name */}
                  <span className="w-24 text-sm font-medium text-gray-900 dark:text-white shrink-0">
                    {suggestion.day_name}
                  </span>

                  {/* Suggested status badge */}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      suggestion.suggested === 'available'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {suggestion.suggested === 'available' ? 'Available' : 'Unavailable'}
                  </span>

                  {/* Confidence bar + percentage */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${confidenceColor(suggestion.confidence)}`}
                        style={{ width: `${suggestion.confidence}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ${confidenceTextColor(suggestion.confidence)}`}
                    >
                      {suggestion.confidence}%
                    </span>
                  </div>

                  {/* Pattern text */}
                  <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 shrink-0 w-36 text-right">
                    {suggestion.pattern}
                  </span>

                  {/* Apply button */}
                  {applied ? (
                    <span className="shrink-0 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium w-14 justify-end">
                      <Check className="w-3 h-3" />
                      Applied
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApplyOne(suggestion)}
                      className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium w-14 text-right transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  // Suggestions state
  const [suggestions, setSuggestions] = useState<AvailabilitySuggestion[]>([]);
  const [weeksAnalyzed, setWeeksAnalyzed] = useState(8);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

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
      if (!suggestionsLoaded) {
        fetchSuggestions();
      }
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

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/scheduling/availability/suggestions');
      const data: SuggestionsResponse = await res.json();
      if (data.success && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setWeeksAnalyzed(data.weeks_analyzed);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setSuggestionsLoaded(true);
    }
  };

  // ── Suggestion application helpers ────────────────────────────────────────

  /**
   * Given a suggestion, find the next occurrence of that day of week starting
   * from tomorrow and create an availability entry for it.
   */
  const applyOneSuggestion = async (suggestion: AvailabilitySuggestion) => {
    if (suggestion.suggested !== 'available') return;

    // Find the next date matching this day of week
    const today = new Date();
    const daysUntilTarget = (suggestion.day_of_week - today.getDay() + 7) % 7 || 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    const dateStr = targetDate.toISOString().split('T')[0];

    try {
      await fetch('/api/scheduling/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          is_all_day: true,
          notes: `Auto-suggested (${suggestion.pattern})`,
        }),
      });
      fetchAvailability();
    } catch (error) {
      console.error('Error applying suggestion:', error);
    }
  };

  /**
   * Apply all "available" suggestions for the upcoming week.
   */
  const applyAllSuggestions = async (allSuggestions: AvailabilitySuggestion[]) => {
    const availableSuggestions = allSuggestions.filter(s => s.suggested === 'available');
    if (availableSuggestions.length === 0) return;

    const today = new Date();
    const entries = availableSuggestions.map(suggestion => {
      const daysUntilTarget = (suggestion.day_of_week - today.getDay() + 7) % 7 || 7;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntilTarget);
      return {
        date: targetDate.toISOString().split('T')[0],
        is_all_day: true,
        notes: `Auto-suggested (${suggestion.pattern})`,
      };
    });

    try {
      await fetch('/api/scheduling/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      fetchAvailability();
    } catch (error) {
      console.error('Error applying all suggestions:', error);
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

  const showSuggestions =
    !suggestionsDismissed &&
    suggestionsLoaded &&
    suggestions.filter(s => s.confidence >= 50).length > 0;

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

        {/* Smart Suggestions Panel */}
        {showSuggestions && (
          <SuggestionsPanel
            suggestions={suggestions}
            weeksAnalyzed={weeksAnalyzed}
            onApplyAll={applyAllSuggestions}
            onApplyOne={applyOneSuggestion}
            onDismiss={() => setSuggestionsDismissed(true)}
          />
        )}

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
