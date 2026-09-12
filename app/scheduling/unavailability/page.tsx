'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Repeat,
  Plus,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import {
  type InstructorUnavailabilityBlock,
  type RecurringUnavailabilityTemplate,
  formatTime,
  type CurrentUser,
} from '@/types';
import { toDateStr } from '@/lib/utils';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import Breadcrumbs from '@/components/Breadcrumbs';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Mirrors the server's expandDates weekOf/biweekly logic (see
 * /api/scheduling/recurring-unavailability) so "after N occurrences"
 * resolves to the exact same end_date the server would land on if the
 * template were entered with that end_date directly.
 */
function occurrenceCountToEndDate(
  startDate: string,
  weekdays: number[],
  frequency: 'weekly' | 'biweekly',
  count: number
): string | null {
  if (weekdays.length === 0 || count <= 0) return null;
  const start = new Date(startDate + 'T12:00:00');
  const weekOf = (d: Date) => Math.floor((d.getTime() - start.getTime()) / MS_PER_WEEK);

  let found = 0;
  // Generous cap (5 years) so a bad input can't loop forever.
  for (let i = 0, d = new Date(start.getTime()); i < 366 * 5; i++, d = new Date(d.getTime() + MS_PER_DAY)) {
    const wd = d.getDay();
    if (!weekdays.includes(wd)) continue;
    if (frequency === 'biweekly' && weekOf(d) % 2 !== 0) continue;
    found++;
    if (found === count) return toDateStr(d);
  }
  return null;
}

export default function MyUnavailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

  const [blocks, setBlocks] = useState<InstructorUnavailabilityBlock[]>([]);
  const [templates, setTemplates] = useState<RecurringUnavailabilityTemplate[]>([]);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Block add/edit modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<InstructorUnavailabilityBlock | null>(null);
  const [blockForm, setBlockForm] = useState({
    start_date: '',
    end_date: '',
    is_all_day: true,
    start_time: '08:00',
    end_time: '17:00',
    reason: '',
    notes: '',
  });
  const [savingBlock, setSavingBlock] = useState(false);

  // Recurring rule modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    weekdays: [] as number[],
    frequency: 'weekly' as 'weekly' | 'biweekly',
    start_date: toDateStr(new Date()),
    endMode: 'never' as 'never' | 'on_date' | 'after_count',
    end_date: '',
    occurrence_count: 10,
    is_all_day: true,
    start_time: '08:00',
    end_time: '17:00',
    reason: '',
    notes: '',
  });
  const [savingRule, setSavingRule] = useState(false);

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

  // Role guard: this page mirrors the write gate on
  // /api/scheduling/unavailability (lead_instructor+) — the "self-edit"
  // full-timers named in the ticket (Josh, Ryan, Rae, etc.) are all
  // lead_instructor+ already. Part-timer self-entry is a separate,
  // explicitly-deferred follow-up (not this checkpoint).
  useEffect(() => {
    if (effectiveRole && !hasMinRole(effectiveRole, 'lead_instructor')) {
      router.push('/scheduling');
    }
  }, [effectiveRole, router]);

  useEffect(() => {
    if (currentUser) {
      fetchBlocks();
      fetchTemplates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchBlocks = async () => {
    if (!currentUser) return;
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      const params = new URLSearchParams({
        instructor_id: currentUser.id,
        start_date: toDateStr(startDate),
        end_date: toDateStr(endDate),
      });
      const res = await fetch(`/api/scheduling/unavailability?${params}`);
      const data = await res.json();
      if (data.success) {
        setBlocks(data.blocks || []);
      }
    } catch (error) {
      console.error('Error fetching unavailability:', error);
    }
  };

  const fetchTemplates = async () => {
    if (!currentUser) return;
    try {
      const params = new URLSearchParams({ instructor_id: currentUser.id });
      const res = await fetch(`/api/scheduling/recurring-unavailability?${params}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching recurring rules:', error);
    }
  };

  // Calendar helpers (same padded-month grid as My Availability)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    const endPadding = 6 - lastDay.getDay();
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  // Map each visible date to the blocks whose [start_date, end_date] range
  // covers it (a block may span several days, unlike availability rows).
  const blocksByDate = useMemo(() => {
    const map = new Map<string, InstructorUnavailabilityBlock[]>();
    for (const { date } of calendarDays) {
      const key = toDateStr(date);
      const hits = blocks.filter((b) => b.start_date <= key && key <= b.end_date);
      if (hits.length > 0) map.set(key, hits);
    }
    return map;
  }, [blocks, calendarDays]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const openAddBlock = (dateStr: string) => {
    setEditingBlock(null);
    setBlockForm({
      start_date: dateStr,
      end_date: dateStr,
      is_all_day: true,
      start_time: '08:00',
      end_time: '17:00',
      reason: '',
      notes: '',
    });
    setShowBlockModal(true);
  };

  const openEditBlock = (block: InstructorUnavailabilityBlock) => {
    setEditingBlock(block);
    setBlockForm({
      start_date: block.start_date,
      end_date: block.end_date,
      is_all_day: block.is_all_day,
      start_time: block.start_time || '08:00',
      end_time: block.end_time || '17:00',
      reason: block.reason || '',
      notes: block.notes || '',
    });
    setShowBlockModal(true);
  };

  const handleDayClick = (dateStr: string) => {
    const hits = blocksByDate.get(dateStr);
    if (hits && hits.length > 0) {
      openEditBlock(hits[0]);
    } else {
      openAddBlock(dateStr);
    }
  };

  const handleSaveBlock = async () => {
    if (!currentUser) return;
    if (blockForm.end_date < blockForm.start_date) {
      alert('End date must be on or after the start date');
      return;
    }
    setSavingBlock(true);
    try {
      // Blocks don't have a PATCH route yet — self-edit via
      // create-then-delete (create the replacement FIRST, only delete the
      // original once that succeeds) keeps this checkpoint additive (no
      // new route) without a window where a failed create could lose the
      // instructor's existing block.
      const res = await fetch('/api/scheduling/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: currentUser.id,
          start_date: blockForm.start_date,
          end_date: blockForm.end_date,
          is_all_day: blockForm.is_all_day,
          start_time: blockForm.is_all_day ? null : blockForm.start_time,
          end_time: blockForm.is_all_day ? null : blockForm.end_time,
          reason: blockForm.reason || null,
          notes: blockForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to save');
        return;
      }
      if (editingBlock) {
        await fetch(`/api/scheduling/unavailability/${editingBlock.id}`, { method: 'DELETE' });
      }
      setShowBlockModal(false);
      fetchBlocks();
    } catch (error) {
      console.error('Error saving unavailability block:', error);
      alert('Failed to save');
    }
    setSavingBlock(false);
  };

  const handleDeleteBlock = async () => {
    if (!editingBlock) return;
    if (!confirm('Delete this unavailability block?')) return;
    try {
      const res = await fetch(`/api/scheduling/unavailability/${editingBlock.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setShowBlockModal(false);
        fetchBlocks();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('Failed to delete');
    }
  };

  const openAddRule = () => {
    setRuleForm({
      weekdays: [],
      frequency: 'weekly',
      start_date: toDateStr(new Date()),
      endMode: 'never',
      end_date: '',
      occurrence_count: 10,
      is_all_day: true,
      start_time: '08:00',
      end_time: '17:00',
      reason: '',
      notes: '',
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async () => {
    if (!currentUser) return;
    if (ruleForm.weekdays.length === 0) {
      alert('Pick at least one weekday');
      return;
    }
    let end_date: string | null = null;
    if (ruleForm.endMode === 'on_date') {
      if (!ruleForm.end_date) {
        alert('Pick an end date, or choose a different "Ends" option');
        return;
      }
      end_date = ruleForm.end_date;
    } else if (ruleForm.endMode === 'after_count') {
      end_date = occurrenceCountToEndDate(
        ruleForm.start_date,
        ruleForm.weekdays,
        ruleForm.frequency,
        ruleForm.occurrence_count
      );
      if (!end_date) {
        alert('Could not compute an end date for that occurrence count');
        return;
      }
    }
    setSavingRule(true);
    try {
      const res = await fetch('/api/scheduling/recurring-unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: currentUser.id,
          weekdays: ruleForm.weekdays,
          frequency: ruleForm.frequency,
          start_date: ruleForm.start_date,
          end_date,
          is_all_day: ruleForm.is_all_day,
          start_time: ruleForm.is_all_day ? null : ruleForm.start_time,
          end_time: ruleForm.is_all_day ? null : ruleForm.end_time,
          reason: ruleForm.reason || null,
          notes: ruleForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to save recurring rule');
        return;
      }
      setShowRuleModal(false);
      fetchTemplates();
      fetchBlocks();
    } catch (error) {
      console.error('Error saving recurring rule:', error);
      alert('Failed to save recurring rule');
    }
    setSavingRule(false);
  };

  const handleDeleteRule = async (template: RecurringUnavailabilityTemplate) => {
    if (!confirm('Turn off this recurring unavailability rule?')) return;
    try {
      const res = await fetch(
        `/api/scheduling/recurring-unavailability?id=${template.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        fetchTemplates();
        fetchBlocks();
      } else {
        alert(data.error || 'Failed to turn off rule');
      }
    } catch (error) {
      console.error('Error deleting recurring rule:', error);
      alert('Failed to turn off rule');
    }
  };

  const formatMonthYear = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;
  if (effectiveRole && !hasMinRole(effectiveRole, 'lead_instructor')) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
              <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">PMI</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          <Breadcrumbs className="mt-4 mb-2" />

          <div className="flex items-center gap-3">
            <CalendarOff className="w-7 h-7 text-red-500 dark:text-red-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Unavailability</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Mark days, weeks, or a recurring pattern where you&apos;re NOT available — this
            overrides your default schedule everywhere the staffing picker looks.
          </p>
        </div>
      </header>

      {/* Main Content — wide desktop-first layout: recurring rules panel
          alongside the calendar, stacking to one column on small screens. */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 items-start">
        {/* Calendar (specific date blocks) */}
        <div>
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

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
              {WEEKDAY_NAMES.map((day) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const dateStr = toDateStr(date);
                const dayBlocks = blocksByDate.get(dateStr) || [];
                const hasBlock = dayBlocks.length > 0;

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(dateStr)}
                    className={`
                      min-h-[80px] p-2 border-t border-r dark:border-gray-700 text-left
                      hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                      ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''}
                      ${index % 7 === 0 ? 'border-l' : ''}
                    `}
                  >
                    <div
                      className={`
                        text-sm font-medium mb-1
                        ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}
                        ${isToday(date) ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}
                      `}
                    >
                      {date.getDate()}
                    </div>
                    {hasBlock && (
                      <div className="space-y-1">
                        {dayBlocks.slice(0, 2).map((b, i) => (
                          <div
                            key={i}
                            className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded px-1 py-0.5 truncate"
                          >
                            {b.is_all_day ? (b.reason || 'Unavailable') : `${formatTime(b.start_time!)}-${formatTime(b.end_time!)}`}
                          </div>
                        ))}
                        {dayBlocks.length > 2 && (
                          <div className="text-xs text-gray-500">+{dayBlocks.length - 2} more</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded"></div>
              <span>Unavailable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
              <span>Today</span>
            </div>
            <span className="text-gray-400 dark:text-gray-500">Click a day to add or edit a block</span>
          </div>
        </div>

        {/* Recurring rules panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-red-500 dark:text-red-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recurring Rules</h2>
            </div>
            <button
              onClick={openAddRule}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Rule
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Set a weekly pattern once instead of editing individual days — e.g. every
            Thursday until you turn it off, or every Wed/Fri until a specific date.
          </p>

          {templates.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No recurring rules yet
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {t.weekdays.map((wd) => (
                        <span
                          key={wd}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium"
                        >
                          {WEEKDAY_NAMES[wd]}
                        </span>
                      ))}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {t.frequency}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {t.is_all_day
                        ? 'All day'
                        : `${formatTime(t.start_time!)} - ${formatTime(t.end_time!)}`}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      From {t.start_date} —{' '}
                      {t.end_date ? `until ${t.end_date}` : 'until turned off'}
                    </div>
                    {t.reason && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">
                        {t.reason}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRule(t)}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Turn off this rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit block modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingBlock ? 'Edit Unavailability' : 'Add Unavailability'}
              </h2>
              <button
                onClick={() => setShowBlockModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={blockForm.start_date}
                    onChange={(e) =>
                      setBlockForm({
                        ...blockForm,
                        start_date: e.target.value,
                        end_date: blockForm.end_date < e.target.value ? e.target.value : blockForm.end_date,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={blockForm.end_date}
                    min={blockForm.start_date}
                    onChange={(e) => setBlockForm({ ...blockForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Quick range shortcut — "mark a week" per the ticket's
                  easy-self-edit ask, without a separate control. */}
              <button
                type="button"
                onClick={() =>
                  setBlockForm((f) => ({
                    ...f,
                    end_date: toDateStr(new Date(new Date(f.start_date + 'T12:00:00').getTime() + 6 * MS_PER_DAY)),
                  }))
                }
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Set end date to +1 week
              </button>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="block_is_all_day"
                  checked={blockForm.is_all_day}
                  onChange={(e) => setBlockForm({ ...blockForm, is_all_day: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <label htmlFor="block_is_all_day" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All Day
                </label>
              </div>

              {!blockForm.is_all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={blockForm.start_time}
                      onChange={(e) => setBlockForm({ ...blockForm, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={blockForm.end_time}
                      onChange={(e) => setBlockForm({ ...blockForm, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="e.g. Clinical, OSCE, personal"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={blockForm.notes}
                  onChange={(e) => setBlockForm({ ...blockForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
              <div>
                {editingBlock && (
                  <button
                    onClick={handleDeleteBlock}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBlock}
                  disabled={savingBlock}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {savingBlock ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add recurring rule modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Recurring Rule</h2>
              <button
                onClick={() => setShowRuleModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Repeats on
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_NAMES.map((name, wd) => {
                    const on = ruleForm.weekdays.includes(wd);
                    return (
                      <button
                        type="button"
                        key={wd}
                        onClick={() =>
                          setRuleForm((f) => ({
                            ...f,
                            weekdays: on ? f.weekdays.filter((x) => x !== wd) : [...f.weekdays, wd].sort(),
                          }))
                        }
                        className={`px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                          on
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Frequency
                </label>
                <select
                  value={ruleForm.frequency}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, frequency: e.target.value as 'weekly' | 'biweekly' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every other week</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Starting
                </label>
                <input
                  type="date"
                  value={ruleForm.start_date}
                  onChange={(e) => setRuleForm({ ...ruleForm, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ends
                </label>
                <select
                  value={ruleForm.endMode}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, endMode: e.target.value as typeof ruleForm.endMode })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                >
                  <option value="never">Never (until I turn it off)</option>
                  <option value="on_date">On a specific date</option>
                  <option value="after_count">After a number of occurrences</option>
                </select>
                {ruleForm.endMode === 'on_date' && (
                  <input
                    type="date"
                    value={ruleForm.end_date}
                    min={ruleForm.start_date}
                    onChange={(e) => setRuleForm({ ...ruleForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
                {ruleForm.endMode === 'after_count' && (
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={ruleForm.occurrence_count}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, occurrence_count: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="rule_is_all_day"
                  checked={ruleForm.is_all_day}
                  onChange={(e) => setRuleForm({ ...ruleForm, is_all_day: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <label htmlFor="rule_is_all_day" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All Day
                </label>
              </div>

              {!ruleForm.is_all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={ruleForm.start_time}
                      onChange={(e) => setRuleForm({ ...ruleForm, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={ruleForm.end_time}
                      onChange={(e) => setRuleForm({ ...ruleForm, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={ruleForm.reason}
                  onChange={(e) => setRuleForm({ ...ruleForm, reason: e.target.value })}
                  placeholder="e.g. Masters program, clinical rotation"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={savingRule}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {savingRule ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
