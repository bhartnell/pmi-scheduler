'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Home,
  Calendar,
  Plus,
  X,
  Edit2,
  Trash2,
  MapPin,
  Building2,
  Info,
} from 'lucide-react';
import { hasMinRole, canAccessClinical } from '@/lib/permissions';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClinicalSite {
  id: string;
  name: string;
  abbreviation: string;
  system: string | null;
  is_active: boolean;
}

interface SiteSchedule {
  id: string;
  clinical_site_id: string;
  institution: string;
  days_of_week: string[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  site: {
    id: string;
    name: string;
    abbreviation: string;
    system: string | null;
  } | null;
}

interface DayAssignment {
  schedule: SiteSchedule;
  siteName: string;
  siteAbbr: string;
  institution: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { key: 'sunday', label: 'Su', full: 'Sunday' },
  { key: 'monday', label: 'M', full: 'Monday' },
  { key: 'tuesday', label: 'T', full: 'Tuesday' },
  { key: 'wednesday', label: 'W', full: 'Wednesday' },
  { key: 'thursday', label: 'Th', full: 'Thursday' },
  { key: 'friday', label: 'F', full: 'Friday' },
  { key: 'saturday', label: 'Sa', full: 'Saturday' },
];

const WEEK_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const INSTITUTION_SUGGESTIONS = ['PMI', 'CSN', 'Other'];

function getInstitutionColor(institution: string): { bg: string; text: string; dot: string } {
  const inst = institution.toUpperCase();
  if (inst === 'PMI') return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300', dot: 'bg-green-500' };
  if (inst === 'CSN') return { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', dot: 'bg-blue-500' };
  return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' };
}

// ─── Modal form state ─────────────────────────────────────────────────────────

interface FormState {
  clinical_site_id: string;
  institution: string;
  days_of_week: string[];
  start_date: string;
  end_date: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  clinical_site_id: '',
  institution: 'PMI',
  days_of_week: [],
  start_date: '',
  end_date: '',
  notes: '',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningCalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [sites, setSites] = useState<ClinicalSite[]>([]);
  const [schedules, setSchedules] = useState<SiteSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filters
  const [filterSiteId, setFilterSiteId] = useState<string>('');
  const [filterInstitution, setFilterInstitution] = useState<string>('');

  // Day detail modal
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Add/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SiteSchedule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>('');

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = userRole ? hasMinRole(userRole, 'lead_instructor') : false;

  // ─── Auth / data loading ────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUser();
    }
  }, [session]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
        if (!canAccessClinical(data.user.role)) {
          router.push('/');
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  useEffect(() => {
    if (userRole) {
      fetchSites();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole) {
      fetchSchedules();
    }
  }, [userRole, currentMonth, filterSiteId, filterInstitution]);

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/clinical/sites?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setSites(data.sites || []);
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch for the visible calendar range (month +/- overflow)
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const startOfView = new Date(firstDay);
      startOfView.setDate(startOfView.getDate() - startOfView.getDay());

      const endOfView = new Date(lastDay);
      endOfView.setDate(endOfView.getDate() + (6 - endOfView.getDay()));

      const startDateStr = startOfView.toISOString().split('T')[0];
      const endDateStr = endOfView.toISOString().split('T')[0];

      let url = `/api/clinical/planning-calendar?start_date=${startDateStr}&end_date=${endDateStr}`;
      if (filterSiteId) url += `&site_id=${filterSiteId}`;
      if (filterInstitution) url += `&institution=${encodeURIComponent(filterInstitution)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load schedules');
      } else {
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError('Failed to load schedules. Please try again.');
    }
    setLoading(false);
  }, [currentMonth, filterSiteId, filterInstitution, userRole]);

  // ─── Calendar helpers ───────────────────────────────────────────────────

  const generateCalendarDays = (): Date[] => {
    const days: Date[] = [];
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());

    const end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const getDayName = (date: Date): string => {
    return DAYS_OF_WEEK[date.getDay()].key;
  };

  const isScheduleActiveOnDate = (schedule: SiteSchedule, date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    if (dateStr < schedule.start_date) return false;
    if (schedule.end_date && dateStr > schedule.end_date) return false;
    const dayName = getDayName(date);
    return schedule.days_of_week.includes(dayName);
  };

  const getAssignmentsForDate = (date: Date): DayAssignment[] => {
    return schedules
      .filter(s => isScheduleActiveOnDate(s, date))
      .map(s => ({
        schedule: s,
        siteName: s.site?.name ?? 'Unknown Site',
        siteAbbr: s.site?.abbreviation ?? '?',
        institution: s.institution,
      }));
  };

  const isToday = (date: Date): boolean => {
    return date.toDateString() === new Date().toDateString();
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  // ─── Modal helpers ──────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingSchedule(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (schedule: SiteSchedule) => {
    setEditingSchedule(schedule);
    setForm({
      clinical_site_id: schedule.clinical_site_id,
      institution: schedule.institution,
      days_of_week: [...schedule.days_of_week],
      start_date: schedule.start_date,
      end_date: schedule.end_date ?? '',
      notes: schedule.notes ?? '',
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const handleSave = async () => {
    setFormError('');

    if (!form.clinical_site_id) { setFormError('Please select a clinical site.'); return; }
    if (!form.institution.trim()) { setFormError('Institution is required.'); return; }
    if (form.days_of_week.length === 0) { setFormError('Select at least one day of the week.'); return; }
    if (!form.start_date) { setFormError('Start date is required.'); return; }

    setSaving(true);
    try {
      const payload = {
        ...(editingSchedule ? { id: editingSchedule.id } : {}),
        clinical_site_id: form.clinical_site_id,
        institution: form.institution.trim(),
        days_of_week: form.days_of_week,
        start_date: form.start_date,
        end_date: form.end_date || null,
        notes: form.notes.trim() || null,
      };

      const method = editingSchedule ? 'PUT' : 'POST';
      const res = await fetch('/api/clinical/planning-calendar', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setFormError(data.error || 'Failed to save schedule.');
        return;
      }

      await fetchSchedules();
      closeModal();
    } catch (err) {
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clinical/planning-calendar?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeletingId(null);
        await fetchSchedules();
        // close day detail if we just deleted something shown there
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading planning calendar...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const calendarDays = generateCalendarDays();
  const selectedDateAssignments = selectedDate ? getAssignmentsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1 flex-wrap">
                <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  Home
                </Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Planning Calendar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Planning Calendar</h1>
                    <div className="group relative inline-flex items-center">
                      <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help ml-2" />
                      <div className="invisible group-hover:visible absolute left-6 top-0 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg">
                        <div className="absolute -left-1 top-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                        Plan clinical rotations by viewing all sites, their capacity, and scheduling students across available dates. Coordinate with other institutions sharing the same sites.
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Track site availability by school across the year</p>
                </div>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Schedule
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={fetchSchedules} className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200">
              Try again
            </button>
          </div>
        )}

        {/* Controls: month nav + filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            {/* Month navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white min-w-[160px] sm:min-w-[200px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-2 min-h-[44px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Today
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterSiteId}
                onChange={e => setFilterSiteId(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.abbreviation} — {s.name}</option>
                ))}
              </select>

              <select
                value={filterInstitution}
                onChange={e => setFilterInstitution(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Institutions</option>
                <option value="PMI">PMI</option>
                <option value="CSN">CSN</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calendar grid — desktop */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden hidden md:block">
          {/* Week headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            {WEEK_HEADERS.map(day => (
              <div key={day} className="py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              const assignments = getAssignmentsForDate(date);
              const today = isToday(date);
              const inMonth = isCurrentMonth(date);
              const isSelected = selectedDate?.toDateString() === date.toDateString();

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : date)}
                  className={`min-h-[100px] border-b border-r dark:border-gray-600 p-1.5 cursor-pointer transition-colors ${
                    !inMonth ? 'bg-gray-50 dark:bg-gray-700/50' : 'hover:bg-teal-50 dark:hover:bg-teal-900/20'
                  } ${today ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${
                    isSelected ? 'ring-2 ring-inset ring-teal-400 dark:ring-teal-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      today
                        ? 'text-blue-600 dark:text-blue-400'
                        : inMonth
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {date.getDate()}
                    </span>
                    {assignments.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{assignments.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {assignments.slice(0, 3).map((a, i) => {
                      const colors = getInstitutionColor(a.institution);
                      return (
                        <div
                          key={i}
                          className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text} truncate`}
                          title={`${a.siteName} — ${a.institution}`}
                        >
                          <span className="font-semibold">{a.siteAbbr}</span>
                          <span className="ml-1 opacity-75">{a.institution}</span>
                        </div>
                      );
                    })}
                    {assignments.length > 3 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 px-1">
                        +{assignments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile list view */}
        <div className="md:hidden bg-white dark:bg-gray-800 rounded-xl shadow">
          <div className="p-4 border-b dark:border-gray-600">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              This Month's Site Assignments
            </h3>
          </div>
          {schedules.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p>No schedules found</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-600">
              {schedules.map(s => {
                const colors = getInstitutionColor(s.institution);
                return (
                  <div key={s.id} className="p-4 flex items-start gap-3">
                    <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {s.site?.abbreviation ?? '?'} — {s.site?.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {s.institution} &bull; {s.days_of_week.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {s.start_date}{s.end_date ? ` – ${s.end_date}` : ' (ongoing)'}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditModal(s)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeletingId(s.id)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Day detail panel (visible when a date is selected) */}
        {selectedDate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
            <div className="p-4 border-b dark:border-gray-600 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedDateAssignments.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">No site assignments on this day</p>
                {canEdit && (
                  <button
                    onClick={openAddModal}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add schedule
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-600">
                {selectedDateAssignments.map((a, i) => {
                  const colors = getInstitutionColor(a.institution);
                  return (
                    <div key={i} className="p-4 flex items-start gap-4">
                      <div className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white">{a.siteName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {a.institution}
                          </span>
                        </div>
                        {a.schedule.site?.system && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">{a.schedule.site.system}</div>
                        )}
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Days: {a.schedule.days_of_week.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {a.schedule.start_date}{a.schedule.end_date ? ` – ${a.schedule.end_date}` : ' (ongoing)'}
                        </div>
                        {a.schedule.notes && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">{a.schedule.notes}</div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(a.schedule)}
                            className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingId(a.schedule.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'PMI', colors: getInstitutionColor('PMI') },
              { label: 'CSN', colors: getInstitutionColor('CSN') },
              { label: 'Other', colors: getInstitutionColor('Other') },
            ].map(({ label, colors }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>{label}</span>
              </div>
            ))}
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              Click any day to see its assignments
            </div>
          </div>
        </div>

        {/* All Schedules Table */}
        {schedules.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="p-4 border-b dark:border-gray-600 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                Active Schedules ({schedules.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Site</th>
                    <th className="px-4 py-3 text-left">Institution</th>
                    <th className="px-4 py-3 text-left">Days</th>
                    <th className="px-4 py-3 text-left">Start</th>
                    <th className="px-4 py-3 text-left">End</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-600">
                  {schedules.map(s => {
                    const colors = getInstitutionColor(s.institution);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          <div>{s.site?.abbreviation ?? '?'}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{s.site?.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {s.institution}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {s.days_of_week.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{s.start_date}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {s.end_date ?? <span className="text-gray-400 dark:text-gray-500 italic">ongoing</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={s.notes ?? ''}>
                          {s.notes}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(s)}
                                className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(s.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b dark:border-gray-600 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
              </h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Site */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Clinical Site <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.clinical_site_id}
                  onChange={e => setForm(prev => ({ ...prev, clinical_site_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a site...</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.abbreviation} — {s.name}</option>
                  ))}
                </select>
              </div>

              {/* Institution */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Institution <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                  {INSTITUTION_SUGGESTIONS.map(inst => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, institution: inst }))}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        form.institution === inst
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-teal-300'
                      }`}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={form.institution}
                  onChange={e => setForm(prev => ({ ...prev, institution: e.target.value }))}
                  placeholder="Or type a custom institution name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Days of week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Days of Week <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      title={day.full}
                      className={`w-10 h-10 rounded-lg text-sm font-medium border transition-colors ${
                        form.days_of_week.includes(day.key)
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-teal-300 dark:hover:border-teal-700'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                    min={form.start_date || undefined}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Optional notes about this schedule..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* Error */}
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              )}
            </div>

            <div className="p-6 border-t dark:border-gray-600 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : editingSchedule ? 'Save Changes' : 'Add Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Schedule?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This will permanently remove this site schedule entry. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
