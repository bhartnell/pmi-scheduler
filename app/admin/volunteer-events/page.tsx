'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  CalendarDays,
  Copy,
  Check,
  Users,
  Link2,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  BarChart3,
  Send,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VolunteerEvent {
  id: string;
  name: string;
  event_type: 'nremt_testing' | 'lab_day' | 'other';
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  max_volunteers: number | null;
  linked_lab_day_id: string | null;
  is_active: boolean;
  created_at: string;
  registration_count: number;
}

interface VolunteerInvite {
  id: string;
  name: string;
  invite_type: 'instructor1' | 'general';
  token: string;
  event_ids: string[];
  message: string | null;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
  registration_count: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  linked_lab_day_id?: string;
  linked_id?: string;
  source: string;
  event_type: string;
  cohort_number?: number;
  program?: string;
}

interface CreateEventForm {
  name: string;
  event_type: 'nremt_testing' | 'lab_day' | 'other';
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  max_volunteers: string;
}

interface CreateInviteForm {
  name: string;
  invite_type: 'instructor1' | 'general';
  event_ids: string[];
  message: string;
  deadline: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  nremt_testing: 'NREMT Testing',
  lab_day: 'Lab Day',
  other: 'Other',
};

const EVENT_TYPE_STYLES: Record<string, string> = {
  nremt_testing: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  lab_day: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function VolunteerEventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [invites, setInvites] = useState<VolunteerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedCalendarEvents, setSelectedCalendarEvents] = useState<Set<string>>(new Set());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calTypeFilter, setCalTypeFilter] = useState<string>('lab');
  const [calProgramFilters, setCalProgramFilters] = useState<Set<string>>(new Set(['paramedic', 'emt', 'aemt', 'lvfr']));
  const [calCohortFilters, setCalCohortFilters] = useState<Set<string>>(new Set());
  const [calDateRange, setCalDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  });

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nremtDate, setNremtDate] = useState('');

  const [eventForm, setEventForm] = useState<CreateEventForm>({
    name: '',
    event_type: 'other',
    date: '',
    start_time: '',
    end_time: '',
    location: 'PMI Las Vegas Campus',
    description: '',
    max_volunteers: '',
  });

  const [inviteForm, setInviteForm] = useState<CreateInviteForm>({
    name: '',
    invite_type: 'general',
    event_ids: [],
    message: '',
    deadline: '',
  });

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, invitesRes] = await Promise.all([
        fetch('/api/volunteer/events'),
        fetch('/api/volunteer/invites'),
      ]);

      const eventsData = await eventsRes.json();
      const invitesData = await invitesRes.json();

      if (eventsData.success) setEvents(eventsData.data);
      if (invitesData.success) setInvites(invitesData.data);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, router, fetchData]);

  // ─── Calendar Import ────────────────────────────────────────────────────────

  const fetchCalendarEvents = async () => {
    setCalendarLoading(true);
    try {
      const now = new Date();
      const future = new Date();
      future.setMonth(future.getMonth() + 3);

      const startDate = now.toISOString().split('T')[0];
      const endDate = future.toISOString().split('T')[0];

      const res = await fetch(
        `/api/calendar/unified?start_date=${startDate}&end_date=${endDate}&include=classes,labs`
      );
      const data = await res.json();

      if (data.events) {
        // Show all events (labs and classes) — already filtered by include param
        setCalendarEvents(data.events);
      } else {
        setCalendarEvents([]);
      }
    } catch {
      setError('Failed to load calendar events');
    } finally {
      setCalendarLoading(false);
    }
  };

  const toggleProgram = (program: string) => {
    setCalProgramFilters(prev => {
      const next = new Set(prev);
      if (next.has(program)) next.delete(program);
      else next.add(program);
      return next;
    });
  };

  const toggleCohort = (key: string) => {
    setCalCohortFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const availableCohorts = useMemo(() => {
    const cohorts = new Map<string, { label: string; program: string }>();
    calendarEvents.forEach(e => {
      if (e.program && calProgramFilters.has(e.program) && e.cohort_number) {
        const key = `${e.program}-${e.cohort_number}`;
        const abbr = e.program === 'paramedic' ? 'PM' : e.program.toUpperCase();
        cohorts.set(key, { label: `${abbr} Grp ${e.cohort_number}`, program: e.program });
      }
    });
    return Array.from(cohorts.entries());
  }, [calendarEvents, calProgramFilters]);

  const filteredCalendarEvents = calendarEvents.filter((e) => {
    if (calTypeFilter !== 'all' && e.event_type !== calTypeFilter) return false;
    if (e.program && !calProgramFilters.has(e.program)) return false;
    if (calCohortFilters.size > 0 && e.cohort_number) {
      const key = `${e.program}-${e.cohort_number}`;
      if (!calCohortFilters.has(key)) return false;
    }
    const eventDate = new Date(e.date + 'T00:00:00');
    if (eventDate < calDateRange.start || eventDate > calDateRange.end) return false;
    return true;
  });

  const shiftCalMonth = (delta: number) => {
    setCalDateRange((prev) => {
      const newStart = new Date(prev.start.getFullYear(), prev.start.getMonth() + delta, 1);
      const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      return { start: newStart, end: newEnd };
    });
  };

  const handleCalendarImport = async () => {
    if (selectedCalendarEvents.size === 0) return;
    setSubmitting(true);

    try {
      const selected = calendarEvents.filter((e) => selectedCalendarEvents.has(e.id));

      for (const cal of selected) {
        const volEventType = cal.event_type === 'lab' ? 'lab_day' : 'other';
        const linkedLabId = cal.source === 'lab_day' ? cal.linked_id : (cal.linked_lab_day_id || null);
        await fetch('/api/volunteer/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cal.title,
            event_type: volEventType,
            date: cal.date,
            start_time: cal.start_time,
            end_time: cal.end_time,
            linked_lab_day_id: linkedLabId,
          }),
        });
      }

      // Also create NREMT Testing Day if date was entered
      if (nremtDate) {
        await fetch('/api/volunteer/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `NREMT Testing Day`,
            event_type: 'nremt_testing',
            date: nremtDate,
            location: 'PMI Las Vegas Campus',
          }),
        });
      }

      setShowCalendarPicker(false);
      setSelectedCalendarEvents(new Set());
      setNremtDate('');
      await fetchData();
    } catch {
      setError('Failed to import calendar events');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNremtOnly = async () => {
    if (!nremtDate) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/volunteer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `NREMT Testing Day`,
          event_type: 'nremt_testing',
          date: nremtDate,
          location: 'PMI Las Vegas Campus',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setShowCalendarPicker(false);
      setSelectedCalendarEvents(new Set());
      setNremtDate('');
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create NREMT event');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Create Event ───────────────────────────────────────────────────────────

  const handleCreateEvent = async () => {
    if (!eventForm.name || !eventForm.date) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/volunteer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventForm,
          max_volunteers: eventForm.max_volunteers ? parseInt(eventForm.max_volunteers) : null,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setShowCreateEvent(false);
      setEventForm({
        name: '',
        event_type: 'other',
        date: '',
        start_time: '',
        end_time: '',
        location: 'PMI Las Vegas Campus',
        description: '',
        max_volunteers: '',
      });
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Create Invite ──────────────────────────────────────────────────────────

  const handleCreateInvite = async () => {
    if (!inviteForm.name || inviteForm.event_ids.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/volunteer/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inviteForm,
          deadline: inviteForm.deadline || null,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setShowCreateInvite(false);
      setInviteForm({
        name: '',
        invite_type: 'general',
        event_ids: [],
        message: '',
        deadline: '',
      });
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete Event ───────────────────────────────────────────────────────────

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this volunteer event? All registrations will be removed.')) return;

    try {
      await fetch(`/api/volunteer/events/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch {
      setError('Failed to delete event');
    }
  };

  // ─── Copy Link ──────────────────────────────────────────────────────────────

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/volunteer/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const activeEvents = events.filter((e) => e.is_active);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs className="mb-2" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Volunteer Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage volunteer events, invite campaigns, and registrations for NREMT testing and lab days
            </p>
          </div>
          <Link
            href="/admin/volunteer-events/results"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <BarChart3 className="h-4 w-4" />
            View Results
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-bold">
              x
            </button>
          </div>
        )}

        {/* ─── Events Section ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              Volunteer Events ({activeEvents.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCalendarPicker(true);
                  fetchCalendarEvents();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-sm font-medium"
              >
                <CalendarDays className="h-4 w-4" />
                Create from Calendar
              </button>
              <button
                onClick={() => setShowCreateEvent(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Manual
              </button>
            </div>
          </div>

          {activeEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No volunteer events yet. Create one from the calendar or manually.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activeEvents.map((event) => (
                <div key={event.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {event.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.other}`}>
                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-3">
                      <span>{new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {event.start_time && event.end_time && (
                        <span>{event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}</span>
                      )}
                      {event.location && <span>{event.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                      <Users className="h-4 w-4" />
                      {event.registration_count}
                      {event.max_volunteers ? `/${event.max_volunteers}` : ''}
                    </span>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                      title="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Invite Campaigns Section ────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-500" />
              Invite Campaigns ({invites.length})
            </h2>
            <button
              onClick={() => setShowCreateInvite(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          </div>

          {invites.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No invite campaigns yet. Create one to generate a shareable signup link.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {invites.map((invite) => (
                <div key={invite.id} className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {invite.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          invite.invite_type === 'instructor1'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {invite.invite_type === 'instructor1' ? 'Instructor 1' : 'General'}
                        </span>
                        {!invite.is_active && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-3">
                        <span>{invite.event_ids.length} event(s)</span>
                        <span>{invite.registration_count} registration(s)</span>
                        {invite.deadline && (
                          <span>Deadline: {new Date(invite.deadline).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        <span className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 font-mono truncate max-w-[200px]">
                          /volunteer/{invite.token}
                        </span>
                        <button
                          onClick={() => copyLink(invite.token)}
                          className="px-2 py-1.5 border-l border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                          title="Copy link"
                        >
                          {copiedToken === invite.token ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                      <a
                        href={`/volunteer/${invite.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                        title="Open signup page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  {invite.message && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                      {invite.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Create Event Modal ──────────────────────────────────────────── */}
        {showCreateEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Volunteer Event
                </h3>
                <button onClick={() => setShowCreateEvent(false)}>
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={eventForm.name}
                    onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="NREMT Testing Day - Spring 2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Type
                  </label>
                  <select
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value as CreateEventForm['event_type'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="nremt_testing">NREMT Testing</option>
                    <option value="lab_day">Lab Day</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={eventForm.date}
                      onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Volunteers
                    </label>
                    <input
                      type="number"
                      value={eventForm.max_volunteers}
                      onChange={(e) => setEventForm({ ...eventForm, max_volunteers: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="No limit"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Details about this volunteer event..."
                  />
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateEvent(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  disabled={!eventForm.name || !eventForm.date || submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Event
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Calendar Picker Modal ───────────────────────────────────────── */}
        {showCalendarPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Import from Calendar
                </h3>
                <button onClick={() => setShowCalendarPicker(false)}>
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4">
                {calendarLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-500">Loading calendar events...</span>
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <p className="mb-2">No events found in this date range.</p>
                    <p className="text-sm">Use <strong>Create Manual</strong> instead, or add an NREMT Testing Day below.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* ── Filter controls ── */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Type:</span>
                      {['all', 'lab', 'class', 'exam'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setCalTypeFilter(t)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            calTypeFilter === t
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {t === 'all' ? 'All' : t === 'lab' ? 'Labs Only' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Program:</span>
                      {['paramedic', 'emt', 'aemt', 'lvfr'].map((p) => (
                        <button
                          key={p}
                          onClick={() => toggleProgram(p)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            calProgramFilters.has(p)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {p.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {availableCohorts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cohort:</span>
                        {availableCohorts.map(([key, { label }]) => (
                          <button
                            key={key}
                            onClick={() => toggleCohort(key)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                              calCohortFilters.size === 0 || calCohortFilters.has(key)
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                        {calCohortFilters.size > 0 && (
                          <button
                            onClick={() => setCalCohortFilters(new Set())}
                            className="px-2 py-1 text-xs text-gray-500 hover:underline"
                          >
                            Show All
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => shiftCalMonth(-1)}
                        className="px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm"
                      >
                        &#9664;
                      </button>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {calDateRange.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => shiftCalMonth(1)}
                        className="px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm"
                      >
                        &#9654;
                      </button>
                    </div>

                    {/* ── Select All / Clear All ── */}
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setSelectedCalendarEvents(new Set(filteredCalendarEvents.map((e) => e.id)))}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Select All Visible ({filteredCalendarEvents.length})
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        onClick={() => setSelectedCalendarEvents(new Set())}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {filteredCalendarEvents.length} event{filteredCalendarEvents.length !== 1 ? 's' : ''} matching filters:
                    </p>
                    {filteredCalendarEvents.map((cal) => {
                      const typeLabel = cal.event_type === 'lab' ? 'lab' : cal.event_type === 'exam' ? 'exam' : 'class';
                      const typeBadgeStyle = cal.event_type === 'lab'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : cal.event_type === 'exam'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                      const cohortLabel = cal.cohort_number ? ` (C${cal.cohort_number})` : '';
                      return (
                        <label
                          key={cal.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCalendarEvents.has(cal.id)}
                            onChange={(e) => {
                              const next = new Set(selectedCalendarEvents);
                              if (e.target.checked) next.add(cal.id);
                              else next.delete(cal.id);
                              setSelectedCalendarEvents(next);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {cal.title}{cohortLabel}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeBadgeStyle}`}>
                                {typeLabel}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(cal.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {cal.start_time && ` ${cal.start_time.slice(0, 5)}`}
                              {cal.end_time && ` - ${cal.end_time.slice(0, 5)}`}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* NREMT Testing Day quick-add */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    + Add NREMT Testing Day
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={nremtDate}
                      onChange={(e) => setNremtDate(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    {calendarEvents.length === 0 && nremtDate && (
                      <button
                        onClick={handleAddNremtOnly}
                        disabled={submitting}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm disabled:opacity-50 flex items-center gap-1"
                      >
                        {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                        Add
                      </button>
                    )}
                  </div>
                  {nremtDate && calendarEvents.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Will be included when you click Import below.</p>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => { setShowCalendarPicker(false); setNremtDate(''); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCalendarImport}
                  disabled={(selectedCalendarEvents.size === 0 && !nremtDate) || submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import Selected ({selectedCalendarEvents.size + (nremtDate ? 1 : 0)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Create Invite Modal ─────────────────────────────────────────── */}
        {showCreateInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  New Invite Campaign
                </h3>
                <button onClick={() => setShowCreateInvite(false)}>
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Spring 2026 Instructor Invite"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Invite Type
                  </label>
                  <select
                    value={inviteForm.invite_type}
                    onChange={(e) => setInviteForm({ ...inviteForm, invite_type: e.target.value as 'instructor1' | 'general' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="general">General Volunteer</option>
                    <option value="instructor1">Instructor 1 (Volunteer Instructor)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Events *
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                    {activeEvents.length === 0 ? (
                      <p className="text-sm text-gray-500 p-2">No active events. Create events first.</p>
                    ) : (
                      activeEvents.map((event) => (
                        <label key={event.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inviteForm.event_ids.includes(event.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...inviteForm.event_ids, event.id]
                                : inviteForm.event_ids.filter((id) => id !== event.id);
                              setInviteForm({ ...inviteForm, event_ids: ids });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{event.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Custom Message
                  </label>
                  <textarea
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Optional message shown on the signup page..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={inviteForm.deadline}
                    onChange={(e) => setInviteForm({ ...inviteForm, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateInvite(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateInvite}
                  disabled={!inviteForm.name || inviteForm.event_ids.length === 0 || submitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Link2 className="h-4 w-4" />
                  Generate Invite Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
