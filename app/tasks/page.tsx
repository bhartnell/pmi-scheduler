'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Plus,
  CheckSquare,
  ClipboardList,
  Home,
  MessageSquare,
  ExternalLink,
  Filter,
  X,
  Calendar,
  User,
  ArrowUpDown,
  Users,
  Check,
  LayoutList,
  Kanban,
  Printer,
  Trash2,
  Square,
  Keyboard
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import TaskKanban from '@/components/TaskKanban';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';
import {
  InstructorTask,
  TaskPriority,
  TaskStatus,
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS
} from '@/types/tasks';

interface LabUser {
  id: string;
  name: string;
  email: string;
}

interface TaskAssignee {
  id: string;
  assignee_id: string;
  status: string;
  completed_at: string | null;
  assignee: LabUser;
}

interface ExtendedTask extends InstructorTask {
  completion_mode?: 'single' | 'any' | 'all';
  assignees?: TaskAssignee[];
  user_assignee_status?: string | null;
  user_assignee_id?: string | null;
}

function TasksPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<LabUser | null>(null);
  const [instructors, setInstructors] = useState<LabUser[]>([]);

  // Filter state
  const [activeTab, setActiveTab] = useState<'assigned_to_me' | 'assigned_by_me'>('assigned_to_me');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    assignee_ids: [] as string[],
    completion_mode: 'any' as 'single' | 'any' | 'all',
    due_date: '',
    priority: 'medium' as TaskPriority,
    related_link: ''
  });
  const [creating, setCreating] = useState(false);
  const [isMultiAssign, setIsMultiAssign] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
      fetchInstructors();
    }
  }, [session]);

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
    }
  }, [currentUser, activeTab, statusFilter, priorityFilter, sortBy, sortOrder]);

  // ESC key to close new task modal
  useEffect(() => {
    if (!showNewTaskModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewTaskModal(false);
        setIsMultiAssign(false);
        setFormErrors({});
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showNewTaskModal]);

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
  };

  const fetchInstructors = async () => {
    try {
      const res = await fetch('/api/users/list?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setInstructors(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter: activeTab,
        sortBy,
        sortOrder
      });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
    setLoading(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    // Inline validation
    const newErrors: Record<string, string> = {};
    if (!newTask.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!isMultiAssign && !newTask.assigned_to) {
      newErrors.assigned_to = 'Please select an assignee';
    }
    if (isMultiAssign && newTask.assignee_ids.length === 0) {
      newErrors.assignee_ids = 'Please select at least one assignee';
    }
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    setFormErrors({});

    setCreating(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || undefined,
          ...(isMultiAssign
            ? {
                assignee_ids: newTask.assignee_ids,
                completion_mode: newTask.completion_mode
              }
            : {
                assigned_to: newTask.assigned_to
              }),
          due_date: newTask.due_date || undefined,
          priority: newTask.priority,
          related_link: newTask.related_link || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowNewTaskModal(false);
        setNewTask({
          title: '',
          description: '',
          assigned_to: '',
          assignee_ids: [],
          completion_mode: 'any',
          due_date: '',
          priority: 'medium',
          related_link: ''
        });
        setIsMultiAssign(false);
        setFormErrors({});
        fetchTasks();
        toast.success('Task created');
      } else {
        toast.error(data.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task. Please try again.');
    }
    setCreating(false);
  };

  const handleQuickComplete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
        toast.success('Task marked as completed');
      } else {
        toast.error(data.error || 'Failed to complete task');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
        toast.success('Task updated');
      } else {
        toast.error(data.error || 'Failed to update status');
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  };

  // Clear selection when filters/tab change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, statusFilter, priorityFilter]);

  // Reset focused index when tasks list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [tasks]);

  const toggleSelection = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkComplete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.completed} task(s) marked as completed`);
        clearSelection();
        fetchTasks();
      } else {
        toast.error(data.error || 'Failed to complete tasks');
      }
    } catch {
      toast.error('Failed to complete tasks');
    }
    setBulkLoading(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.deleted} task(s) deleted`);
        clearSelection();
        setShowDeleteConfirm(false);
        fetchTasks();
      } else {
        toast.error(data.error || 'Failed to delete tasks');
      }
    } catch {
      toast.error('Failed to delete tasks');
    }
    setBulkLoading(false);
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
      key: 'n',
      ctrl: true,
      handler: () => setShowNewTaskModal(true),
      description: 'New task',
      category: 'Global',
    },
    {
      key: 'j',
      handler: () => {
        if (viewMode !== 'list' || tasks.length === 0) return;
        setFocusedIndex(prev => Math.min(prev + 1, tasks.length - 1));
      },
      description: 'Move down in list',
      category: 'Navigation',
    },
    {
      key: 'k',
      handler: () => {
        if (viewMode !== 'list' || tasks.length === 0) return;
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      },
      description: 'Move up in list',
      category: 'Navigation',
    },
    {
      key: 'enter',
      handler: () => {
        if (focusedIndex >= 0 && focusedIndex < tasks.length) {
          router.push(`/tasks/${tasks[focusedIndex].id}`);
        }
      },
      description: 'Open focused task',
      category: 'Navigation',
    },
    {
      key: 'c',
      handler: () => {
        if (focusedIndex >= 0 && focusedIndex < tasks.length) {
          const task = tasks[focusedIndex];
          const isAssignedToMe = task.assigned_to === currentUser?.id || task.user_assignee_id;
          const canComplete = isAssignedToMe && (task.status === 'pending' || task.status === 'in_progress') && task.user_assignee_status !== 'completed';
          if (canComplete) {
            handleQuickComplete(task.id);
          }
        }
      },
      description: 'Mark focused task complete',
      category: 'Tasks',
    },
    {
      key: 'x',
      handler: () => {
        if (focusedIndex >= 0 && focusedIndex < tasks.length) {
          toggleSelection(tasks[focusedIndex].id);
        }
      },
      description: 'Toggle selection on focused task',
      category: 'Tasks',
    },
    {
      key: 'escape',
      handler: () => {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else if (selectedIds.size > 0) {
          clearSelection();
        } else {
          setFocusedIndex(-1);
        }
      },
      description: 'Clear selection / close modal',
      category: 'Global',
    },
  ];

  useKeyboardShortcuts(shortcuts, !showNewTaskModal);

  const toggleAssignee = (instructorId: string) => {
    setNewTask(prev => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(instructorId)
        ? prev.assignee_ids.filter(id => id !== instructorId)
        : [...prev.assignee_ids, instructorId]
    }));
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { text: 'Due today', isOverdue: false, isToday: true };
    if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false };
  };

  // Suppress unused searchParams warning - used for potential future query params
  void searchParams;

  if (status === 'loading' || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Task Management</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session?.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">Tasks</span>
          </div>

          {/* Title and New Task button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
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
              <button
                onClick={() => setShowNewTaskModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 print:hidden">
          <button
            onClick={() => setActiveTab('assigned_to_me')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'assigned_to_me'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Assigned to Me
          </button>
          <button
            onClick={() => setActiveTab('assigned_by_me')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'assigned_by_me'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Assigned by Me
          </button>
        </div>

        {/* View Toggle and Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6 print:hidden">
          {/* View mode toggle */}
          <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Kanban className="w-4 h-4" />
              Kanban
            </button>
          </div>

          {/* Filters - only show in list view */}
          {viewMode === 'list' && (
            <>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" aria-hidden="true" />
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <ArrowUpDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
                <select
                  aria-label="Sort tasks"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order as 'asc' | 'desc');
                  }}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="due_date-asc">Due Date (earliest)</option>
                  <option value="due_date-desc">Due Date (latest)</option>
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="priority-desc">Priority (high to low)</option>
                  <option value="priority-asc">Priority (low to high)</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Bulk Action Bar */}
        {viewMode === 'list' && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl print:hidden">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleBulkComplete}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark Complete ({selectedIds.size})
              </button>
              {activeTab === 'assigned_by_me' && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedIds.size})
                </button>
              )}
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Task Display */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <EmptyState
              icon={CheckSquare}
              title="No tasks found"
              message="No tasks match your current filters. Try adjusting your filters or create a new task."
              actionLabel="Create Task"
              onAction={() => setShowNewTaskModal(true)}
            />
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban View */
          <TaskKanban
            tasks={tasks}
            currentUserId={currentUser.id}
            onStatusChange={handleStatusChange}
          />
        ) : (
          /* List View */
          <div className="space-y-3">
            {/* Select All header */}
            <div className="flex items-center gap-3 px-4 py-2 print:hidden">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label={selectedIds.size === tasks.length ? 'Deselect all' : 'Select all'}
              >
                {selectedIds.size === tasks.length && tasks.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>{selectedIds.size === tasks.length && tasks.length > 0 ? 'Deselect All' : 'Select All'}</span>
              </button>
              {selectedIds.size > 0 && selectedIds.size < tasks.length && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({selectedIds.size} of {tasks.length})
                </span>
              )}
            </div>
            {tasks.map((task, index) => {
              const dueInfo = formatDueDate(task.due_date);
              const priorityColor = PRIORITY_COLORS[task.priority];
              const statusColor = STATUS_COLORS[task.status];
              const isAssignedToMe = task.assigned_to === currentUser?.id || task.user_assignee_id;
              const isMultiAssignTask = task.completion_mode && task.completion_mode !== 'single';
              const assigneeCount = task.assignees?.length || 0;
              const completedCount = task.assignees?.filter(a => a.status === 'completed').length || 0;

              // Determine if user can complete this task
              const canComplete = isAssignedToMe &&
                (task.status === 'pending' || task.status === 'in_progress') &&
                (task.user_assignee_status !== 'completed');

              return (
                <div
                  key={task.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow ${
                    index === focusedIndex ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Selection checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(task.id);
                      }}
                      className="flex-shrink-0 mt-1 print:hidden"
                      aria-label={selectedIds.has(task.id) ? 'Deselect task' : 'Select task'}
                    >
                      {selectedIds.has(task.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      )}
                    </button>
                    {/* Priority indicator */}
                    <div className={`w-1 h-full min-h-[60px] rounded-full ${priorityColor.bg}`} />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block truncate"
                          >
                            {task.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {/* Show assignee info based on mode */}
                            {isMultiAssignTask ? (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {task.completion_mode === 'any' ? (
                                  <span>Anyone of {assigneeCount}</span>
                                ) : (
                                  <span>{completedCount}/{assigneeCount} completed</span>
                                )}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {isAssignedToMe
                                  ? `From: ${task.assigner?.name || 'Unknown'}`
                                  : `To: ${task.assignee?.name || 'Unknown'}`}
                              </span>
                            )}
                            {dueInfo && (
                              <span className={`flex items-center gap-1 ${
                                dueInfo.isOverdue ? 'text-red-600 dark:text-red-400 font-medium' :
                                dueInfo.isToday ? 'text-amber-600 dark:text-amber-400 font-medium' : ''
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {dueInfo.text}
                              </span>
                            )}
                            {(task.comment_count || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {task.comment_count}
                              </span>
                            )}
                            {task.related_link && (
                              <a
                                href={task.related_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                                Link
                              </a>
                            )}
                          </div>

                          {/* Show all assignees for multi-assign tasks in "Assigned by Me" tab */}
                          {isMultiAssignTask && activeTab === 'assigned_by_me' && task.assignees && task.assignees.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.assignees.map((a) => (
                                <span
                                  key={a.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                    a.status === 'completed'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {a.status === 'completed' && <Check className="w-3 h-3" />}
                                  {a.assignee?.name || 'Unknown'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Badges and actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isMultiAssignTask && (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              task.completion_mode === 'any'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                            }`}>
                              {task.completion_mode === 'any' ? 'Any' : 'All'}
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColor.bg} ${priorityColor.text}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${statusColor.bg} ${statusColor.text}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                          {canComplete && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleQuickComplete(task.id);
                              }}
                              className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={shortcuts}
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 id="delete-confirm-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Delete {selectedIds.size} Task{selectedIds.size !== 1 ? 's' : ''}?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete the selected task{selectedIds.size !== 1 ? 's' : ''} and all associated comments. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {bulkLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-task-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 id="new-task-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">New Task</h2>
              <button
                onClick={() => {
                  setShowNewTaskModal(false);
                  setIsMultiAssign(false);
                  setFormErrors({});
                }}
                aria-label="Close new task modal"
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="new-task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="new-task-title"
                  type="text"
                  value={newTask.title}
                  onChange={(e) => {
                    setNewTask({ ...newTask, title: e.target.value });
                    if (formErrors.title) setFormErrors(prev => ({ ...prev, title: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.title
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Task title"
                />
                {formErrors.title && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Description with character count */}
              <div>
                <label htmlFor="new-task-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="new-task-description"
                  value={newTask.description}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setNewTask({ ...newTask, description: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Optional description"
                  maxLength={500}
                />
                <div className="flex justify-end text-xs text-gray-400 mt-1">
                  <span className={newTask.description.length >= 450 ? 'text-amber-500' : ''}>
                    {newTask.description.length}/500
                  </span>
                </div>
              </div>

              {/* Multi-assign toggle */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="checkbox"
                  id="multiAssign"
                  checked={isMultiAssign}
                  onChange={(e) => {
                    setIsMultiAssign(e.target.checked);
                    if (!e.target.checked) {
                      setNewTask({ ...newTask, assignee_ids: [], completion_mode: 'any' });
                    } else {
                      setNewTask({ ...newTask, assigned_to: '' });
                    }
                    setFormErrors(prev => ({ ...prev, assigned_to: '', assignee_ids: '' }));
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="multiAssign" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Users className="w-4 h-4" />
                  Assign to multiple people
                </label>
              </div>

              {!isMultiAssign ? (
                /* Single assignee select */
                <div>
                  <label htmlFor="new-task-assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assign to <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="new-task-assignee"
                    value={newTask.assigned_to}
                    onChange={(e) => {
                      setNewTask({ ...newTask, assigned_to: e.target.value });
                      if (formErrors.assigned_to) setFormErrors(prev => ({ ...prev, assigned_to: '' }));
                    }}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      formErrors.assigned_to
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">Select instructor...</option>
                    {instructors.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.name} ({instructor.email})
                      </option>
                    ))}
                  </select>
                  {formErrors.assigned_to && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.assigned_to}</p>
                  )}
                </div>
              ) : (
                /* Multi-assign section */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assign to <span className="text-red-500">*</span>
                      {newTask.assignee_ids.length > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          ({newTask.assignee_ids.length} selected)
                        </span>
                      )}
                    </label>
                    <div className={`max-h-48 overflow-y-auto border rounded-lg ${
                      formErrors.assignee_ids
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {instructors.map((instructor) => (
                        <label
                          key={instructor.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b dark:border-gray-600 last:border-b-0 ${
                            newTask.assignee_ids.includes(instructor.id)
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newTask.assignee_ids.includes(instructor.id)}
                            onChange={() => {
                              toggleAssignee(instructor.id);
                              if (formErrors.assignee_ids) setFormErrors(prev => ({ ...prev, assignee_ids: '' }));
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {instructor.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {instructor.email}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {formErrors.assignee_ids && (
                      <p className="text-sm text-red-500 mt-1">{formErrors.assignee_ids}</p>
                    )}
                  </div>

                  {/* Completion mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Completion Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewTask({ ...newTask, completion_mode: 'any' })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          newTask.completion_mode === 'any'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">Anyone can complete</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Task is done when any assignee marks it complete
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTask({ ...newTask, completion_mode: 'all' })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          newTask.completion_mode === 'all'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">Each must complete</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Task is done when all assignees mark it complete
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-task-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    id="new-task-due-date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="new-task-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    id="new-task-priority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="new-task-related-link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Related Link
                </label>
                <input
                  id="new-task-related-link"
                  type="url"
                  value={newTask.related_link}
                  onChange={(e) => setNewTask({ ...newTask, related_link: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTaskModal(false);
                    setIsMultiAssign(false);
                    setFormErrors({});
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <PageErrorBoundary>
        <TasksPageContent />
      </PageErrorBoundary>
    </Suspense>
  );
}
