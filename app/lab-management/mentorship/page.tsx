'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  XCircle,
  Filter,
  AlertCircle,
  RefreshCw,
  Calendar,
  Target,
  ClipboardList,
} from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { hasMinRole } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface MentorshipPair {
  id: string;
  mentor_id: string;
  mentee_id: string;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'paused';
  goals: string | null;
  created_by: string | null;
  created_at: string;
  mentor: Student;
  mentee: Student;
  log_count: number;
}

interface MentorshipLog {
  id: string;
  pair_id: string;
  log_date: string;
  notes: string;
  logged_by: string | null;
  created_at: string;
}

interface Stats {
  active: number;
  completed: number;
  total_meetings: number;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MentorshipPair['status'] }) {
  const config = {
    active: {
      label: 'Active',
      classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      icon: <PlayCircle className="w-3 h-3" />,
    },
    paused: {
      label: 'Paused',
      classes: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      icon: <PauseCircle className="w-3 h-3" />,
    },
    completed: {
      label: 'Completed',
      classes: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
      icon: <CheckCircle className="w-3 h-3" />,
    },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function formatDuration(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MentorshipPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [stats, setStats] = useState<Stats>({ active: 0, completed: 0, total_meetings: 0 });
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create pair form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMentorId, setNewMentorId] = useState('');
  const [newMenteeId, setNewMenteeId] = useState('');
  const [newGoals, setNewGoals] = useState('');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Expanded pair detail
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [pairLogs, setPairLogs] = useState<Record<string, MentorshipLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);

  // Add log form
  const [showLogForm, setShowLogForm] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logNotes, setLogNotes] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState('');

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Goals editing
  const [editingGoals, setEditingGoals] = useState<string | null>(null);
  const [goalsText, setGoalsText] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserRole();
    }
  }, [session]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!hasMinRole(data.user.role, 'instructor')) {
          router.push('/');
          return;
        }
        setUserRole(data.user.role);
        await Promise.all([fetchPairs(), fetchStudents()]);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPairs = async (filter?: string) => {
    setRefreshing(true);
    try {
      const query = new URLSearchParams();
      const s = filter !== undefined ? filter : statusFilter;
      if (s) query.set('status', s);

      const res = await fetch(`/api/lab-management/mentorship?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPairs(data.pairs || []);
        setStats(data.stats || { active: 0, completed: 0, total_meetings: 0 });
      }
    } catch (err) {
      console.error('Error fetching mentorship pairs:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/lab-management/students?limit=200&status=active');
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const fetchLogs = async (pairId: string) => {
    setLoadingLogs(pairId);
    try {
      const res = await fetch(`/api/lab-management/mentorship/${pairId}/logs`);
      const data = await res.json();
      if (data.success) {
        setPairLogs(prev => ({ ...prev, [pairId]: data.logs || [] }));
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(null);
    }
  };

  const toggleExpand = async (pairId: string) => {
    if (expandedPair === pairId) {
      setExpandedPair(null);
      setShowLogForm(null);
    } else {
      setExpandedPair(pairId);
      setShowLogForm(null);
      if (!pairLogs[pairId]) {
        await fetchLogs(pairId);
      }
    }
  };

  const handleCreatePair = async () => {
    setCreateError('');
    if (!newMentorId || !newMenteeId) {
      setCreateError('Please select both a mentor and a mentee.');
      return;
    }
    if (newMentorId === newMenteeId) {
      setCreateError('Mentor and mentee must be different students.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/lab-management/mentorship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentor_id: newMentorId,
          mentee_id: newMenteeId,
          goals: newGoals || null,
          start_date: newStartDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateForm(false);
        setNewMentorId('');
        setNewMenteeId('');
        setNewGoals('');
        setNewStartDate(new Date().toISOString().split('T')[0]);
        await fetchPairs();
      } else {
        setCreateError(data.error || 'Failed to create pair.');
      }
    } catch (err) {
      setCreateError('An unexpected error occurred.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddLog = async (pairId: string) => {
    setLogError('');
    if (!logNotes.trim()) {
      setLogError('Notes are required.');
      return;
    }
    setSubmittingLog(true);
    try {
      const res = await fetch(`/api/lab-management/mentorship/${pairId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: logDate, notes: logNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setShowLogForm(null);
        setLogNotes('');
        setLogDate(new Date().toISOString().split('T')[0]);
        await fetchLogs(pairId);
        await fetchPairs();
      } else {
        setLogError(data.error || 'Failed to add log.');
      }
    } catch (err) {
      setLogError('An unexpected error occurred.');
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleStatusChange = async (pairId: string, newStatus: string) => {
    setUpdatingStatus(pairId);
    try {
      const updates: Record<string, string> = { status: newStatus };
      if (newStatus === 'completed') {
        updates.end_date = new Date().toISOString().split('T')[0];
      }
      const res = await fetch(`/api/lab-management/mentorship/${pairId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPairs();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleSaveGoals = async (pairId: string) => {
    setSavingGoals(true);
    try {
      const res = await fetch(`/api/lab-management/mentorship/${pairId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: goalsText }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingGoals(null);
        await fetchPairs();
      }
    } catch (err) {
      console.error('Error saving goals:', err);
    } finally {
      setSavingGoals(false);
    }
  };

  const handleFilterChange = (val: string) => {
    setStatusFilter(val);
    fetchPairs(val);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !userRole) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <LabHeader
        title="Student Mentorship"
        breadcrumbs={[{ label: 'Mentorship' }]}
        actions={
          <button
            onClick={() => setShowCreateForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Pair
          </button>
        }
      />

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active Pairs</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_meetings}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Meetings Logged</p>
            </div>
          </div>
        </div>

        {/* Create Pair Form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-blue-200 dark:border-blue-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Create New Mentorship Pair
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mentor (Advanced Student)
                </label>
                <select
                  value={newMentorId}
                  onChange={e => setNewMentorId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select mentor...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id} disabled={s.id === newMenteeId}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mentee (Newer Student)
                </label>
                <select
                  value={newMenteeId}
                  onChange={e => setNewMenteeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select mentee...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id} disabled={s.id === newMentorId}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={e => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Goals (optional)
              </label>
              <textarea
                value={newGoals}
                onChange={e => setNewGoals(e.target.value)}
                rows={3}
                placeholder="Describe the mentorship goals..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            {createError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleCreatePair}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Pair
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex gap-2 flex-wrap">
              {(['', 'active', 'paused', 'completed'] as const).map(val => (
                <button
                  key={val}
                  onClick={() => handleFilterChange(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {val === '' ? 'All' : val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              ))}
            </div>
            {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
          </div>
        </div>

        {/* Pairs List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Mentorship Pairs</h2>
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{pairs.length} pair{pairs.length !== 1 ? 's' : ''}</span>
          </div>

          {pairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Mentorship Pairs Found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                {statusFilter
                  ? `No ${statusFilter} pairs at this time. Try a different filter.`
                  : 'No mentorship pairs have been created yet. Use "New Pair" to get started.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {pairs.map(pair => {
                const isExpanded = expandedPair === pair.id;
                const logs = pairLogs[pair.id] || [];
                const isUpdating = updatingStatus === pair.id;

                return (
                  <div key={pair.id}>
                    {/* Row */}
                    <div className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {/* Avatar pair icons */}
                        <div className="shrink-0 flex -space-x-2">
                          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-10">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                              {pair.mentor.first_name[0]}{pair.mentor.last_name[0]}
                            </span>
                          </div>
                          <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                              {pair.mentee.first_name[0]}{pair.mentee.last_name[0]}
                            </span>
                          </div>
                        </div>

                        {/* Names */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            <span className="text-blue-700 dark:text-blue-400">
                              {pair.mentor.first_name} {pair.mentor.last_name}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 mx-2">mentors</span>
                            <span className="text-purple-700 dark:text-purple-400">
                              {pair.mentee.first_name} {pair.mentee.last_name}
                            </span>
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Started {new Date(pair.start_date).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDuration(pair.start_date, pair.end_date)} duration
                            </span>
                          </div>
                        </div>

                        {/* Status + log count */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:flex items-center gap-1">
                            <ClipboardList className="w-3 h-3" />
                            {pair.log_count} meeting{pair.log_count !== 1 ? 's' : ''}
                          </span>
                          <StatusBadge status={pair.status} />
                          <button
                            onClick={() => toggleExpand(pair.id)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-6 pb-6 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                        <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">

                          {/* Goals panel */}
                          <div className="md:col-span-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Target className="w-4 h-4" />
                                Goals
                              </h4>
                              {editingGoals !== pair.id && (
                                <button
                                  onClick={() => {
                                    setEditingGoals(pair.id);
                                    setGoalsText(pair.goals || '');
                                  }}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                            {editingGoals === pair.id ? (
                              <div>
                                <textarea
                                  value={goalsText}
                                  onChange={e => setGoalsText(e.target.value)}
                                  rows={4}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleSaveGoals(pair.id)}
                                    disabled={savingGoals}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-medium"
                                  >
                                    {savingGoals ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditingGoals(null)}
                                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                {pair.goals || 'No goals set yet.'}
                              </p>
                            )}

                            {/* Status management */}
                            <div className="mt-4">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Change Status
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {pair.status !== 'active' && (
                                  <button
                                    onClick={() => handleStatusChange(pair.id, 'active')}
                                    disabled={isUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                  >
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    Set Active
                                  </button>
                                )}
                                {pair.status !== 'paused' && (
                                  <button
                                    onClick={() => handleStatusChange(pair.id, 'paused')}
                                    disabled={isUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                  >
                                    <PauseCircle className="w-3.5 h-3.5" />
                                    Pause
                                  </button>
                                )}
                                {pair.status !== 'completed' && (
                                  <button
                                    onClick={() => handleStatusChange(pair.id, 'completed')}
                                    disabled={isUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Complete
                                  </button>
                                )}
                                {isUpdating && (
                                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Meeting log timeline */}
                          <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" />
                                Meeting Log
                                {logs.length > 0 && (
                                  <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                                    {logs.length}
                                  </span>
                                )}
                              </h4>
                              <button
                                onClick={() => {
                                  setShowLogForm(showLogForm === pair.id ? null : pair.id);
                                  setLogError('');
                                  setLogNotes('');
                                  setLogDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Log Meeting
                              </button>
                            </div>

                            {/* Add log form */}
                            {showLogForm === pair.id && (
                              <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Meeting Date
                                    </label>
                                    <input
                                      type="date"
                                      value={logDate}
                                      onChange={e => setLogDate(e.target.value)}
                                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                                <div className="mb-3">
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Notes
                                  </label>
                                  <textarea
                                    value={logNotes}
                                    onChange={e => setLogNotes(e.target.value)}
                                    rows={3}
                                    placeholder="What was discussed or worked on..."
                                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  />
                                </div>
                                {logError && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">{logError}</p>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddLog(pair.id)}
                                    disabled={submittingLog}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                  >
                                    {submittingLog ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                    Add Log
                                  </button>
                                  <button
                                    onClick={() => { setShowLogForm(null); setLogError(''); }}
                                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {loadingLogs === pair.id ? (
                              <div className="flex justify-center py-6">
                                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                              </div>
                            ) : logs.length === 0 ? (
                              <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 italic">
                                No meetings logged yet.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {logs.map(log => (
                                  <div
                                    key={log.id}
                                    className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(log.log_date).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </span>
                                      {log.logged_by && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                          <UserCheck className="w-3 h-3" />
                                          {log.logged_by}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{log.notes}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href="/lab-management"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Lab Management
          </Link>
        </div>
      </main>
    </div>
  );
}
