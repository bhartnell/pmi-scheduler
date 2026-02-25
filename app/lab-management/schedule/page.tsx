'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Plus,
  Filter,
  Users,
  Timer,
  StickyNote,
  X,
  Save,
  Trash2,
  Lock,
  Printer,
  Keyboard,
  LayoutGrid,
  CalendarDays
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';

interface Cohort {
  id: string;
  cohort_number: number;
  program: {
    name: string;
    abbreviation: string;
  };
}

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  semester: number | null;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      abbreviation: string;
    };
  };
  stations: any[];
}

interface DailyNote {
  id: string;
  instructor_id: string;
  instructor_email: string | null;
  instructor_name: string | null;
  note_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Helper: derive display initials from a name or email
function getInitials(nameOrEmail: string | null): string {
  if (!nameOrEmail) return '?';
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.substring(0, 2).toUpperCase();
}

// Helper: derive a stable hue from an email string for the author badge color
function emailToHue(email: string | null): number {
  if (!email) return 200;
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function SchedulePageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(searchParams.get('today') === 'true');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Week view state
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  // weekStart is always a Sunday
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay()); // go back to Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Daily notes state
  // showAllNotes=false → only current user's notes (one per date)
  // showAllNotes=true  → all instructors' notes (multiple per date possible)
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [myNotes, setMyNotes] = useState<Record<string, DailyNote>>({});
  const [allNotes, setAllNotes] = useState<Record<string, DailyNote[]>>({});
  const [noteModalDate, setNoteModalDate] = useState<Date | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchLabDays();
      fetchDailyNotes();
    }
  }, [session, currentMonth, selectedCohort, showAllNotes, viewMode, weekStart]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (noteModalDate && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [noteModalDate]);

  // ESC key to close note modal
  useEffect(() => {
    if (!noteModalDate) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNoteModalDate(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [noteModalDate]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchLabDays = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (viewMode === 'week') {
        // Week view: Sunday through Saturday of weekStart
        startDate = new Date(weekStart);
        endDate = new Date(weekStart);
        endDate.setDate(endDate.getDate() + 6);
      } else {
        // Month view: full calendar grid (Sun of first week through Sat of last week)
        startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Go back to Sunday

        endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // Go forward to Saturday
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      if (selectedCohort) {
        params.append('cohortId', selectedCohort);
      }

      const res = await fetch(`/api/lab-management/lab-days?${params}`);
      const data = await res.json();

      if (data.success) {
        setLabDays(data.labDays);
      }
    } catch (error) {
      console.error('Error fetching lab days:', error);
    }
    setLoading(false);
  };

  const fetchDailyNotes = async () => {
    try {
      let startDate: Date;
      let endDate: Date;

      if (viewMode === 'week') {
        startDate = new Date(weekStart);
        endDate = new Date(weekStart);
        endDate.setDate(endDate.getDate() + 6);
      } else {
        startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      if (showAllNotes) {
        params.set('all', 'true');
      }

      const res = await fetch(`/api/lab-management/daily-notes?${params}`);
      const data = await res.json();

      if (data.success) {
        if (showAllNotes) {
          // Group by date — multiple notes per date possible
          const grouped: Record<string, DailyNote[]> = {};
          data.notes.forEach((note: DailyNote) => {
            if (!grouped[note.note_date]) grouped[note.note_date] = [];
            grouped[note.note_date].push(note);
          });
          setAllNotes(grouped);
        } else {
          const notesMap: Record<string, DailyNote> = {};
          data.notes.forEach((note: DailyNote) => {
            notesMap[note.note_date] = note;
          });
          setMyNotes(notesMap);
        }
      }
    } catch (error) {
      console.error('Error fetching daily notes:', error);
    }
  };

  // Returns my own note for a date (used for the note modal)
  const getMyNoteForDate = (date: Date): DailyNote | null => {
    const dateStr = date.toISOString().split('T')[0];
    if (showAllNotes) {
      const notes = allNotes[dateStr] || [];
      return notes.find(n => n.instructor_email === session?.user?.email) || null;
    }
    return myNotes[dateStr] || null;
  };

  // Returns notes to display on the calendar cell
  const getNotesForDate = (date: Date): DailyNote[] => {
    const dateStr = date.toISOString().split('T')[0];
    if (showAllNotes) {
      return allNotes[dateStr] || [];
    }
    const mine = myNotes[dateStr];
    return mine ? [mine] : [];
  };

  const openNoteModal = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const myNote = getMyNoteForDate(date);
    setNoteContent(myNote?.content || '');
    setNoteModalDate(date);
  };

  const saveNote = async () => {
    if (!noteModalDate) return;
    setSavingNote(true);

    const dateStr = noteModalDate.toISOString().split('T')[0];

    try {
      const res = await fetch('/api/lab-management/daily-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          content: noteContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.deleted) {
          // Remove my note from local state
          if (showAllNotes) {
            setAllNotes(prev => {
              const updated = { ...prev };
              if (updated[dateStr]) {
                updated[dateStr] = updated[dateStr].filter(
                  n => n.instructor_email !== session?.user?.email
                );
                if (updated[dateStr].length === 0) delete updated[dateStr];
              }
              return updated;
            });
          } else {
            setMyNotes(prev => {
              const updated = { ...prev };
              delete updated[dateStr];
              return updated;
            });
          }
          toast.success('Note deleted');
        } else {
          // Update local state
          if (showAllNotes) {
            setAllNotes(prev => {
              const updated = { ...prev };
              const existing = [...(updated[dateStr] || [])];
              const idx = existing.findIndex(
                n => n.instructor_email === session?.user?.email
              );
              if (idx >= 0) {
                existing[idx] = data.note;
              } else {
                existing.push(data.note);
              }
              updated[dateStr] = existing;
              return updated;
            });
          } else {
            setMyNotes(prev => ({
              ...prev,
              [dateStr]: data.note,
            }));
          }
          toast.success('Note saved');
        }
        setNoteModalDate(null);
      } else {
        toast.error('Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    }
    setSavingNote(false);
  };

  const deleteNote = async () => {
    if (!noteModalDate) return;
    setNoteContent('');
    // Save with empty content triggers deletion
    setSavingNote(true);
    const dateStr = noteModalDate.toISOString().split('T')[0];

    try {
      const res = await fetch('/api/lab-management/daily-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          content: '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (showAllNotes) {
          setAllNotes(prev => {
            const updated = { ...prev };
            if (updated[dateStr]) {
              updated[dateStr] = updated[dateStr].filter(
                n => n.instructor_email !== session?.user?.email
              );
              if (updated[dateStr].length === 0) delete updated[dateStr];
            }
            return updated;
          });
        } else {
          setMyNotes(prev => {
            const updated = { ...prev };
            delete updated[dateStr];
            return updated;
          });
        }
        setNoteModalDate(null);
        toast.success('Note deleted');
      } else {
        toast.error('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
    setSavingNote(false);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    const today = new Date();
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  const goToPreviousWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  // Format week range for header, e.g. "Feb 24 - Mar 2, 2026"
  const formatWeekRange = (start: Date): string => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
    }
    if (sameYear) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} \u2013 ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Generate the 7 days of the current week (Sun-Sat)
  const generateWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '?',
      shift: true,
      handler: () => setShowShortcutsHelp(prev => !prev),
      description: 'Show keyboard shortcuts',
      category: 'Global',
    },
    {
      key: 'arrowleft',
      handler: () => viewMode === 'week' ? goToPreviousWeek() : goToPreviousMonth(),
      description: 'Go to previous month/week',
      category: 'Navigation',
    },
    {
      key: 'arrowright',
      handler: () => viewMode === 'week' ? goToNextWeek() : goToNextMonth(),
      description: 'Go to next month/week',
      category: 'Navigation',
    },
    {
      key: 't',
      handler: () => goToToday(),
      description: 'Jump to today',
      category: 'Navigation',
    },
    {
      key: 'm',
      handler: () => setViewMode('month'),
      description: 'Switch to month view',
      category: 'Navigation',
    },
    {
      key: 'w',
      handler: () => setViewMode('week'),
      description: 'Switch to week view',
      category: 'Navigation',
    },
    {
      key: 'n',
      handler: () => router.push('/lab-management/schedule/new'),
      description: 'New lab day',
      category: 'Actions',
    },
    {
      key: 'escape',
      handler: () => setShowShortcutsHelp(false),
      description: 'Close shortcuts help',
      category: 'Global',
    },
  ];

  useKeyboardShortcuts(shortcuts, !noteModalDate);

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Start from Sunday of the first week
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on Saturday of the last week
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const current = new Date(startDate);
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getLabDaysForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return labDays.filter(ld => ld.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  // Get week/day info for the note modal header
  const getDateContext = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayLabs = labDays.filter(ld => ld.date === dateStr);
    if (dayLabs.length === 0) return null;

    return dayLabs.map(ld => {
      const parts = [];
      if (ld.cohort) {
        parts.push(`${ld.cohort.program.abbreviation} G${ld.cohort.cohort_number}`);
      }
      if (ld.week_number && ld.day_number) {
        parts.push(`W${ld.week_number}D${ld.day_number}`);
      }
      if (ld.title) {
        parts.push(ld.title);
      }
      return parts.join(' - ');
    });
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekViewDays = generateWeekDays();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Schedule</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Lab Schedule</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                aria-label="Print this page"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <Link
                href="/lab-management/schedule/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                New Lab Day
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageErrorBoundary>
        {/* Calendar Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 print:hidden">
          <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Navigation: month or week depending on view mode */}
            <div className="flex items-center gap-3">
              {/* View toggle: Month / Week */}
              <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
                <button
                  onClick={() => setViewMode('month')}
                  title="Month view (M)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    viewMode === 'month'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Month
                </button>
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
                <button
                  onClick={() => setViewMode('week')}
                  title="Week view (W)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    viewMode === 'week'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Week
                </button>
              </div>

              {/* Prev / label / Next */}
              <button
                onClick={viewMode === 'week' ? goToPreviousWeek : goToPreviousMonth}
                aria-label={viewMode === 'week' ? 'Go to previous week' : 'Go to previous month'}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[220px] text-center">
                {viewMode === 'week'
                  ? formatWeekRange(weekStart)
                  : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
                aria-label={viewMode === 'week' ? 'Go to next week' : 'Go to next month'}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Today
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Notes toggle: My Notes | All Notes */}
              <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
                <button
                  onClick={() => setShowAllNotes(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    !showAllNotes
                      ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Show only your notes"
                >
                  <Lock className="w-3.5 h-3.5" />
                  My Notes
                </button>
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
                <button
                  onClick={() => setShowAllNotes(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    showAllNotes
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Show notes from all instructors"
                >
                  <Users className="w-3.5 h-3.5" />
                  All Notes
                </button>
              </div>

              {/* Today's Labs toggle */}
              <button
                onClick={() => setShowTodayOnly(!showTodayOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  showTodayOnly
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Timer className="w-4 h-4" />
                <span className="text-sm font-medium">Today&apos;s Labs</span>
              </button>

              {/* Cohort Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <select
                  aria-label="Filter by cohort"
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">All Cohorts</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program.abbreviation} Group {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Labs View - Focused timer-ready view */}
        {showTodayOnly && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="p-4 border-b dark:border-gray-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Today&apos;s Labs - Ready for Timer</h3>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="divide-y dark:divide-gray-600">
              {loading ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
              ) : labDays.filter(ld => ld.date === new Date().toISOString().split('T')[0]).length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium mb-1">No labs scheduled for today</p>
                  <p className="text-sm">Toggle off &quot;Today&apos;s Labs&quot; to see the full schedule</p>
                </div>
              ) : (
                labDays
                  .filter(ld => ld.date === new Date().toISOString().split('T')[0])
                  .map(labDay => (
                    <div key={labDay.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg text-gray-900 dark:text-white">
                            {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {labDay.title || (labDay.week_number && labDay.day_number
                              ? `Week ${labDay.week_number}, Day ${labDay.day_number}`
                              : 'Lab Day'
                            )}
                            {' • '}
                            {labDay.num_rotations} rotations × {labDay.stations[0]?.rotation_minutes || labDay.num_rotations} min
                          </p>
                        </div>
                        <Link
                          href={`/lab-management/schedule/${labDay.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          <Timer className="w-4 h-4" />
                          Start Timer
                        </Link>
                      </div>
                      {labDay.stations.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                          {labDay.stations.map((station: any) => (
                            <Link
                              key={station.id}
                              href={`/lab-management/grade/station/${station.id}`}
                              className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-medium">
                                {station.station_number}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {station.custom_title || station.scenario?.title || `Station ${station.station_number}`}
                                </p>
                                {station.instructor_name && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {station.instructor_name}
                                  </p>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Week View Grid */}
        {viewMode === 'week' && !showTodayOnly && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              {weekViewDays.map((date, i) => {
                const today = isToday(date);
                return (
                  <div
                    key={i}
                    className={`py-3 px-2 text-center border-r last:border-r-0 dark:border-gray-600 ${
                      today ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <div className={`text-xs font-medium uppercase tracking-wide ${
                      today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {weekDays[date.getDay()]}
                    </div>
                    <div className={`text-2xl font-bold mt-0.5 ${
                      today
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className={`text-xs ${
                      today ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {date.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day content columns */}
            <div className="grid grid-cols-7 divide-x dark:divide-gray-600">
              {weekViewDays.map((date, i) => {
                const dayLabDays = getLabDaysForDate(date);
                const today = isToday(date);
                const notesForDate = getNotesForDate(date);
                const myNote = getMyNoteForDate(date);
                const hasNote = notesForDate.length > 0;
                const isEmpty = dayLabDays.length === 0;

                return (
                  <div
                    key={i}
                    onClick={(e) => {
                      if (isEmpty) openNoteModal(date, e);
                    }}
                    className={`min-h-[300px] p-2 relative group flex flex-col gap-1.5 ${
                      today ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''
                    } ${
                      isEmpty
                        ? 'cursor-pointer hover:bg-yellow-50/60 dark:hover:bg-yellow-900/10 transition-colors'
                        : ''
                    }`}
                    title={isEmpty ? 'Click to add a note for this day' : undefined}
                  >
                    {/* Note + add lab action row */}
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/lab-management/schedule/new?date=${date.toISOString().split('T')[0]}`}
                        className="p-0.5 rounded text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        title="Create lab day"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={(e) => openNoteModal(date, e)}
                        className={`p-0.5 rounded transition-colors ${
                          myNote
                            ? 'text-yellow-500 dark:text-yellow-400'
                            : showAllNotes && hasNote
                              ? 'text-blue-400 dark:text-blue-500'
                              : 'text-gray-400 dark:text-gray-500 hover:text-yellow-400 dark:hover:text-yellow-500'
                        }`}
                        title={myNote ? 'Edit your note' : 'Add a note for this day'}
                      >
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Always-visible note indicator when a note exists */}
                    {hasNote && (
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <StickyNote className={`w-3 h-3 flex-shrink-0 ${
                          myNote ? 'text-yellow-500' : 'text-blue-400'
                        }`} />
                      </div>
                    )}

                    {/* Note previews */}
                    {notesForDate.map((note) => {
                      const isMyNote = note.instructor_email === session?.user?.email;
                      const initials = showAllNotes ? getInitials(note.instructor_name || note.instructor_email) : null;
                      const hue = showAllNotes ? emailToHue(note.instructor_email) : null;
                      return (
                        <button
                          key={note.id}
                          onClick={(e) => isMyNote ? openNoteModal(date, e) : e.stopPropagation()}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded border transition-colors ${
                            isMyNote
                              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 cursor-pointer'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 cursor-default'
                          }`}
                          title={showAllNotes ? `${note.instructor_name || note.instructor_email}: ${note.content}` : note.content}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            {showAllNotes && initials && hue !== null && (
                              <span
                                className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none"
                                style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
                              >
                                {initials}
                              </span>
                            )}
                            <span className="truncate leading-snug">
                              {note.content.length > 60 ? note.content.substring(0, 60) + '...' : note.content}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {/* Lab day cards */}
                    {dayLabDays.map(labDay => {
                      const stationCount = labDay.stations.length;
                      // Coverage: a station is "covered" if it has an instructor assigned
                      const coveredCount = labDay.stations.filter((s: any) => s.instructor_name || s.instructor_id).length;
                      const needsCoverage = stationCount > 0 && coveredCount < stationCount;
                      const fullyStaffed = stationCount > 0 && coveredCount === stationCount;

                      return (
                        <Link
                          key={labDay.id}
                          href={`/lab-management/schedule/${labDay.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors p-2 text-left"
                        >
                          {/* Cohort badge */}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 mb-1">
                            {labDay.cohort.program.abbreviation} G{labDay.cohort.cohort_number}
                          </span>

                          {/* Title / week-day info */}
                          {labDay.title && (
                            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 truncate leading-tight">
                              {labDay.title}
                            </p>
                          )}
                          {labDay.week_number && labDay.day_number && (
                            <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-tight">
                              W{labDay.week_number}D{labDay.day_number}
                            </p>
                          )}

                          {/* Station count */}
                          {stationCount > 0 && (
                            <div className="flex items-center justify-between mt-1.5 gap-1">
                              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                                {stationCount} station{stationCount !== 1 ? 's' : ''}
                              </span>
                              {/* Coverage pill */}
                              {fullyStaffed && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                  Covered
                                </span>
                              )}
                              {needsCoverage && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {coveredCount}/{stationCount}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      );
                    })}

                    {/* Empty day hint */}
                    {isEmpty && !hasNote && (
                      <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center mt-auto pt-4 select-none">
                        No labs
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${showTodayOnly || viewMode === 'week' ? 'hidden' : 'hidden md:block'}`}>
          {/* Week day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            {weekDays.map(day => (
              <div key={day} className="py-2 lg:py-3 text-center text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-300">
                <span className="lg:hidden">{day.charAt(0)}</span>
                <span className="hidden lg:inline">{day}</span>
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              const dayLabDays = getLabDaysForDate(date);
              const today = isToday(date);
              const currentMo = isCurrentMonth(date);
              const notesForDate = getNotesForDate(date);
              const myNote = getMyNoteForDate(date);
              const hasNote = notesForDate.length > 0;
              const isEmpty = dayLabDays.length === 0;
              // Empty cells (no lab) are clickable to open the note modal on any date
              // Cells with labs use the note button in the header for notes
              const isEmptyClickable = isEmpty;

              return (
                <div
                  key={idx}
                  onClick={(e) => {
                    if (isEmptyClickable) {
                      openNoteModal(date, e);
                    }
                  }}
                  className={`min-h-[80px] lg:min-h-[120px] border-b border-r dark:border-gray-600 p-1 md:p-2 relative group ${
                    !currentMo ? 'bg-gray-50 dark:bg-gray-700' : ''
                  } ${today ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${
                    isEmptyClickable
                      ? 'cursor-pointer hover:bg-yellow-50/60 dark:hover:bg-yellow-900/10 transition-colors'
                      : ''
                  }`}
                  title={isEmptyClickable ? 'Click to add a note for this day' : undefined}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      today
                        ? 'text-blue-600 dark:text-blue-400'
                        : currentMo
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {date.getDate()}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {/* Add lab button - shows on hover */}
                      <Link
                        href={`/lab-management/schedule/new?date=${date.toISOString().split('T')[0]}`}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                        title="Create lab day"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Link>
                      {/* Note indicator / add note button
                          - Always visible (not hidden) when a note exists
                          - On hover on cells with no existing note
                          - On empty cells (no lab), the whole cell is clickable so this button
                            acts as a visual indicator; the cell click opens the modal */}
                      <button
                        onClick={(e) => openNoteModal(date, e)}
                        className={`p-0.5 rounded transition-all ${
                          myNote
                            ? 'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300'
                            : showAllNotes && hasNote
                              ? 'text-blue-400 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400'
                              : isEmpty
                                ? 'text-gray-300 dark:text-gray-600 group-hover:text-yellow-400 dark:group-hover:text-yellow-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors'
                                : 'text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-gray-500 dark:hover:text-gray-400'
                        }`}
                        title={myNote ? 'Edit your note' : 'Add a note for this day'}
                      >
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Note previews */}
                  {notesForDate.map((note) => {
                    const isMyNote = note.instructor_email === session?.user?.email;
                    const initials = showAllNotes ? getInitials(note.instructor_name || note.instructor_email) : null;
                    const hue = showAllNotes ? emailToHue(note.instructor_email) : null;
                    return (
                      <button
                        key={note.id}
                        onClick={(e) => isMyNote ? openNoteModal(date, e) : e.stopPropagation()}
                        className={`w-full text-left mb-0.5 px-1 py-0.5 text-[10px] leading-tight rounded border transition-colors ${
                          isMyNote
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 cursor-pointer'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 cursor-default'
                        }`}
                        title={showAllNotes ? `${note.instructor_name || note.instructor_email}: ${note.content}` : note.content}
                      >
                        <div className="flex items-center gap-0.5 min-w-0">
                          {showAllNotes && initials && hue !== null && (
                            <span
                              className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white leading-none"
                              style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
                            >
                              {initials}
                            </span>
                          )}
                          <span className="truncate">
                            {note.content.length > 35 ? note.content.substring(0, 35) + '...' : note.content}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Lab day entries */}
                  <div className="space-y-1">
                    {dayLabDays.slice(0, notesForDate.length > 0 ? Math.max(0, 3 - notesForDate.length) : 3).map(labDay => (
                      <Link
                        key={labDay.id}
                        href={`/lab-management/schedule/${labDay.id}`}
                        className="block px-1.5 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/70"
                        title={labDay.title || `${labDay.cohort.program.abbreviation} G${labDay.cohort.cohort_number}`}
                      >
                        <div className="font-medium truncate">
                          {labDay.cohort.program.abbreviation} G{labDay.cohort.cohort_number}
                          {labDay.stations.length > 0 && (
                            <span className="text-blue-600 dark:text-blue-400 ml-1">
                              ({labDay.stations.length})
                            </span>
                          )}
                        </div>
                        {labDay.week_number && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate">
                            W{labDay.week_number}
                          </div>
                        )}
                        {labDay.title && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate">
                            {labDay.title}
                          </div>
                        )}
                      </Link>
                    ))}
                    {(() => {
                      const maxSlots = notesForDate.length > 0 ? Math.max(0, 3 - notesForDate.length) : 3;
                      return dayLabDays.length > maxSlots ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                          +{dayLabDays.length - maxSlots} more
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Labs List (Mobile-friendly alternative, hidden in week view) */}
        <div className={`mt-6 bg-white dark:bg-gray-800 rounded-lg shadow ${showTodayOnly || viewMode === 'week' ? 'hidden' : ''}`}>
          <div className="p-4 border-b dark:border-gray-600">
            <h3 className="font-semibold text-gray-900 dark:text-white">Upcoming Labs</h3>
          </div>
          <div className="divide-y dark:divide-gray-600">
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
            ) : labDays.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p>No lab days scheduled for this period</p>
              </div>
            ) : (
              labDays
                .filter(ld => new Date(ld.date + 'T12:00:00') >= new Date(new Date().toDateString()))
                .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
                .slice(0, 10)
                .map(labDay => {
                  const labDate = new Date(labDay.date + 'T12:00:00');
                  const isLabToday = labDate.toDateString() === new Date().toDateString();

                  return (
                    <Link
                      key={labDay.id}
                      href={`/lab-management/schedule/${labDay.id}`}
                      className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className={`text-center p-2 rounded-lg min-w-[60px] ${
                        isLabToday ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <div className={`text-xs font-medium ${
                          isLabToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {labDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-xl font-bold ${
                          isLabToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                        }`}>
                          {labDate.getDate()}
                        </div>
                        <div className={`text-xs ${
                          isLabToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {labDate.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {labDay.semester && labDay.week_number && labDay.day_number
                            ? `Sem ${labDay.semester} • Week ${labDay.week_number}, Day ${labDay.day_number} • `
                            : labDay.week_number && labDay.day_number
                            ? `Week ${labDay.week_number}, Day ${labDay.day_number} • `
                            : labDay.semester
                            ? `Semester ${labDay.semester} • `
                            : ''}
                          {labDay.stations.length} station{labDay.stations.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {isLabToday && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                          Today
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </Link>
                  );
                })
            )}
          </div>
        </div>
        </PageErrorBoundary>
      </main>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={shortcuts}
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Daily Note Modal */}
      {noteModalDate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setNoteModalDate(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-note-modal-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2">
                  <StickyNote className="w-5 h-5 text-yellow-500" aria-hidden="true" />
                  <h3 id="daily-note-modal-title" className="font-semibold text-gray-900 dark:text-white">
                    Daily Note
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {noteModalDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                {/* Lab day context */}
                {getDateContext(noteModalDate) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {getDateContext(noteModalDate)!.map((ctx, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded"
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setNoteModalDate(null)}
                aria-label="Close daily note"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* "All Notes" read-only section: other instructors' notes for this date */}
            {showAllNotes && (() => {
              const dateStr = noteModalDate.toISOString().split('T')[0];
              const othersNotes = (allNotes[dateStr] || []).filter(
                n => n.instructor_email !== session?.user?.email
              );
              if (othersNotes.length === 0) return null;
              return (
                <div className="px-5 pt-4 space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Other instructors
                  </p>
                  {othersNotes.map(n => {
                    const hue = emailToHue(n.instructor_email);
                    const initials = getInitials(n.instructor_name || n.instructor_email);
                    return (
                      <div
                        key={n.id}
                        className="flex gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <span
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none mt-0.5"
                          style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
                        >
                          {initials}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                            {n.instructor_name || n.instructor_email}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-0.5">
                            {n.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Your note
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Modal Body */}
            <div className="p-5">
              <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Lab observations, notes, reminders..."
                className="w-full h-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  {showAllNotes
                    ? 'Editing your note — other instructors can see all notes in "All Notes" mode'
                    : 'Personal note — only visible to you in "My Notes" mode'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <div>
                {getMyNoteForDate(noteModalDate) && (
                  <button
                    onClick={deleteNote}
                    disabled={savingNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNoteModalDate(null)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                >
                  <Save className="w-4 h-4" />
                  {savingNote ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    }>
      <SchedulePageContent />
    </Suspense>
  );
}
