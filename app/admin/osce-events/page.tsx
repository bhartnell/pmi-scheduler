'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Users,
  LayoutGrid,
  Zap,
  X,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OsceEvent {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  max_observers_per_block: number;
  status: 'draft' | 'open' | 'closed' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  observer_count: number;
  block_count: number;
}

interface CreateForm {
  title: string;
  subtitle: string;
  slug: string;
  location: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  max_observers_per_block: number;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  open: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  archived: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (start === end) {
    return startDate.toLocaleDateString('en-US', opts);
  }
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', opts)}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OsceEventsListPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<OsceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [quickSetup, setQuickSetup] = useState(false);

  const emptyForm: CreateForm = {
    title: '',
    subtitle: '',
    slug: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'draft',
    max_observers_per_block: 4,
  };
  const [form, setForm] = useState<CreateForm>(emptyForm);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/osce/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchEvents();
  }, [authStatus, fetchEvents]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleTitleChange = (title: string) => {
    const newSlug = generateSlug(title);
    setForm(prev => ({
      ...prev,
      title,
      slug: prev.slug === generateSlug(prev.title) ? newSlug : prev.slug,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.start_date || !form.end_date) return;

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/osce/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          slug: form.slug.trim() || generateSlug(form.title),
          location: form.location.trim() || null,
          start_date: form.start_date,
          end_date: form.end_date,
          status: form.status,
          max_observers_per_block: form.max_observers_per_block,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || 'Failed to create event');
        setCreating(false);
        return;
      }

      const newEvent = data.event;

      // Quick setup time blocks if checked
      if (quickSetup && newEvent?.id) {
        await generateDefaultBlocks(newEvent.id, form.start_date, form.end_date, form.max_observers_per_block);
      }

      setForm(emptyForm);
      setShowCreate(false);
      setQuickSetup(false);
      fetchEvents();
    } catch {
      setCreateError('Network error');
    }
    setCreating(false);
  };

  const generateDefaultBlocks = async (eventId: string, startDate: string, endDate: string, maxObs: number) => {
    const blocks: Array<{
      day_number: number;
      label: string;
      date: string;
      start_time: string;
      end_time: string;
      max_observers: number;
      sort_order: number;
    }> = [];

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    let dayNum = 1;
    let sortOrder = 1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      blocks.push(
        { day_number: dayNum, label: 'Morning', date: dateStr, start_time: '09:00', end_time: '12:00', max_observers: maxObs, sort_order: sortOrder++ },
        { day_number: dayNum, label: 'Early Afternoon', date: dateStr, start_time: '13:00', end_time: '15:00', max_observers: maxObs, sort_order: sortOrder++ },
        { day_number: dayNum, label: 'Late Afternoon', date: dateStr, start_time: '15:00', end_time: '17:00', max_observers: maxObs, sort_order: sortOrder++ },
      );
      dayNum++;
    }

    try {
      await fetch(`/api/osce/events/${eventId}/time-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
    } catch {
      /* ignore - blocks can be added later */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/osce/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchEvents();
      }
    } catch {
      /* ignore */
    }
  };

  const handleCopyUrl = (slug: string) => {
    const url = `${window.location.origin}/osce/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // ─── Loading State ────────────────────────────────────────────────────────

  if (authStatus === 'loading' || loading) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading events...
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSCE Events</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create New Event
        </button>
      </div>

      {/* Create Event Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New OSCE Event</h2>
              <button
                onClick={() => { setShowCreate(false); setForm(emptyForm); setCreateError(null); setQuickSetup(false); }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  {createError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="e.g. Spring 2026 OSCE"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subtitle</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={e => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="e.g. Paramedic Program Cohort 47"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Slug (auto-generated, editable)</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">/osce/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="spring-2026-osce"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. PMI Tucson Campus"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Status + max observers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value as CreateForm['status'] }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Observers/Block</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={form.max_observers_per_block}
                    onChange={e => setForm(prev => ({ ...prev, max_observers_per_block: parseInt(e.target.value) || 4 }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quick setup toggle */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <input
                  type="checkbox"
                  id="quickSetup"
                  checked={quickSetup}
                  onChange={e => setQuickSetup(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="quickSetup" className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 cursor-pointer">
                  <Zap className="w-4 h-4" />
                  Quick Setup Time Blocks
                  <span className="text-xs text-blue-500 dark:text-blue-400">(Morning, Early Afternoon, Late Afternoon for each day)</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setForm(emptyForm); setCreateError(null); setQuickSetup(false); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.title.trim() || !form.start_date || !form.end_date}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Cards Grid */}
      {events.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <CalendarDays className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No OSCE events yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Your First Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(event => (
            <div
              key={event.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => router.push(`/admin/osce-events/${event.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                    {event.title}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${STATUS_STYLES[event.status]}`}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </div>
                {event.subtitle && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{event.subtitle}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  <CalendarDays className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
                  {formatDateRange(event.start_date, event.end_date)}
                </p>
                {event.location && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{event.location}</p>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {event.observer_count} observer{event.observer_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    {event.block_count} block{event.block_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                {/* Public URL */}
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">/osce/{event.slug}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleCopyUrl(event.slug); }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
                    title="Copy public URL"
                  >
                    {copiedSlug === event.slug ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Delete button */}
                <div onClick={e => e.stopPropagation()}>
                  {deleteConfirm === event.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(event.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
