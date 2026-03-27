'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Calendar,
  Building2,
  Clock,
  GraduationCap,
  Settings,
  Download,
  Trash2,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  Edit3,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  ArrowUp,
  ArrowDown,
  Zap,
  Send,
  FlaskConical,
  AlertTriangle,
  Save,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

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
  event_pin: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  observer_count: number;
  block_count: number;
}

interface ObserverBlock {
  block_id: string;
  day_number: number;
  label: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface Observer {
  id: string;
  event_id: string;
  name: string;
  title: string;
  agency: string;
  email: string;
  phone: string | null;
  role: string | null;
  agency_preference: boolean;
  agency_preference_note: string | null;
  created_at: string;
  blocks: ObserverBlock[];
}

interface TimeBlock {
  id: string;
  event_id: string;
  day_number: number;
  label: string;
  date: string;
  start_time: string;
  end_time: string;
  max_observers: number;
  sort_order: number;
  observer_count: number;
}

interface ScheduleBlock {
  id: string;
  day_number: number;
  label: string;
  date: string;
  start_time: string;
  end_time: string;
  max_observers: number;
  sort_order: number;
  observers: { id: string; name: string; agency: string; email: string }[];
  students: { id: string; name: string; slot: number }[];
  matches: { studentName: string; observerName: string; agency: string }[];
  observerCount: number;
}

interface StudentAgency {
  id: string;
  student_name: string;
  agency: string;
  relationship: string | null;
}

type TabKey = 'observers' | 'schedule' | 'agencies' | 'blocks' | 'students' | 'settings';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  open: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  archived: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OsceEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<OsceEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('observers');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(p => setEventId(p.id));
  }, [params]);

  // ─── Fetch event ──────────────────────────────────────────────────────────

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/osce/events/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event || null);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (authStatus === 'authenticated' && eventId) fetchEvent();
  }, [authStatus, eventId, fetchEvent]);

  // ─── URL copy ─────────────────────────────────────────────────────────────

  const handleCopyUrl = () => {
    if (!event) return;
    navigator.clipboard.writeText(`${window.location.origin}/osce/${event.slug}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // ─── Loading / not found ──────────────────────────────────────────────────

  if (authStatus === 'loading' || loading || !eventId) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading event...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Event not found.
        <button onClick={() => router.push('/admin/osce-events')} className="ml-2 text-blue-600 dark:text-blue-400 underline">
          Back to events
        </button>
      </div>
    );
  }

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'observers', label: 'Observers', icon: <Users className="w-4 h-4" /> },
    { key: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { key: 'agencies', label: 'Agencies', icon: <Building2 className="w-4 h-4" /> },
    { key: 'blocks', label: 'Time Blocks', icon: <Clock className="w-4 h-4" /> },
    { key: 'students', label: 'Students', icon: <GraduationCap className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs entityTitle={event.title} className="mb-2" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[event.status]}`}>
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </span>
              </div>
              {event.subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{event.subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            /osce/{event.slug}
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'observers' && <ObserversTab eventId={eventId} event={event} onRefresh={fetchEvent} />}
      {activeTab === 'schedule' && <ScheduleTab eventId={eventId} />}
      {activeTab === 'agencies' && <AgenciesTab eventId={eventId} />}
      {activeTab === 'blocks' && <TimeBlocksTab eventId={eventId} event={event} onRefresh={fetchEvent} />}
      {activeTab === 'students' && <StudentsTab eventId={eventId} />}
      {activeTab === 'settings' && <SettingsTab event={event} onRefresh={fetchEvent} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Observers
// ═══════════════════════════════════════════════════════════════════════════════

function ObserversTab({ eventId, event, onRefresh }: { eventId: string; event: OsceEvent; onRefresh: () => void }) {
  const [observers, setObservers] = useState<Observer[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [clearTestLoading, setClearTestLoading] = useState(false);
  const [clearTestConfirm, setClearTestConfirm] = useState(false);

  const emptyObserverForm = {
    name: '', title: '', agency: '', email: '', phone: '', role: '',
    block_ids: [] as string[], agency_preference: false, agency_preference_note: '',
  };
  const [observerForm, setObserverForm] = useState(emptyObserverForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchObservers = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/observers`);
      if (res.ok) {
        const data = await res.json();
        setObservers(data.observers || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventId]);

  const fetchTimeBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/time-blocks`);
      if (res.ok) {
        const data = await res.json();
        setTimeBlocks(data.blocks || []);
      }
    } catch { /* ignore */ }
  }, [eventId]);

  useEffect(() => {
    fetchObservers();
    fetchTimeBlocks();
  }, [fetchObservers, fetchTimeBlocks]);

  const handleDelete = async (observerId: string) => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/observers/${observerId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchObservers();
        onRefresh();
      }
    } catch { /* ignore */ }
  };

  const handleSaveObserver = async (isEdit: boolean) => {
    setFormSaving(true);
    setFormError(null);

    try {
      if (isEdit && showEditModal) {
        const res = await fetch(`/api/osce/events/${eventId}/observers/${showEditModal}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: observerForm.name,
            title: observerForm.title,
            agency: observerForm.agency,
            email: observerForm.email,
            phone: observerForm.phone || null,
            role: observerForm.role || null,
            block_ids: observerForm.block_ids,
            agency_preference: observerForm.agency_preference,
            agency_preference_note: observerForm.agency_preference_note || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setFormError(data.error || 'Failed to update observer');
          setFormSaving(false);
          return;
        }
      } else {
        const res = await fetch(`/api/osce/events/${eventId}/observers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: observerForm.name,
            title: observerForm.title,
            agency: observerForm.agency,
            email: observerForm.email,
            phone: observerForm.phone || null,
            role: observerForm.role || null,
            block_ids: observerForm.block_ids,
            agency_preference: observerForm.agency_preference,
            agency_preference_note: observerForm.agency_preference_note || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setFormError(data.error || 'Failed to add observer. The POST endpoint may not exist yet.');
          setFormSaving(false);
          return;
        }
      }

      setObserverForm(emptyObserverForm);
      setShowAddModal(false);
      setShowEditModal(null);
      fetchObservers();
      onRefresh();
    } catch {
      setFormError('Network error');
    }
    setFormSaving(false);
  };

  const openEditModal = (obs: Observer) => {
    setObserverForm({
      name: obs.name,
      title: obs.title,
      agency: obs.agency,
      email: obs.email,
      phone: obs.phone || '',
      role: obs.role || '',
      block_ids: obs.blocks.map(b => b.block_id),
      agency_preference: obs.agency_preference,
      agency_preference_note: obs.agency_preference_note || '',
    });
    setFormError(null);
    setShowEditModal(obs.id);
  };

  const handleTestRegistration = async () => {
    setTestLoading(true);
    const ts = Date.now();
    const firstBlock = timeBlocks.length > 0 ? timeBlocks[0] : null;
    try {
      await fetch(`/api/osce/events/${eventId}/observers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test User ${ts}`,
          title: 'Test Title',
          agency: 'Test Agency',
          email: `test-${ts}@test.com`,
          phone: '555-0000',
          role: 'observer',
          block_ids: firstBlock ? [firstBlock.id] : [],
          agency_preference: false,
          agency_preference_note: null,
        }),
      });
      fetchObservers();
      onRefresh();
    } catch { /* ignore */ }
    setTestLoading(false);
  };

  const handleClearTestData = async () => {
    setClearTestLoading(true);
    const testObservers = observers.filter(o =>
      o.name.toLowerCase().includes('test') || o.email.toLowerCase().includes('test')
    );
    for (const obs of testObservers) {
      try {
        await fetch(`/api/osce/events/${eventId}/observers/${obs.id}`, { method: 'DELETE' });
      } catch { /* ignore */ }
    }
    setClearTestConfirm(false);
    setClearTestLoading(false);
    fetchObservers();
    onRefresh();
  };

  // Toggle block for an observer via direct API calls
  const toggleBlock = async (observerId: string, blockId: string, currentlyAssigned: boolean) => {
    // Optimistic UI update
    const observer = observers.find(o => o.id === observerId);
    if (!observer) return;

    const currentBlockIds = observer.blocks.map(b => b.block_id);
    const newBlockIds = currentlyAssigned
      ? currentBlockIds.filter(id => id !== blockId)
      : [...currentBlockIds, blockId];

    setObservers(prev => prev.map(o => {
      if (o.id !== observerId) return o;
      if (currentlyAssigned) {
        return { ...o, blocks: o.blocks.filter(b => b.block_id !== blockId) };
      } else {
        const block = timeBlocks.find(b => b.id === blockId);
        if (!block) return o;
        return {
          ...o,
          blocks: [...o.blocks, {
            block_id: block.id,
            day_number: block.day_number,
            label: block.label,
            date: block.date,
            start_time: block.start_time,
            end_time: block.end_time,
          }],
        };
      }
    }));

    // Persist via PUT endpoint
    try {
      const res = await fetch(`/api/osce/events/${eventId}/observers/${observerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_ids: newBlockIds }),
      });
      if (!res.ok) {
        // Revert optimistic update on failure
        fetchObservers();
      }
    } catch {
      fetchObservers();
    }
  };

  const filtered = observers.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.agency.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
  });

  // block capacity map
  const blockCapacity = new Map<string, { count: number; max: number }>();
  timeBlocks.forEach(b => blockCapacity.set(b.id, { count: b.observer_count, max: b.max_observers }));

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  // Observer form modal (shared between add and edit)
  const renderObserverModal = (isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Observer' : 'Add Observer'}
          </h2>
          <button
            onClick={() => { isEdit ? setShowEditModal(null) : setShowAddModal(false); setObserverForm(emptyObserverForm); setFormError(null); }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name *</label>
              <input type="text" value={observerForm.name} onChange={e => setObserverForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
              <input type="text" value={observerForm.title} onChange={e => setObserverForm(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agency *</label>
              <input type="text" value={observerForm.agency} onChange={e => setObserverForm(p => ({ ...p, agency: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email *</label>
              <input type="email" value={observerForm.email} onChange={e => setObserverForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label>
              <input type="tel" value={observerForm.phone} onChange={e => setObserverForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
              <select value={observerForm.role} onChange={e => setObserverForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select role...</option>
                <option value="observer">Observer</option>
                <option value="evaluator">Evaluator</option>
                <option value="patient">Standardized Patient</option>
                <option value="proctor">Proctor</option>
              </select>
            </div>
          </div>

          {/* Time block checkboxes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Time Blocks</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              {timeBlocks.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">No time blocks configured for this event.</p>
              ) : (
                timeBlocks.map(block => {
                  const cap = blockCapacity.get(block.id);
                  const isFull = cap ? cap.count >= cap.max : false;
                  const isSelected = observerForm.block_ids.includes(block.id);
                  return (
                    <label key={block.id} className={`flex items-center gap-3 p-2 rounded ${isFull && !isSelected ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} cursor-pointer`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isFull && !isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setObserverForm(p => ({ ...p, block_ids: [...p.block_ids, block.id] }));
                          } else {
                            setObserverForm(p => ({ ...p, block_ids: p.block_ids.filter(id => id !== block.id) }));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 dark:text-white">Day {block.day_number} - {block.label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{block.date} {block.start_time}-{block.end_time}</span>
                      </div>
                      <span className={`text-xs font-medium ${isFull ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {cap ? `${cap.count}/${cap.max}` : ''}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Agency preference */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={observerForm.agency_preference}
                onChange={e => setObserverForm(p => ({ ...p, agency_preference: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Agency preference (match with student&apos;s agency)</span>
            </label>
            {observerForm.agency_preference && (
              <input
                type="text"
                value={observerForm.agency_preference_note}
                onChange={e => setObserverForm(p => ({ ...p, agency_preference_note: e.target.value }))}
                placeholder="Agency preference note..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { isEdit ? setShowEditModal(null) : setShowAddModal(false); setObserverForm(emptyObserverForm); setFormError(null); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveObserver(isEdit)}
              disabled={formSaving || !observerForm.name.trim() || !observerForm.email.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {formSaving ? 'Saving...' : isEdit ? 'Update Observer' : 'Add Observer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, agency, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => { setObserverForm(emptyObserverForm); setFormError(null); setShowAddModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Observer
        </button>
        <a
          href={`/api/osce/events/${eventId}/observers/export`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
          title="Coming soon"
        >
          <Send className="w-4 h-4" />
          Send Calendar Invites
          <span className="text-xs">(Coming soon)</span>
        </button>
      </div>

      {/* Test mode section (only for draft events) */}
      {event.status === 'draft' && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Test Mode</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestRegistration}
              disabled={testLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-xs font-medium disabled:opacity-50"
            >
              {testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Submit Test Registration
            </button>
            {clearTestConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 dark:text-amber-300">Delete all test observers?</span>
                <button
                  onClick={handleClearTestData}
                  disabled={clearTestLoading}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                >
                  {clearTestLoading ? 'Clearing...' : 'Confirm'}
                </button>
                <button onClick={() => setClearTestConfirm(false)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setClearTestConfirm(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Test Data
              </button>
            )}
          </div>
        </div>
      )}

      {/* Observer count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {filtered.length} observer{filtered.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </p>

      {/* Observer table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Name', 'Title', 'Agency', 'Email', 'Phone', 'Role', 'Blocks', 'Registered', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(o => (
              <Fragment key={o.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{o.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{o.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{o.agency}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{o.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{o.phone || '--'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{o.role || '--'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {o.blocks.map(b => {
                        const cap = blockCapacity.get(b.block_id);
                        return (
                          <span
                            key={b.block_id}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                              b.day_number === 1
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            }`}
                            title={cap ? `${cap.count}/${cap.max} observers` : b.label}
                            onClick={e => { e.stopPropagation(); toggleBlock(o.id, b.block_id, true); }}
                          >
                            D{b.day_number} {b.label}
                          </span>
                        );
                      })}
                      {o.blocks.length === 0 && <span className="text-xs text-gray-400">None</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEditModal(o)} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Edit observer" aria-label="Edit observer">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {deleteConfirm === o.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(o.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(o.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete observer" aria-label="Delete observer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {expandedId === o.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </td>
                </tr>
                {expandedId === o.id && (
                  <tr>
                    <td colSpan={9} className="px-4 py-3 bg-gray-50 dark:bg-gray-900">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="font-medium text-gray-500 dark:text-gray-400">Phone:</span> <span className="text-gray-900 dark:text-white">{o.phone || 'N/A'}</span></div>
                        <div><span className="font-medium text-gray-500 dark:text-gray-400">Role:</span> <span className="text-gray-900 dark:text-white">{o.role || 'N/A'}</span></div>
                        <div>
                          <span className="font-medium text-gray-500 dark:text-gray-400">Agency Pref:</span>{' '}
                          {o.agency_preference
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Yes</span>
                            : <span className="text-gray-400">No</span>}
                        </div>
                        {o.agency_preference && o.agency_preference_note && (
                          <div className="col-span-2"><span className="font-medium text-gray-500 dark:text-gray-400">Agency Note:</span> <span className="text-gray-900 dark:text-white">{o.agency_preference_note}</span></div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? `No observers matching "${searchQuery}".` : 'No observers registered yet.'}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && renderObserverModal(false)}
      {showEditModal && renderObserverModal(true)}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Schedule Alignment
// ═══════════════════════════════════════════════════════════════════════════════

function ScheduleTab({ eventId }: { eventId: string }) {
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  if (schedule.length === 0) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">No schedule data found. Add time blocks and observers first.</div>;
  }

  return (
    <div className="space-y-6">
      {schedule.map(block => {
        const maxRows = Math.max(block.observers.length, block.students.length, 1);

        return (
          <div key={block.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Block header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  block.day_number === 1
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                }`}>
                  Day {block.day_number}
                </span>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{block.label}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">{block.start_time} - {block.end_time}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  block.observerCount >= (block.max_observers || 4)
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : block.observerCount > 0
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}>
                  {block.observerCount}/{block.max_observers || 4} observers
                </span>
                {block.matches.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {block.matches.length} match{block.matches.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Three-column grid */}
            <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Observers</span>
              </div>
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</span>
              </div>
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency Match</span>
              </div>

              {Array.from({ length: maxRows }).map((_, rowIdx) => {
                const observer = block.observers[rowIdx];
                const student = block.students[rowIdx];
                const studentMatch = student
                  ? block.matches.find(m => m.studentName.toUpperCase() === student.name.toUpperCase())
                  : null;
                const isMatchRow = !!studentMatch;

                return (
                  <Fragment key={rowIdx}>
                    <div className={`px-4 py-2 ${isMatchRow ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${rowIdx < maxRows - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
                      {observer ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{observer.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{observer.agency}</p>
                        </div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">--</span>}
                    </div>
                    <div className={`px-4 py-2 ${isMatchRow ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${rowIdx < maxRows - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
                      {student ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">{student.slot}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</span>
                        </div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">--</span>}
                    </div>
                    <div className={`px-4 py-2 ${isMatchRow ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${rowIdx < maxRows - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
                      {studentMatch ? (
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          <div>
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{studentMatch.agency}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{studentMatch.studentName} / {studentMatch.observerName}</p>
                          </div>
                        </div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">--</span>}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Agency Mappings
// ═══════════════════════════════════════════════════════════════════════════════

function AgenciesTab({ eventId }: { eventId: string }) {
  const [mappings, setMappings] = useState<StudentAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMapping, setNewMapping] = useState({ student_name: '', agency: '', relationship: 'employer' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAgencies = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/student-agencies`);
      if (res.ok) {
        const data = await res.json();
        setMappings(data.student_agencies || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapping.student_name.trim() || !newMapping.agency.trim()) return;
    try {
      const res = await fetch(`/api/osce/events/${eventId}/student-agencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMapping),
      });
      if (res.ok) {
        setNewMapping({ student_name: '', agency: '', relationship: 'employer' });
        fetchAgencies();
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/osce/events/${eventId}/student-agencies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setDeleteConfirm(null);
      fetchAgencies();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Student-Agency Mapping
        </h3>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Student Name</label>
            <input
              type="text"
              value={newMapping.student_name}
              onChange={e => setNewMapping({ ...newMapping, student_name: e.target.value })}
              placeholder="e.g. SMITH"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agency</label>
            <input
              type="text"
              value={newMapping.agency}
              onChange={e => setNewMapping({ ...newMapping, agency: e.target.value })}
              placeholder="e.g. Tucson Fire Department"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Relationship</label>
            <select
              value={newMapping.relationship}
              onChange={e => setNewMapping({ ...newMapping, relationship: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="employer">Employer</option>
              <option value="internship">Internship</option>
              <option value="clinical">Clinical Site</option>
              <option value="volunteer">Volunteer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>

      {/* Mappings table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Student Name', 'Agency', 'Relationship', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {mappings.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{m.student_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{m.agency}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.relationship === 'employer' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : m.relationship === 'internship' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : m.relationship === 'clinical' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {m.relationship || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {deleteConfirm === m.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(m.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Confirm</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(m.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mappings.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No student-agency mappings yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: Time Blocks
// ═══════════════════════════════════════════════════════════════════════════════

function TimeBlocksTab({ eventId, event, onRefresh }: { eventId: string; event: OsceEvent; onRefresh: () => void }) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [quickSetupLoading, setQuickSetupLoading] = useState(false);

  const emptyBlockForm = {
    day_number: 1, label: '', date: event.start_date, start_time: '09:00', end_time: '12:00',
    max_observers: event.max_observers_per_block, sort_order: 0,
  };
  const [blockForm, setBlockForm] = useState(emptyBlockForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/time-blocks`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleAdd = async () => {
    setFormSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/osce/events/${eventId}/time-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Failed to add block');
        setFormSaving(false);
        return;
      }
      setBlockForm(emptyBlockForm);
      setShowAddModal(false);
      fetchBlocks();
      onRefresh();
    } catch {
      setFormError('Network error');
    }
    setFormSaving(false);
  };

  const handleUpdate = async () => {
    if (!showEditModal) return;
    setFormSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/osce/events/${eventId}/time-blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showEditModal, ...blockForm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Failed to update block');
        setFormSaving(false);
        return;
      }
      setBlockForm(emptyBlockForm);
      setShowEditModal(null);
      fetchBlocks();
    } catch {
      setFormError('Network error');
    }
    setFormSaving(false);
  };

  const handleDelete = async (blockId: string) => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/time-blocks?id=${blockId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchBlocks();
        onRefresh();
      }
    } catch { /* ignore */ }
  };

  const handleQuickSetup = async () => {
    setQuickSetupLoading(true);
    const newBlocks: Array<{
      day_number: number;
      label: string;
      date: string;
      start_time: string;
      end_time: string;
      max_observers: number;
      sort_order: number;
    }> = [];

    const start = new Date(event.start_date + 'T00:00:00');
    const end = new Date(event.end_date + 'T00:00:00');
    let dayNum = 1;
    let sortOrder = blocks.length > 0 ? Math.max(...blocks.map(b => b.sort_order)) + 1 : 1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      newBlocks.push(
        { day_number: dayNum, label: 'Morning', date: dateStr, start_time: '09:00', end_time: '12:00', max_observers: event.max_observers_per_block, sort_order: sortOrder++ },
        { day_number: dayNum, label: 'Early Afternoon', date: dateStr, start_time: '13:00', end_time: '15:00', max_observers: event.max_observers_per_block, sort_order: sortOrder++ },
        { day_number: dayNum, label: 'Late Afternoon', date: dateStr, start_time: '15:00', end_time: '17:00', max_observers: event.max_observers_per_block, sort_order: sortOrder++ },
      );
      dayNum++;
    }

    try {
      await fetch(`/api/osce/events/${eventId}/time-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: newBlocks }),
      });
      fetchBlocks();
      onRefresh();
    } catch { /* ignore */ }
    setQuickSetupLoading(false);
  };

  const openEditModal = (block: TimeBlock) => {
    setBlockForm({
      day_number: block.day_number,
      label: block.label,
      date: block.date,
      start_time: block.start_time,
      end_time: block.end_time,
      max_observers: block.max_observers,
      sort_order: block.sort_order,
    });
    setFormError(null);
    setShowEditModal(block.id);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  const renderBlockModal = (isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEdit ? 'Edit Time Block' : 'Add Time Block'}</h2>
          <button onClick={() => { isEdit ? setShowEditModal(null) : setShowAddModal(false); setBlockForm(emptyBlockForm); setFormError(null); }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Label *</label>
              <input type="text" value={blockForm.label} onChange={e => setBlockForm(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Morning" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Day Number *</label>
              <input type="number" min={1} value={blockForm.day_number} onChange={e => setBlockForm(p => ({ ...p, day_number: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date *</label>
            <input type="date" value={blockForm.date} onChange={e => setBlockForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Time *</label>
              <input type="time" value={blockForm.start_time} onChange={e => setBlockForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Time *</label>
              <input type="time" value={blockForm.end_time} onChange={e => setBlockForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Observers</label>
              <input type="number" min={1} max={20} value={blockForm.max_observers} onChange={e => setBlockForm(p => ({ ...p, max_observers: parseInt(e.target.value) || 4 }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sort Order</label>
              <input type="number" min={0} value={blockForm.sort_order} onChange={e => setBlockForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { isEdit ? setShowEditModal(null) : setShowAddModal(false); setBlockForm(emptyBlockForm); setFormError(null); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button onClick={() => isEdit ? handleUpdate() : handleAdd()} disabled={formSaving || !blockForm.label.trim() || !blockForm.date}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {formSaving ? 'Saving...' : isEdit ? 'Update Block' : 'Add Block'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setBlockForm(emptyBlockForm); setFormError(null); setShowAddModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Block
        </button>
        <button onClick={handleQuickSetup} disabled={quickSetupLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50">
          {quickSetupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Quick Setup (3 blocks/day)
        </button>
      </div>

      {/* Blocks table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Sort', 'Day', 'Label', 'Date', 'Start', 'End', 'Max Obs.', 'Observers', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {blocks.map(block => (
              <tr key={block.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{block.sort_order}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    block.day_number === 1
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  }`}>
                    Day {block.day_number}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{block.label}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{block.date}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{block.start_time}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{block.end_time}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{block.max_observers}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-16">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (block.observer_count / block.max_observers) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{block.observer_count}/{block.max_observers}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(block)} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Edit block" aria-label="Edit time block">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {deleteConfirm === block.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(block.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(block.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete block" aria-label="Delete time block">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {blocks.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No time blocks yet. Add blocks individually or use Quick Setup.
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && renderBlockModal(false)}
      {showEditModal && renderBlockModal(true)}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: Students
// ═══════════════════════════════════════════════════════════════════════════════

function StudentsTab({ eventId }: { eventId: string }) {
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleReorder = async (blockId: string, students: { id: string; name: string; slot: number }[], index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= students.length) return;

    const reordered = [...students];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    const studentIds = reordered.map(s => s.id);

    // Optimistic update
    setSchedule(prev => prev.map(block => {
      if (block.id !== blockId) return block;
      return { ...block, students: reordered.map((s, i) => ({ ...s, slot: i + 1 })) };
    }));

    try {
      await fetch(`/api/osce/events/${eventId}/students/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, studentIds }),
      });
    } catch {
      fetchSchedule();
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  const blocksWithStudents = schedule.filter(b => b.students.length > 0);

  if (blocksWithStudents.length === 0) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">No students assigned to time blocks yet.</div>;
  }

  return (
    <div className="space-y-6">
      {blocksWithStudents.map(block => (
        <div key={block.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              block.day_number === 1
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
            }`}>
              Day {block.day_number}
            </span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{block.label}</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{block.start_time} - {block.end_time}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{block.students.length} student{block.students.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {block.students.map((student, idx) => (
              <div key={student.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {student.slot}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleReorder(block.id, block.students, idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                    aria-label="Move up"
                  >
                    <ArrowUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleReorder(block.id, block.students, idx, 'down')}
                    disabled={idx === block.students.length - 1}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                    aria-label="Move down"
                  >
                    <ArrowDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6: Settings
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsTab({ event, onRefresh }: { event: OsceEvent; onRefresh: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: event.title,
    subtitle: event.subtitle || '',
    slug: event.slug,
    description: event.description || '',
    location: event.location || '',
    start_date: event.start_date,
    end_date: event.end_date,
    max_observers_per_block: event.max_observers_per_block,
    status: event.status,
    event_pin: event.event_pin || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/osce/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          slug: form.slug.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          start_date: form.start_date,
          end_date: form.end_date,
          max_observers_per_block: form.max_observers_per_block,
          status: form.status,
          event_pin: form.event_pin.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || 'Failed to save');
      } else {
        setSaveSuccess(true);
        onRefresh();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError('Network error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/osce/events/${event.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/osce-events');
      }
    } catch { /* ignore */ }
    setDeleteLoading(false);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/osce/${form.slug}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Event Metadata */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Details</h3>

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
            <Check className="w-4 h-4 inline mr-1" /> Settings saved successfully.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subtitle</label>
            <input type="text" value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">/osce/</span>
              <input type="text" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <button onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                Copy URL
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
            <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Observers Per Block</label>
              <input type="number" min={1} max={20} value={form.max_observers_per_block} onChange={e => setForm(p => ({ ...p, max_observers_per_block: parseInt(e.target.value) || 4 }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as OsceEvent['status'] }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Evaluator Access PIN */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Evaluator Access</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Evaluators enter this PIN at <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">/osce-scoring/enter</span> to access the scoring portal. They select their name from the list of registered observers and faculty.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Event PIN</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.event_pin}
              onChange={e => setForm(p => ({ ...p, event_pin: e.target.value }))}
              placeholder="e.g. OSCE2026"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let pin = '';
                for (let i = 0; i < 8; i++) pin += chars[Math.floor(Math.random() * chars.length)];
                setForm(p => ({ ...p, event_pin: pin }));
              }}
              className="px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap"
            >
              Generate
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Share this code with evaluators on event day. Changes are saved with the button above.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Deleting this event will permanently remove all associated data including observers, time blocks, schedules, and agency mappings.
          {event.observer_count > 0 && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
              Warning: This event has {event.observer_count} registered observer{event.observer_count !== 1 ? 's' : ''}.
            </span>
          )}
        </p>
        {deleteConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-700 dark:text-red-300 font-medium">Are you sure? This cannot be undone.</span>
            <button onClick={handleDelete} disabled={deleteLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50">
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleteLoading ? 'Deleting...' : 'Yes, Delete Event'}
            </button>
            <button onClick={() => setDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium">
            <Trash2 className="w-4 h-4" />
            Delete This Event
          </button>
        )}
      </div>
    </div>
  );
}
