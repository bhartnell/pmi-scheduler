'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Building2,
  ArrowUp,
  ArrowDown,
  Plus,
  Star,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ObserverBlock {
  id: string;
  label: string;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
}

interface Observer {
  id: string;
  name: string;
  title: string;
  agency: string;
  email: string;
  phone: string;
  role: string;
  agency_preference: boolean;
  agency_preference_note: string;
  created_at: string;
  blocks: ObserverBlock[];
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

type TabKey = 'observers' | 'schedule' | 'agencies';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OsceObserversAdmin() {
  const { data: session, status: authStatus } = useSession();

  // Shared state
  const [activeTab, setActiveTab] = useState<TabKey>('observers');

  // Observer tab state
  const [observers, setObservers] = useState<Observer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<'all' | '1' | '2'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Schedule tab state
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Agency mappings tab state
  const [agencyMappings, setAgencyMappings] = useState<StudentAgency[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [newMapping, setNewMapping] = useState({ student_name: '', agency: '', relationship: 'employer' });
  const [deleteAgencyConfirm, setDeleteAgencyConfirm] = useState<string | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchObservers = useCallback(async () => {
    try {
      const res = await fetch('/api/osce/observers');
      if (res.ok) {
        const data = await res.json();
        setObservers(data.observers || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const res = await fetch('/api/osce/admin/schedule');
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule || []);
      }
    } catch { /* ignore */ }
    setScheduleLoading(false);
  }, []);

  const fetchAgencies = useCallback(async () => {
    setAgenciesLoading(true);
    try {
      const res = await fetch('/api/osce/student-agencies');
      if (res.ok) {
        const data = await res.json();
        setAgencyMappings(data.student_agencies || []);
      }
    } catch { /* ignore */ }
    setAgenciesLoading(false);
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchObservers();
  }, [authStatus, fetchObservers]);

  useEffect(() => {
    if (authStatus === 'authenticated' && activeTab === 'schedule') fetchSchedule();
  }, [authStatus, activeTab, fetchSchedule]);

  useEffect(() => {
    if (authStatus === 'authenticated' && activeTab === 'agencies') fetchAgencies();
  }, [authStatus, activeTab, fetchAgencies]);

  // ─── Observer handlers ────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    await fetch(`/api/osce/observers/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchObservers();
  };

  // ─── Schedule handlers ────────────────────────────────────────────────────

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
      await fetch('/api/osce/admin/students/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, studentIds }),
      });
    } catch {
      // Revert on failure
      fetchSchedule();
    }
  };

  // ─── Agency mapping handlers ──────────────────────────────────────────────

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapping.student_name.trim() || !newMapping.agency.trim()) return;

    try {
      const res = await fetch('/api/osce/student-agencies', {
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

  const handleDeleteMapping = async (id: string) => {
    try {
      await fetch('/api/osce/student-agencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setDeleteAgencyConfirm(null);
      fetchAgencies();
    } catch { /* ignore */ }
  };

  // ─── Filtered observers ──────────────────────────────────────────────────

  const filtered = observers.filter(o => {
    if (dayFilter === 'all') return true;
    return o.blocks.some(b => b.day_number === parseInt(dayFilter));
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  if (authStatus === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  // ─── Block stats for capacity cards ───────────────────────────────────────

  const blockStats = new Map<string, { label: string; count: number; max: number }>();
  observers.forEach(o => o.blocks.forEach(b => {
    if (!blockStats.has(b.id)) blockStats.set(b.id, { label: `Day ${b.day_number} - ${b.label}`, count: 0, max: 4 });
    blockStats.get(b.id)!.count++;
  }));

  // ─── Tab definitions ─────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'observers', label: 'Observers', icon: <Users className="w-4 h-4" /> },
    { key: 'schedule', label: 'Schedule Alignment', icon: <Calendar className="w-4 h-4" /> },
    { key: 'agencies', label: 'Agency Mappings', icon: <Building2 className="w-4 h-4" /> },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSCE Observer Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{observers.length} registered observer{observers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <a href="/api/osce/observers/export" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
      {activeTab === 'observers' && (
        <ObserversTab
          observers={observers}
          filtered={filtered}
          blockStats={blockStats}
          dayFilter={dayFilter}
          setDayFilter={setDayFilter}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          handleDelete={handleDelete}
        />
      )}

      {activeTab === 'schedule' && (
        <ScheduleTab
          schedule={schedule}
          loading={scheduleLoading}
          onReorder={handleReorder}
        />
      )}

      {activeTab === 'agencies' && (
        <AgencyMappingsTab
          mappings={agencyMappings}
          loading={agenciesLoading}
          newMapping={newMapping}
          setNewMapping={setNewMapping}
          onAdd={handleAddMapping}
          deleteConfirm={deleteAgencyConfirm}
          setDeleteConfirm={setDeleteAgencyConfirm}
          onDelete={handleDeleteMapping}
        />
      )}
    </div>
  );
}

// ─── Observers Tab ──────────────────────────────────────────────────────────

function ObserversTab({
  observers,
  filtered,
  blockStats,
  dayFilter,
  setDayFilter,
  expandedId,
  setExpandedId,
  deleteConfirm,
  setDeleteConfirm,
  handleDelete,
}: {
  observers: Observer[];
  filtered: Observer[];
  blockStats: Map<string, { label: string; count: number; max: number }>;
  dayFilter: 'all' | '1' | '2';
  setDayFilter: (d: 'all' | '1' | '2') => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  handleDelete: (id: string) => void;
}) {
  return (
    <>
      {/* Block capacity cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {Array.from(blockStats.entries()).map(([id, b]) => (
          <div key={id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{b.label}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (b.count / b.max) * 100)}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.count}/{b.max}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Day filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['all', '1', '2'] as const).map(d => (
          <button key={d} onClick={() => setDayFilter(d)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${dayFilter === d ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {d === 'all' ? 'All Days' : `Day ${d}`}
          </button>
        ))}
      </div>

      {/* Observer table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Name', 'Title', 'Agency', 'Email', 'Blocks', 'Agency Pref', 'Registered', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(o => (
              <Fragment key={o.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{o.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{o.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{o.agency}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{o.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {o.blocks.map(b => (
                        <span key={b.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.day_number === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'}`}>
                          D{b.day_number} {b.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {o.agency_preference
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Yes</span>
                      : <span className="text-gray-400">No</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {expandedId === o.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      {deleteConfirm === o.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleDelete(o.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(o.id); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === o.id && (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 bg-gray-50 dark:bg-gray-900">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-medium text-gray-500 dark:text-gray-400">Phone:</span> <span className="text-gray-900 dark:text-white">{o.phone || 'N/A'}</span></div>
                        <div><span className="font-medium text-gray-500 dark:text-gray-400">Role:</span> <span className="text-gray-900 dark:text-white">{o.role || 'N/A'}</span></div>
                        {o.agency_preference && o.agency_preference_note && (
                          <div className="col-span-2">
                            <span className="font-medium text-gray-500 dark:text-gray-400">Agency Note:</span>{' '}
                            <span className="text-gray-900 dark:text-white">{o.agency_preference_note}</span>
                          </div>
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
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No observers registered yet.</div>
        )}
      </div>
    </>
  );
}

// ─── Schedule Alignment Tab ─────────────────────────────────────────────────

function ScheduleTab({
  schedule,
  loading,
  onReorder,
}: {
  schedule: ScheduleBlock[];
  loading: boolean;
  onReorder: (blockId: string, students: { id: string; name: string; slot: number }[], index: number, direction: 'up' | 'down') => void;
}) {
  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading schedule...</div>;
  }

  if (schedule.length === 0) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">No schedule data found.</div>;
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
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {block.start_time} - {block.end_time}
                </span>
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
              {/* Column headers */}
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Observers</span>
              </div>
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</span>
              </div>
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency Match</span>
              </div>

              {/* Rows */}
              {Array.from({ length: maxRows }).map((_, rowIdx) => {
                const observer = block.observers[rowIdx];
                const student = block.students[rowIdx];

                // Check if this student has an agency match
                const studentMatch = student
                  ? block.matches.find(m => m.studentName.toUpperCase() === student.name.toUpperCase())
                  : null;

                const isMatchRow = !!studentMatch;

                return (
                  <Fragment key={rowIdx}>
                    {/* Observer cell */}
                    <div className={`px-4 py-2 ${isMatchRow ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${rowIdx < maxRows - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
                      {observer ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{observer.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{observer.agency}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">--</span>
                      )}
                    </div>

                    {/* Student cell */}
                    <div className={`px-4 py-2 ${isMatchRow ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${rowIdx < maxRows - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
                      {student ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                              {student.slot}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => onReorder(block.id, block.students, rowIdx, 'up')}
                              disabled={rowIdx === 0}
                              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => onReorder(block.id, block.students, rowIdx, 'down')}
                              disabled={rowIdx === block.students.length - 1}
                              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">--</span>
                      )}
                    </div>

                    {/* Agency match cell */}
                    <div className={`px-4 py-2 ${isMatchRow ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${rowIdx < maxRows - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
                      {studentMatch ? (
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          <div>
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{studentMatch.agency}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {studentMatch.studentName} / {studentMatch.observerName}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">--</span>
                      )}
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

// ─── Agency Mappings Tab ────────────────────────────────────────────────────

function AgencyMappingsTab({
  mappings,
  loading,
  newMapping,
  setNewMapping,
  onAdd,
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
}: {
  mappings: StudentAgency[];
  loading: boolean;
  newMapping: { student_name: string; agency: string; relationship: string };
  setNewMapping: (m: { student_name: string; agency: string; relationship: string }) => void;
  onAdd: (e: React.FormEvent) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading agency mappings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Student-Agency Mapping
        </h3>
        <form onSubmit={onAdd} className="flex items-end gap-3">
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
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
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
                    m.relationship === 'employer'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : m.relationship === 'internship'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : m.relationship === 'clinical'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {m.relationship || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {deleteConfirm === m.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => onDelete(m.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Confirm</button>
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
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No student-agency mappings yet. Add one above to start tracking agency relationships.</div>
        )}
      </div>
    </div>
  );
}
