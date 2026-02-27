'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Users,
  Lock,
  Unlock,
  Shuffle,
  History,
  Printer,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Save,
  RotateCcw,
} from 'lucide-react';
import { hasMinRole, canManageContent, type Role } from '@/lib/permissions';
import { useToast } from '@/components/Toast';

// ---- Types ----

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
  photo_url: string | null;
}

interface Group {
  id: string;
  name: string;
  group_number: number;
  description: string | null;
  is_locked: boolean;
  locked_by: string | null;
  locked_by_name: string | null;
  locked_at: string | null;
  members: Student[];
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface HistoryEntry {
  id: string;
  group_id: string;
  student_id: string;
  action: 'added' | 'removed' | 'moved';
  from_group_id: string | null;
  to_group_id: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
  lab_day_id: string | null;
  student?: { id: string; first_name: string; last_name: string } | null;
  from_group?: { id: string; name: string } | null;
  to_group?: { id: string; name: string } | null;
}

// ---- Auto-balance preview modal ----

interface AutoBalanceModalProps {
  groups: Group[];
  onConfirm: () => void;
  onCancel: () => void;
}

function AutoBalanceModal({ groups, onConfirm, onCancel }: AutoBalanceModalProps) {
  const totalStudents = groups.reduce((sum, g) => sum + g.members.length, 0);
  const numGroups = groups.length;
  const targetSize = Math.floor(totalStudents / numGroups);
  const remainder = totalStudents % numGroups;
  const currentSizes = groups.map(g => g.members.length);
  const alreadyBalanced = Math.max(...currentSizes) - Math.min(...currentSizes) <= 1;

  // Estimate how many will move
  const projectedSizes = groups.map((_, i) => targetSize + (i < remainder ? 1 : 0));
  const willMove = currentSizes.reduce((sum, cur, i) => sum + Math.max(0, cur - projectedSizes[i]), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Shuffle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Balance Groups</h2>
        </div>

        {alreadyBalanced ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Groups are already balanced (sizes: {currentSizes.join(', ')}). Proceeding will randomly redistribute all students.
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This will redistribute {totalStudents} students across {numGroups} groups, moving approximately {willMove} student{willMove !== 1 ? 's' : ''}.
          </p>
        )}

        <div className="mb-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Current sizes:</div>
          <div className="flex gap-2 flex-wrap">
            {groups.map(g => (
              <span key={g.id} className="px-2 py-0.5 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 text-gray-700 dark:text-gray-200">
                {g.name}: {g.members.length}
              </span>
            ))}
          </div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mt-3 mb-2">Target sizes:</div>
          <div className="flex gap-2 flex-wrap">
            {projectedSizes.map((size, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                {groups[i]?.name}: {size}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Balance Groups
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- History Panel ----

interface HistoryPanelProps {
  history: HistoryEntry[];
  groups: Group[];
  cohortId: string;
}

function HistoryPanel({ history, groups, cohortId }: HistoryPanelProps) {
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = history.filter(h => {
    if (filterGroupId && h.group_id !== filterGroupId && h.from_group_id !== filterGroupId && h.to_group_id !== filterGroupId) return false;
    if (filterAction && h.action !== filterAction) return false;
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const actionColors = {
    added: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    removed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    moved: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 print:hidden">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h3 className="font-semibold text-gray-900 dark:text-white">Assignment History</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">({filtered.length} entries)</span>

        <div className="flex gap-2 ml-auto flex-wrap">
          <select
            value={filterGroupId}
            onChange={e => { setFilterGroupId(e.target.value); setPage(0); }}
            className="text-sm border dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All groups</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(0); }}
            className="text-sm border dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All actions</option>
            <option value="added">Added</option>
            <option value="removed">Removed</option>
            <option value="moved">Moved</option>
          </select>
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No history entries found
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Student</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Action</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">From / To</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Changed By</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(entry => (
                  <tr key={entry.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(entry.changed_at).toLocaleDateString()}{' '}
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(entry.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-900 dark:text-white">
                      {entry.student
                        ? `${entry.student.first_name} ${entry.student.last_name}`
                        : entry.student_id.slice(0, 8) + '...'}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[entry.action] || ''}`}>
                        {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {entry.action === 'moved'
                        ? `${entry.from_group?.name || '?'} → ${entry.to_group?.name || '?'}`
                        : entry.action === 'added'
                        ? `→ ${entry.to_group?.name || groups.find(g => g.id === entry.group_id)?.name || '?'}`
                        : `${entry.from_group?.name || groups.find(g => g.id === entry.group_id)?.name || '?'} →`}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {entry.changed_by_name || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-sm text-gray-600 dark:text-gray-400">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Main Page ----

function GroupManagementPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Selected cohort
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState(searchParams.get('cohortId') || '');

  const [groups, setGroups] = useState<Group[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  // UI states
  const [showHistory, setShowHistory] = useState(false);
  const [showAutoBalanceModal, setShowAutoBalanceModal] = useState(false);
  const [autoBalancing, setAutoBalancing] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // DnD
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [dragSource, setDragSource] = useState<string | 'unassigned' | null>(null);

  // ---- Auth redirect ----
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // ---- Fetch current user ----
  useEffect(() => {
    if (session) {
      fetch('/api/instructor/me')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            setUserRole(data.user.role);
            setCurrentUserId(data.user.id);
            setCurrentUserName(data.user.name || session.user?.email || '');
          }
        })
        .catch(() => {});
    }
  }, [session]);

  // ---- Fetch cohorts ----
  useEffect(() => {
    if (!session) return;
    fetch('/api/lab-management/cohorts?status=active')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.cohorts) {
          setCohorts(data.cohorts);
          if (!selectedCohortId && data.cohorts.length > 0) {
            setSelectedCohortId(data.cohorts[0].id);
          }
        }
      })
      .catch(() => {});
  }, [session]);

  // ---- Fetch groups when cohort changes ----
  const fetchGroups = useCallback(async (cohortId: string) => {
    if (!cohortId) return;
    setLoading(true);
    setHasChanges(false);
    try {
      // Fetch students
      const studentsRes = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`);
      const studentsData = await studentsRes.json();
      const students = studentsData.students || [];
      setAllStudents(students);

      // Fetch groups (with history)
      const groupsRes = await fetch(`/api/lab-management/groups?cohortId=${cohortId}&includeHistory=true`);
      const groupsData = await groupsRes.json();
      const fetchedGroups: any[] = groupsData.groups || [];
      setHistory(groupsData.history || []);

      // Fetch members for each group
      const groupsWithMembers: Group[] = await Promise.all(
        fetchedGroups.map(async (group: any) => {
          const membersRes = await fetch(`/api/lab-management/groups/${group.id}/members`);
          const membersData = await membersRes.json();
          return {
            id: group.id,
            name: group.name,
            group_number: group.group_number,
            description: group.description,
            is_locked: group.is_locked || false,
            locked_by: group.locked_by || null,
            locked_by_name: group.locked_by_name || null,
            locked_at: group.locked_at || null,
            members: membersData.members || [],
          };
        })
      );

      setGroups(groupsWithMembers);

      const assignedIds = new Set(groupsWithMembers.flatMap(g => g.members.map((m: Student) => m.id)));
      setUnassignedStudents(students.filter((s: Student) => !assignedIds.has(s.id)));
    } catch (err) {
      toast.error('Failed to load groups');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (selectedCohortId) {
      fetchGroups(selectedCohortId);
    }
  }, [selectedCohortId, fetchGroups]);

  // ---- Drag and Drop ----

  const handleDragStart = (e: React.DragEvent, student: Student, source: string | 'unassigned') => {
    setDraggedStudent(student);
    setDragSource(source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string | 'unassigned') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedStudent(null);
    setDragSource(null);
    setDropTarget(null);
  };

  const handleDropToGroup = async (targetGroupId: string) => {
    setDropTarget(null);
    if (!draggedStudent || dragSource === targetGroupId) return;

    const targetGroup = groups.find(g => g.id === targetGroupId);
    if (targetGroup?.is_locked) {
      toast.error(`Group "${targetGroup.name}" is locked`);
      return;
    }

    if (dragSource && dragSource !== 'unassigned') {
      const sourceGroup = groups.find(g => g.id === dragSource);
      if (sourceGroup?.is_locked) {
        toast.error(`Group "${sourceGroup.name}" is locked`);
        return;
      }
    }

    // Optimistic update
    const studentToMove = draggedStudent;
    const fromId = dragSource;

    setGroups(prev =>
      prev.map(g => {
        if (g.id === fromId) return { ...g, members: g.members.filter(m => m.id !== studentToMove.id) };
        if (g.id === targetGroupId) return { ...g, members: [...g.members.filter(m => m.id !== studentToMove.id), studentToMove] };
        return g;
      })
    );
    if (fromId === 'unassigned') {
      setUnassignedStudents(prev => prev.filter(s => s.id !== studentToMove.id));
    }

    setDraggedStudent(null);
    setDragSource(null);

    // Persist
    try {
      const res = await fetch('/api/lab-management/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_student',
          studentId: studentToMove.id,
          fromGroupId: fromId !== 'unassigned' ? fromId : null,
          toGroupId: targetGroupId,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to move student');
        // Revert
        fetchGroups(selectedCohortId);
      } else {
        // Update history
        fetchHistory();
      }
    } catch {
      toast.error('Failed to move student');
      fetchGroups(selectedCohortId);
    }
  };

  const handleDropToUnassigned = async () => {
    setDropTarget(null);
    if (!draggedStudent || dragSource === 'unassigned') return;

    const studentToMove = draggedStudent;
    const fromId = dragSource;

    if (fromId && fromId !== 'unassigned') {
      const sourceGroup = groups.find(g => g.id === fromId);
      if (sourceGroup?.is_locked) {
        toast.error(`Group "${sourceGroup.name}" is locked`);
        return;
      }
    }

    // Optimistic update
    setGroups(prev =>
      prev.map(g =>
        g.id === fromId ? { ...g, members: g.members.filter(m => m.id !== studentToMove.id) } : g
      )
    );
    setUnassignedStudents(prev => [...prev, studentToMove]);
    setDraggedStudent(null);
    setDragSource(null);

    // Persist - remove from group
    if (fromId && fromId !== 'unassigned') {
      try {
        await fetch(`/api/lab-management/groups/${fromId}/members?studentId=${studentToMove.id}`, {
          method: 'DELETE',
        });

        // Record history
        await fetch('/api/lab-management/groups', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move_student',
            studentId: studentToMove.id,
            fromGroupId: fromId,
            toGroupId: null,
          }),
        }).catch(() => {});

        fetchHistory();
      } catch {
        toast.error('Failed to unassign student');
        fetchGroups(selectedCohortId);
      }
    }
  };

  const fetchHistory = async () => {
    if (!selectedCohortId) return;
    try {
      const res = await fetch(`/api/lab-management/groups?cohortId=${selectedCohortId}&includeHistory=true`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch {}
  };

  // ---- Create/Delete Groups ----

  const handleCreateGroup = async () => {
    if (!selectedCohortId) return;
    try {
      const res = await fetch('/api/lab-management/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: selectedCohortId }),
      });
      const data = await res.json();
      if (data.success) {
        setGroups(prev => [...prev, {
          ...data.group,
          is_locked: false,
          locked_by: null,
          locked_by_name: null,
          locked_at: null,
          members: [],
        }]);
        toast.success('Group created');
      }
    } catch {
      toast.error('Failed to create group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.is_locked) {
      toast.error('Cannot delete a locked group');
      return;
    }
    if (!confirm(`Delete "${group.name}"? Members will become unassigned.`)) return;

    try {
      const res = await fetch(`/api/lab-management/groups/${groupId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setUnassignedStudents(prev => [...prev, ...group.members]);
        setGroups(prev => prev.filter(g => g.id !== groupId));
        toast.success('Group deleted');
      }
    } catch {
      toast.error('Failed to delete group');
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    if (!editingName.trim()) {
      setEditingGroupId(null);
      return;
    }
    try {
      const res = await fetch(`/api/lab-management/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });
      const data = await res.json();
      if (data.success) {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: editingName } : g));
      }
    } catch {
      toast.error('Failed to rename group');
    }
    setEditingGroupId(null);
    setEditingName('');
  };

  // ---- Lock / Unlock ----

  const handleToggleLock = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (!userRole || !hasMinRole(userRole, 'lead_instructor')) {
      toast.error('Only lead instructors and above can lock/unlock groups');
      return;
    }

    const action = group.is_locked ? 'unlock' : 'lock';
    try {
      const res = await fetch('/api/lab-management/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, groupId }),
      });
      const data = await res.json();
      if (data.success) {
        setGroups(prev => prev.map(g =>
          g.id === groupId ? {
            ...g,
            is_locked: data.group.is_locked,
            locked_by: data.group.locked_by,
            locked_by_name: data.group.locked_by_name,
            locked_at: data.group.locked_at,
          } : g
        ));
        toast.success(group.is_locked ? 'Group unlocked' : 'Group locked');
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('Failed to toggle lock');
    }
  };

  // ---- Auto Balance ----

  const handleAutoBalance = async () => {
    const unlockedGroups = groups.filter(g => !g.is_locked);
    if (unlockedGroups.length < 2) {
      toast.error('Need at least 2 unlocked groups to balance');
      return;
    }
    setShowAutoBalanceModal(true);
  };

  const handleConfirmAutoBalance = async () => {
    setShowAutoBalanceModal(false);
    setAutoBalancing(true);

    const groupIds = groups.filter(g => !g.is_locked).map(g => g.id);

    try {
      const res = await fetch('/api/lab-management/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_balance', groupIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Auto-balanced: ${data.moved} student${data.moved !== 1 ? 's' : ''} moved`);
        await fetchGroups(selectedCohortId);
      } else {
        toast.error(data.error || 'Failed to auto-balance');
      }
    } catch {
      toast.error('Failed to auto-balance');
    }
    setAutoBalancing(false);
  };

  // ---- Save All (batch PUT for members) ----

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all(
        groups.map(group =>
          fetch(`/api/lab-management/groups/${group.id}/members`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentIds: group.members.map(m => m.id) }),
          })
        )
      );
      setHasChanges(false);
      toast.success('Groups saved');
    } catch {
      toast.error('Failed to save groups');
    }
    setSaving(false);
  };

  // ---- Print ----

  const handlePrint = () => {
    window.print();
  };

  const selectedCohort = cohorts.find(c => c.id === selectedCohortId);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const canLock = userRole && hasMinRole(userRole, 'lead_instructor');
  const canManage = userRole && canManageContent(userRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-inside: avoid; }
          body { background: white; }
          .print-header { display: block !important; }
        }
        @media screen {
          .print-header { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span>Group Management</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Group Management</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCohort
                    ? `${selectedCohort.program.abbreviation} Group ${selectedCohort.cohort_number} • ${allStudents.length} students`
                    : 'Select a cohort to manage groups'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Cohort selector */}
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                className="text-sm border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select cohort...</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program.abbreviation} Group {c.cohort_number}
                  </option>
                ))}
              </select>

              {selectedCohortId && groups.length >= 2 && (
                <button
                  onClick={handleAutoBalance}
                  disabled={autoBalancing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  <Shuffle className="w-4 h-4" />
                  {autoBalancing ? 'Balancing...' : 'Auto-Balance'}
                </button>
              )}

              {selectedCohortId && canManage && (
                <button
                  onClick={handleCreateGroup}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                >
                  <Plus className="w-4 h-4" />
                  Add Group
                </button>
              )}

              {selectedCohortId && (
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                >
                  <Printer className="w-4 h-4" />
                  Print All
                </button>
              )}

              {hasChanges && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Print header - only shown when printing */}
        <div className="print-header mb-6 border-b-2 border-gray-800 pb-3">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Lab Group Rosters</h1>
              <p className="text-gray-600">
                {selectedCohort
                  ? `${selectedCohort.program.abbreviation} Group ${selectedCohort.cohort_number} • ${allStudents.length} students`
                  : ''}
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Printed: {new Date().toLocaleDateString()}</p>
              <p>{groups.length} groups</p>
            </div>
          </div>
        </div>

        {!selectedCohortId ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Select a Cohort</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Choose a cohort from the dropdown above to manage its groups.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Groups area */}
              <div className="flex-1 min-w-0">
                {groups.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center">
                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No groups yet for this cohort</p>
                    {canManage && (
                      <button
                        onClick={handleCreateGroup}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Create First Group
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        onDragOver={e => handleDragOver(e, group.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDropToGroup(group.id)}
                        className={`
                          bg-white dark:bg-gray-800 rounded-lg shadow print-break transition-all
                          ${dropTarget === group.id ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
                          ${group.is_locked ? 'opacity-90' : ''}
                        `}
                      >
                        {/* Group Header */}
                        <div className={`p-3 border-b dark:border-gray-700 rounded-t-lg ${group.is_locked ? 'bg-gray-50 dark:bg-gray-750' : ''}`}>
                          {editingGroupId === group.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRenameGroup(group.id)}
                                className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                onClick={() => handleRenameGroup(group.id)}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingGroupId(null)}
                                className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                {group.is_locked && (
                                  <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                )}
                                <span className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                                  ({group.members.length})
                                </span>
                              </div>

                              <div className="flex items-center gap-1 no-print flex-shrink-0">
                                {/* Lock/Unlock button */}
                                {canLock && (
                                  <button
                                    onClick={() => handleToggleLock(group.id)}
                                    title={
                                      group.is_locked
                                        ? `Locked by ${group.locked_by_name || 'unknown'} at ${group.locked_at ? new Date(group.locked_at).toLocaleString() : ''}`
                                        : 'Lock group'
                                    }
                                    className={`p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded transition-colors ${
                                      group.is_locked
                                        ? 'text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30'
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    {group.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                  </button>
                                )}

                                {/* Rename */}
                                {!group.is_locked && (
                                  <button
                                    onClick={() => { setEditingGroupId(group.id); setEditingName(group.name); }}
                                    className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Delete */}
                                {canManage && !group.is_locked && (
                                  <button
                                    onClick={() => handleDeleteGroup(group.id)}
                                    className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Per-group print */}
                                <button
                                  onClick={() => {
                                    // Simple per-group print: hide other groups
                                    const el = document.getElementById(`group-print-${group.id}`);
                                    if (el) {
                                      const orig = document.body.innerHTML;
                                      document.body.innerHTML = `
                                        <div style="font-family:sans-serif;padding:20px">
                                          <h2>${group.name} Roster</h2>
                                          <p>${selectedCohort?.program.abbreviation} Group ${selectedCohort?.cohort_number} — Printed ${new Date().toLocaleDateString()}</p>
                                          <hr/>
                                          ${el.innerHTML}
                                        </div>`;
                                      window.print();
                                      window.location.reload();
                                    }
                                  }}
                                  title="Print this group's roster"
                                  className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Locked info */}
                          {group.is_locked && group.locked_by_name && (
                            <div className="mt-1 text-xs text-orange-500 dark:text-orange-400">
                              Locked by {group.locked_by_name}
                              {group.locked_at && ` at ${new Date(group.locked_at).toLocaleString()}`}
                            </div>
                          )}
                        </div>

                        {/* Members list (id for per-group print) */}
                        <div id={`group-print-${group.id}`} className={`p-2 min-h-[140px] ${group.is_locked ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                          {group.members.length === 0 ? (
                            <div className={`h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 border-2 border-dashed dark:border-gray-600 rounded-lg p-4 ${
                              dropTarget === group.id ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/10' : ''
                            }`}>
                              {group.is_locked ? 'Group is locked' : 'Drag students here'}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {group.members.map(student => (
                                <div
                                  key={student.id}
                                  draggable={!group.is_locked}
                                  onDragStart={e => !group.is_locked && handleDragStart(e, student, group.id)}
                                  onDragEnd={handleDragEnd}
                                  className={`flex items-center gap-2 p-2 rounded-lg border dark:border-gray-600 transition-opacity ${
                                    group.is_locked
                                      ? 'bg-gray-50 dark:bg-gray-750 cursor-default'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move'
                                  } ${draggedStudent?.id === student.id ? 'opacity-40' : ''}`}
                                >
                                  {!group.is_locked && (
                                    <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 no-print" />
                                  )}
                                  <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                                    {student.photo_url ? (
                                      <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-medium">
                                        {student.first_name[0]}{student.last_name[0]}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {student.first_name} {student.last_name}
                                    </div>
                                    {student.agency && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.agency}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unassigned sidebar */}
              {unassignedStudents.length > 0 && (
                <div className="w-full lg:w-60 lg:flex-shrink-0 no-print">
                  <div
                    onDragOver={e => handleDragOver(e, 'unassigned')}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDropToUnassigned}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:sticky lg:top-4 transition-all ${
                      dropTarget === 'unassigned' ? 'ring-2 ring-gray-400 dark:ring-gray-500' : ''
                    }`}
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      Unassigned ({unassignedStudents.length})
                    </h3>
                    <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                      {unassignedStudents.map(student => (
                        <div
                          key={student.id}
                          draggable
                          onDragStart={e => handleDragStart(e, student, 'unassigned')}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 p-2 rounded-lg border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move ${
                            draggedStudent?.id === student.id ? 'opacity-40' : ''
                          }`}
                        >
                          <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                            {student.photo_url ? (
                              <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-medium">
                                {student.first_name[0]}{student.last_name[0]}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {student.first_name} {student.last_name}
                            </div>
                            {student.agency && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.agency}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History panel */}
            {selectedCohortId && groups.length > 0 && (
              <div className="mt-6 no-print">
                <button
                  onClick={() => setShowHistory(v => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mb-3"
                >
                  <History className="w-4 h-4" />
                  Group History
                  {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {history.length > 0 && (
                    <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                      {history.length}
                    </span>
                  )}
                </button>

                {showHistory && (
                  <HistoryPanel
                    history={history}
                    groups={groups}
                    cohortId={selectedCohortId}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Auto balance modal */}
      {showAutoBalanceModal && (
        <AutoBalanceModal
          groups={groups.filter(g => !g.is_locked)}
          onConfirm={handleConfirmAutoBalance}
          onCancel={() => setShowAutoBalanceModal(false)}
        />
      )}
    </div>
  );
}

export default function GroupManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <GroupManagementPageInner />
    </Suspense>
  );
}
