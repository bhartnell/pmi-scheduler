'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Check,
  RotateCcw,
  Edit3,
  Send,
  MessageSquare,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface DiffChange {
  field: string;
  template_value: unknown;
  lab_value: unknown;
}

interface DiffEntry {
  station_number: number;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
  template_station: Record<string, unknown> | null;
  lab_station: Record<string, unknown> | null;
  changes: DiffChange[];
}

interface Comment {
  id: string;
  review_item_id: string;
  author_email: string;
  comment: string;
  created_at: string;
}

interface ReviewItem {
  id: string;
  review_id: string;
  lab_day_id: string;
  template_id: string | null;
  disposition: string;
  revised_data: Record<string, unknown>[] | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  lab_day: {
    id: string;
    date: string;
    title: string;
    week_number: number | null;
    day_number: number | null;
  };
}

interface StationEdit {
  station_number: number;
  station_type: string;
  scenario_name: string;
  skill_name: string;
  rotation_minutes: number;
  room: string;
  notes: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario' },
  { value: 'skill', label: 'Skill' },
  { value: 'skill_drill', label: 'Skill Drill' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'testing', label: 'Testing' },
  { value: 'other', label: 'Other' },
];

function diffBorderColor(status: string) {
  switch (status) {
    case 'unchanged': return 'border-l-green-400 dark:border-l-green-600';
    case 'modified': return 'border-l-amber-400 dark:border-l-amber-500';
    case 'added': return 'border-l-blue-400 dark:border-l-blue-500';
    case 'removed': return 'border-l-red-400 dark:border-l-red-500';
    default: return 'border-l-gray-400';
  }
}

function diffStatusLabel(status: string) {
  switch (status) {
    case 'unchanged': return 'Unchanged';
    case 'modified': return 'Modified';
    case 'added': return 'Added in Lab';
    case 'removed': return 'Removed from Lab';
    default: return status;
  }
}

function diffStatusColor(status: string) {
  switch (status) {
    case 'unchanged': return 'text-green-700 dark:text-green-400';
    case 'modified': return 'text-amber-700 dark:text-amber-400';
    case 'added': return 'text-blue-700 dark:text-blue-400';
    case 'removed': return 'text-red-700 dark:text-red-400';
    default: return 'text-gray-700 dark:text-gray-400';
  }
}

function getStationName(station: Record<string, unknown> | null): string {
  if (!station) return '(empty)';
  const scenario = station.scenario as Record<string, unknown> | null;
  if (scenario?.title) return scenario.title as string;
  if (station.scenario_title) return station.scenario_title as string;
  if (station.skill_name) return station.skill_name as string;
  if (station.custom_title) return station.custom_title as string;
  if (station.station_name) return station.station_name as string;
  return '(unnamed)';
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '(empty)';
  return String(val);
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'station_type': return 'Type';
    case 'rotation_minutes': return 'Rotation (min)';
    case 'room': return 'Room';
    case 'notes': return 'Notes';
    case 'scenario/skill': return 'Scenario / Skill';
    default: return field;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function ReviewItemPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id as string;
  const itemId = params.itemId as string;

  const [item, setItem] = useState<ReviewItem | null>(null);
  const [diff, setDiff] = useState<DiffEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviewTitle, setReviewTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // Disposition form
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline editor
  const [showEditor, setShowEditor] = useState(false);
  const [editStations, setEditStations] = useState<StationEdit[]>([]);

  // Comment
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchItem = useCallback(async () => {
    setLoading(true);
    try {
      const [itemRes, reviewRes] = await Promise.all([
        fetch(`/api/lab-management/template-reviews/${reviewId}/items/${itemId}`),
        fetch(`/api/lab-management/template-reviews/${reviewId}`),
      ]);
      const [itemData, reviewData] = await Promise.all([itemRes.json(), reviewRes.json()]);

      if (itemData.success) {
        setItem(itemData.item);
        setDiff(itemData.diff || []);
        setComments(itemData.comments || []);
        setReviewerNotes(itemData.item.reviewer_notes || '');

        // Init edit stations from lab_stations
        const labStations = (itemData.labStations || []) as Record<string, unknown>[];
        setEditStations(labStations.map((s) => {
          const scenario = s.scenario as Record<string, unknown> | null;
          return {
            station_number: (s.station_number as number) || 0,
            station_type: (s.station_type as string) || 'scenario',
            scenario_name: (scenario?.title as string) || '',
            skill_name: (s.skill_name as string) || (s.custom_title as string) || '',
            rotation_minutes: (s.rotation_minutes as number) || 20,
            room: (s.room as string) || '',
            notes: (s.station_notes as string) || (s.notes as string) || '',
          };
        }));
      }
      if (reviewData.success) {
        setReviewTitle(reviewData.review.title);
      }
    } catch (err) {
      console.error('Error loading item:', err);
    } finally {
      setLoading(false);
    }
  }, [reviewId, itemId]);

  useEffect(() => {
    if (session && reviewId && itemId) {
      fetchItem();
    }
  }, [session, reviewId, itemId, fetchItem]);

  const handleSetDisposition = async (disposition: string) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        disposition,
        reviewer_notes: reviewerNotes || null,
      };

      const res = await fetch(`/api/lab-management/template-reviews/${reviewId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to update', 'error');
        return;
      }
      showToast(`Disposition set to: ${disposition.replace('_', ' ')}`);
      setItem(prev => prev ? { ...prev, disposition, reviewer_notes: reviewerNotes } : prev);
    } catch {
      showToast('Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRevision = async () => {
    setSaving(true);
    try {
      const revisedData = editStations.map(s => ({
        station_number: s.station_number,
        sort_order: s.station_number,
        station_type: s.station_type,
        station_name: s.scenario_name || s.skill_name || null,
        skill_name: s.skill_name || null,
        rotation_minutes: s.rotation_minutes,
        room: s.room || null,
        notes: s.notes || null,
      }));

      const res = await fetch(`/api/lab-management/template-reviews/${reviewId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition: 'revised',
          reviewer_notes: reviewerNotes || null,
          revised_data: revisedData,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to save revision', 'error');
        return;
      }
      showToast('Revision saved');
      setShowEditor(false);
      setItem(prev => prev ? { ...prev, disposition: 'revised', reviewer_notes: reviewerNotes, revised_data: revisedData } : prev);
    } catch {
      showToast('Failed to save revision', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/lab-management/template-reviews/${reviewId}/items/${itemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to post comment', 'error');
        return;
      }
      setComments(prev => [...prev, data.comment]);
      setNewComment('');
      showToast('Comment posted');
    } catch {
      showToast('Failed to post comment', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const updateEditStation = (idx: number, field: keyof StationEdit, value: string | number) => {
    setEditStations(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session || !item) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 flex-wrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/templates/review" className="hover:text-blue-600 dark:hover:text-blue-400">Semester Review</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/templates/review/${reviewId}`} className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[150px]">
              {reviewTitle}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300 truncate max-w-[200px]">{item.lab_day?.title || 'Item'}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            {item.lab_day?.title || 'Review Item'}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {item.lab_day?.date && (
              <span>{new Date(item.lab_day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            )}
            {item.lab_day?.week_number != null && (
              <span>Week {item.lab_day.week_number}, Day {item.lab_day.day_number}</span>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Diff comparison */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Station Comparison</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {item.template_id ? 'Comparing template configuration vs actual lab day' : 'No source template linked - showing lab day stations only'}
            </p>
          </div>

          {diff.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p>No stations to compare.</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {diff.map((entry) => (
                <div
                  key={entry.station_number}
                  className={`p-4 border-l-4 ${diffBorderColor(entry.status)}`}
                >
                  {/* Station header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                        {entry.station_number}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {getStationName(entry.lab_station || entry.template_station)}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${diffStatusColor(entry.status)}`}>
                      {diffStatusLabel(entry.status)}
                    </span>
                  </div>

                  {/* Side-by-side for modified/unchanged */}
                  {(entry.status === 'modified' || entry.status === 'unchanged') && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Template</p>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          <p>Type: {(entry.template_station?.station_type as string) || '(none)'}</p>
                          <p>Name: {getStationName(entry.template_station)}</p>
                          <p>Rotation: {displayValue(entry.template_station?.rotation_minutes)} min</p>
                          <p>Room: {displayValue(entry.template_station?.room)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Actual Lab Day</p>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          <p>Type: {(entry.lab_station?.station_type as string) || '(none)'}</p>
                          <p>Name: {getStationName(entry.lab_station)}</p>
                          <p>Rotation: {displayValue(entry.lab_station?.rotation_minutes)} min</p>
                          <p>Room: {displayValue(entry.lab_station?.room)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Field-level diffs for modified */}
                  {entry.status === 'modified' && entry.changes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {entry.changes.map((change) => (
                        <div key={change.field} className="bg-gray-50 dark:bg-gray-700/30 rounded px-3 py-2">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            {fieldLabel(change.field)}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 line-through">
                              {displayValue(change.template_value)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              {displayValue(change.lab_value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Added station info */}
                  {entry.status === 'added' && entry.lab_station && (
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      This station exists in the lab day but not in the template.
                    </p>
                  )}

                  {/* Removed station info */}
                  {entry.status === 'removed' && entry.template_station && (
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      This station is in the template but missing from the lab day.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviewer notes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reviewer Notes (optional)
          </label>
          <textarea
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Add notes about your decision..."
            rows={2}
            className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          />
        </div>

        {/* Action buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Set Disposition
            {item.disposition !== 'pending' && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                (Current: {item.disposition.replace('_', ' ')})
              </span>
            )}
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleSetDisposition('accept_changes')}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                item.disposition === 'accept_changes'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
              } disabled:opacity-50`}
            >
              <Check className="w-4 h-4" />
              Accept Changes
            </button>
            <button
              onClick={() => handleSetDisposition('keep_original')}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                item.disposition === 'keep_original'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
              } disabled:opacity-50`}
            >
              <RotateCcw className="w-4 h-4" />
              Keep Original
            </button>
            <button
              onClick={() => setShowEditor(!showEditor)}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                item.disposition === 'revised'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
              } disabled:opacity-50`}
            >
              <Edit3 className="w-4 h-4" />
              Revise
            </button>
          </div>
        </div>

        {/* Inline editor */}
        {showEditor && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-2 border-amber-300 dark:border-amber-700">
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">
              Edit Stations (Revision)
            </h3>
            <div className="space-y-4">
              {editStations.map((station, idx) => (
                <div key={station.station_number} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300">
                      {station.station_number}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Station {station.station_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Type</label>
                      <select
                        value={station.station_type}
                        onChange={(e) => updateEditStation(idx, 'station_type', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {STATION_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        {station.station_type === 'scenario' ? 'Scenario Name' : 'Skill Name'}
                      </label>
                      <input
                        type="text"
                        value={station.station_type === 'scenario' ? station.scenario_name : station.skill_name}
                        onChange={(e) => updateEditStation(idx, station.station_type === 'scenario' ? 'scenario_name' : 'skill_name', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Rotation (min)</label>
                      <input
                        type="number"
                        value={station.rotation_minutes}
                        onChange={(e) => updateEditStation(idx, 'rotation_minutes', parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Room</label>
                      <input
                        type="text"
                        value={station.room}
                        onChange={(e) => updateEditStation(idx, 'room', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Notes</label>
                      <input
                        type="text"
                        value={station.notes}
                        onChange={(e) => updateEditStation(idx, 'notes', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRevision}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Revision
              </button>
            </div>
          </div>
        )}

        {/* Comments section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Comments ({comments.length})
            </h3>
          </div>

          {comments.length > 0 && (
            <div className="divide-y dark:divide-gray-700">
              {comments.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {c.author_email.split('@')[0]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{c.comment}</p>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 border-t dark:border-gray-700">
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
              <button
                onClick={handlePostComment}
                disabled={postingComment || !newComment.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors self-end"
              >
                {postingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}
