'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Calendar,
  User,
  Users,
  MessageSquare,
  ExternalLink,
  Check,
  GripVertical
} from 'lucide-react';
import {
  TaskPriority,
  PRIORITY_COLORS,
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

interface KanbanTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: TaskPriority;
  due_date: string | null;
  completion_mode?: 'single' | 'any' | 'all';
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigner?: LabUser | null;
  assignee?: LabUser | null;
  assignees?: TaskAssignee[];
  comment_count?: number;
  related_link?: string | null;
  user_assignee_id?: string | null;
}

interface TaskKanbanProps {
  tasks: KanbanTask[];
  currentUserId: string;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  showCancelled?: boolean;
}

const COLUMNS = [
  { id: 'pending', label: 'To Do', color: 'border-gray-400' },
  { id: 'in_progress', label: 'In Progress', color: 'border-blue-400' },
  { id: 'completed', label: 'Done', color: 'border-green-400' },
  { id: 'cancelled', label: 'Cancelled', color: 'border-red-400' }
];

export default function TaskKanban({
  tasks,
  currentUserId,
  onStatusChange,
  showCancelled = false
}: TaskKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  const columns = showCancelled ? COLUMNS : COLUMNS.filter(c => c.id !== 'cancelled');

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { text: 'Today', isOverdue: false, isToday: true };
    if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false };
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false };
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    // Add drag image styling
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggingId(null);
    setDropTarget(null);
    dragCounter.current = {};
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) + 1;
    setDropTarget(columnId);
  };

  const handleDragLeave = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) - 1;
    if (dragCounter.current[columnId] <= 0) {
      if (dropTarget === columnId) {
        setDropTarget(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    dragCounter.current = {};

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === columnId) return;

    // Validate permission - only assignees can complete, only assigner can cancel
    const isAssignee = task.assigned_to === currentUserId || task.user_assignee_id;
    const isAssigner = task.assigned_by === currentUserId;

    if (columnId === 'completed' && !isAssignee) {
      alert('Only assignees can mark a task as completed');
      return;
    }

    if (columnId === 'cancelled' && !isAssigner) {
      alert('Only the task creator can cancel a task');
      return;
    }

    setUpdating(taskId);
    try {
      await onStatusChange(taskId, columnId);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
    setUpdating(null);
  };

  const getTasksForColumn = (columnId: string) => {
    return tasks.filter(t => t.status === columnId);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTasks = getTasksForColumn(column.id);
        const isDropping = dropTarget === column.id && draggingId;

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 bg-gray-100 dark:bg-gray-800/50 rounded-xl p-3 transition-all ${
              isDropping ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
            onDragEnter={(e) => handleDragEnter(e, column.id)}
            onDragLeave={(e) => handleDragLeave(e, column.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${column.color}`}>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {column.label}
              </h3>
              <span className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300">
                {columnTasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="space-y-2 min-h-[200px]">
              {columnTasks.map((task) => {
                const dueInfo = formatDueDate(task.due_date);
                const priorityColor = PRIORITY_COLORS[task.priority];
                const isMultiAssign = task.completion_mode && task.completion_mode !== 'single';
                const isAssignedToMe = task.assigned_to === currentUserId || task.user_assignee_id;
                const isDragging = draggingId === task.id;
                const isUpdating = updating === task.id;

                return (
                  <div
                    key={task.id}
                    draggable={!isUpdating}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing border-l-4 ${priorityColor.border || 'border-gray-300'} transition-all ${
                      isDragging ? 'opacity-50 scale-95' : ''
                    } ${isUpdating ? 'opacity-60 pointer-events-none' : ''} hover:shadow-md`}
                  >
                    {/* Drag handle */}
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.title}
                        </Link>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {/* Priority badge */}
                          <span className={`px-1.5 py-0.5 rounded ${priorityColor.bg} ${priorityColor.text}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>

                          {/* Due date */}
                          {dueInfo && (
                            <span className={`flex items-center gap-1 ${
                              dueInfo.isOverdue ? 'text-red-600 dark:text-red-400 font-medium' :
                              dueInfo.isToday ? 'text-amber-600 dark:text-amber-400' : ''
                            }`}>
                              <Calendar className="w-3 h-3" />
                              {dueInfo.text}
                            </span>
                          )}

                          {/* Comments */}
                          {(task.comment_count || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {task.comment_count}
                            </span>
                          )}

                          {/* Link */}
                          {task.related_link && (
                            <a
                              href={task.related_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Assignee info */}
                        <div className="mt-2 text-xs">
                          {isMultiAssign ? (
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <Users className="w-3 h-3" />
                              {task.completion_mode === 'any' ? (
                                <span>Anyone of {task.assignees?.length || 0}</span>
                              ) : (
                                <span>
                                  {task.assignees?.filter(a => a.status === 'completed').length || 0}/
                                  {task.assignees?.length || 0}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <User className="w-3 h-3" />
                              {isAssignedToMe
                                ? task.assigner?.name || 'Unknown'
                                : task.assignee?.name || 'Unknown'}
                            </div>
                          )}
                        </div>

                        {/* Multi-assign avatar row */}
                        {isMultiAssign && task.assignees && task.assignees.length > 0 && (
                          <div className="flex -space-x-1 mt-2">
                            {task.assignees.slice(0, 5).map((a) => (
                              <div
                                key={a.id}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-white dark:border-gray-800 ${
                                  a.status === 'completed'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                }`}
                                title={`${a.assignee?.name || 'Unknown'} - ${a.status}`}
                              >
                                {a.status === 'completed' ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  (a.assignee?.name || '?')[0].toUpperCase()
                                )}
                              </div>
                            ))}
                            {task.assignees.length > 5 && (
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium border-2 border-white dark:border-gray-800">
                                +{task.assignees.length - 5}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Loading indicator */}
                        {isUpdating && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                            <div className="animate-spin w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
                            Updating...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  {isDropping ? 'Drop here' : 'No tasks'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
