'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, ChevronDown, ChevronUp, Edit2, Trash2, Send, ArrowUpDown } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';

interface DebriefNote {
  id: string;
  lab_day_id: string;
  author_id: string | null;
  author_name: string | null;
  category: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

interface DebriefNotesSectionProps {
  labDayId: string;
  session: any;
  userRole: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'timing', label: 'Timing', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'station_feedback', label: 'Station Feedback', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'student_performance', label: 'Student Performance', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'equipment', label: 'Equipment', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'improvement', label: 'Improvement Idea', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'positive', label: 'What Went Well', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
];

function getCategoryStyle(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.color || CATEGORIES[0].color;
}

function getCategoryLabel(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.label || 'General';
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DebriefNotesSection({ labDayId, session, userRole }: DebriefNotesSectionProps) {
  const [notes, setNotes] = useState<DebriefNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [newCategory, setNewCategory] = useState('general');
  const [newContent, setNewContent] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('general');
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/instructor/me');
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUserId(data.user.id);
        }
      } catch {
        // noop
      }
    };
    fetchUser();
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief-notes`);
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes || []);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [labDayId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const sortedNotes = [...notes].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortNewest ? -diff : diff;
  });

  const handleSubmit = async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, category: newCategory }),
      });
      const data = await res.json();
      if (data.success && data.note) {
        setNotes(prev => [...prev, data.note]);
        setNewContent('');
        setNewCategory('general');
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error adding debrief note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (noteId: string) => {
    if (!editContent.trim()) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief-notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, category: editCategory }),
      });
      const data = await res.json();
      if (data.success && data.note) {
        setNotes(prev => prev.map(n => n.id === noteId ? data.note : n));
        setEditingId(null);
      }
    } catch (err) {
      console.error('Error editing debrief note:', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief-notes/${noteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (err) {
      console.error('Error deleting debrief note:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (note: DebriefNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditCategory(note.category);
  };

  const isOwner = (note: DebriefNote) => currentUserId && note.author_id === currentUserId;
  const canDelete = (note: DebriefNote) => isOwner(note) || hasMinRole(userRole, 'admin');

  return (
    <div id="debrief-notes" className="mt-6 print:hidden">
      <div
        className="flex items-center justify-between cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Debrief Notes</h2>
          {notes.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              {notes.length}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {!collapsed && (
        <div className="mt-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Note
            </button>
            {notes.length > 1 && (
              <button
                onClick={() => setSortNewest(!sortNewest)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortNewest ? 'Newest first' : 'Oldest first'}
              </button>
            )}
          </div>

          {showForm && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Share your observations, feedback, or notes about this lab day..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-y"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!newContent.trim() || submitting}
                  className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Posting...' : 'Post Note'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewContent(''); setNewCategory('general'); }}
                  className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">Loading notes...</div>
          ) : sortedNotes.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No debrief notes yet. Be the first to add one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedNotes.map(note => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  {editingId === note.id ? (
                    <div>
                      <div className="mb-2">
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-full sm:w-auto px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y mb-2"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(note.id)}
                          disabled={!editContent.trim() || editSubmitting}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
                        >
                          {editSubmitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {getInitials(note.author_name)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.author_name || 'Unknown'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryStyle(note.category)}`}>
                          {getCategoryLabel(note.category)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                          {timeAgo(note.created_at)}
                          {note.updated_at && ' (edited)'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-9">
                        {note.content}
                      </p>
                      {(isOwner(note) || canDelete(note)) && (
                        <div className="flex items-center gap-2 mt-2 pl-9">
                          {isOwner(note) && (
                            <button
                              onClick={() => startEditing(note)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                          )}
                          {canDelete(note) && (
                            <button
                              onClick={() => handleDelete(note.id)}
                              disabled={deletingId === note.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" />
                              {deletingId === note.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
