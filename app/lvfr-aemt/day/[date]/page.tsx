'use client';

/**
 * LVFR AEMT Day Runsheet
 *
 * The operator-facing replacement for the rigid timed master-calendar
 * blocks. Two session cards (morning / afternoon), each with a
 * checklist of items. Instructors check off as they go; multiple
 * instructors see each others' checkoffs in real time via Supabase
 * Realtime postgres_changes on lvfr_schedule_items.
 *
 * Edit affordances:
 *   - Add ad-hoc item per session
 *   - Toggle complete / un-complete
 *   - Delete item (seeded items can be re-seeded)
 *   - Edit notes per session (debounced)
 *
 * Seeded from pmi_schedule_blocks for the LVFR cohort via the /seed
 * endpoint — runs once on first visit if the runsheet is empty.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sun,
  Moon,
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  StickyNote,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Coffee,
  ExternalLink,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getSupabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────
interface Item {
  id: string;
  title: string;
  item_type: string | null;
  requirement: 'required' | 'optional' | 'info' | null;
  description: string | null;
  time_label: string | null;
  estimated_minutes: number | null;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  notes: string | null;
  source_block_id: string | null;
}

interface DaySession {
  id: string;
  session: 'morning' | 'afternoon';
  notes: string | null;
  brief: string | null;
  debrief: string | null;
  updated_at: string;
  items: Item[];
}

interface DayData {
  date: string;
  sessions: DaySession[];
}

// ── Helpers ──────────────────────────────────────────────────────
function formatDate(yyyyMmDd: string): string {
  try {
    const d = new Date(yyyyMmDd + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return yyyyMmDd;
  }
}

function shiftDate(yyyyMmDd: string, deltaDays: number): string {
  const d = new Date(yyyyMmDd + 'T12:00:00');
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// "0740-0848" → "7:40–8:48". Falls back to the raw label if it doesn't parse.
function formatTimeLabel(label: string | null): string | null {
  if (!label) return null;
  const m = label.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (!m) return label;
  const fmt = (h: string, mm: string) => `${parseInt(h, 10)}:${mm}`;
  return `${fmt(m[1], m[2])}–${fmt(m[3], m[4])}`;
}

// Google Drive content for the active LVFR cohort (Group 2 — July 2026 start).
// The detailed daily lesson plans + PowerPoints live in Drive; the runsheet
// LINKS to them (it does not rebuild them). Per-day folders (Day 1–30) live
// inside the "Daily folder" — instructors click into the day. (Per-day
// deep-links aren't wired yet because the Drive folders are keyed by program
// day number, not calendar date; folder link is the agreed fallback.)
// Update these IDs when the active cohort's Drive folder changes.
const LVFR_DRIVE = {
  dailyFolder: 'https://drive.google.com/drive/folders/1KBbxnsSKXj8bbdVZqiK3WBZ1SJut1o-U',
  lessonPlans: 'https://docs.google.com/document/d/1itZLvtWA76DdNFYpEGlPTz29S-1GVzaL5foFTaxqIG4/edit',
  scheduleCadre: 'https://docs.google.com/document/d/1eaPanP1yi8DK-TdEKRyxNYza69UoQQD9p0KF-NFXY54/edit',
};

const ITEM_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'chapter', label: 'Chapter' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'skills', label: 'Skills' },
  { value: 'lab', label: 'Lab' },
  { value: 'exam', label: 'Exam' },
  { value: 'activity', label: 'Activity' },
  { value: 'break', label: 'Break' },
  { value: 'other', label: 'Other' },
];

// ── Page ─────────────────────────────────────────────────────────
export default function LVFRDayRunsheetPage() {
  const params = useParams<{ date: string }>();
  const dateParam = (params?.date as string) || todayIso();

  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null); // day_schedule_id we're adding to

  // Track which items we just optimistically toggled so the realtime
  // echo of our own write doesn't flicker the UI.
  const optimisticIds = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/lvfr-aemt/runsheet/${dateParam}`, { signal });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setData({ date: json.date, sessions: json.sessions });
      setError(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load runsheet');
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

  useEffect(() => {
    setLoading(true);
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  // ── Realtime subscription ──────────────────────────────────────
  // Subscribe to changes on lvfr_schedule_items + lvfr_day_schedule
  // for THIS date. We refetch on any change because the payload from
  // postgres_changes doesn't include completed_by_name (we hydrate
  // that server-side). A debounced refetch keeps multiple rapid
  // checkoffs cheap.
  useEffect(() => {
    if (!data) return;
    const sessionIds = data.sessions.map(s => s.id).filter(Boolean);
    if (sessionIds.length === 0) return;

    const supabase = getSupabase();
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchData(), 250);
    };

    const channel = supabase
      .channel(`lvfr-runsheet:${dateParam}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lvfr_schedule_items',
          filter: `day_schedule_id=in.(${sessionIds.join(',')})`,
        },
        () => scheduleRefetch(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lvfr_day_schedule',
          filter: `id=in.(${sessionIds.join(',')})`,
        },
        () => scheduleRefetch(),
      )
      .subscribe();

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [data, dateParam, fetchData]);

  // ── Seed (Option C) ────────────────────────────────────────────
  // Auto-trigger seed once on first visit if both sessions are
  // empty AND we haven't tried already. Users can also manually
  // trigger via the "Re-seed from calendar" button.
  const autoSeedTried = useRef(false);
  useEffect(() => {
    if (!data || autoSeedTried.current) return;
    const empty = data.sessions.every(s => s.items.length === 0);
    if (!empty) return;
    autoSeedTried.current = true;
    handleSeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function handleSeed(silent = false) {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch(`/api/lvfr-aemt/runsheet/${dateParam}/seed`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      if (!silent) {
        setSeedResult(`Seeded ${json.inserted} item${json.inserted === 1 ? '' : 's'} from master calendar.`);
      }
      fetchData();
    } catch (err) {
      setSeedResult(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSeeding(false);
    }
  }

  // ── Item mutations ─────────────────────────────────────────────
  async function toggleItem(item: Item) {
    optimisticIds.current.add(item.id);
    // Optimistic UI
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        sessions: d.sessions.map(s => ({
          ...s,
          items: s.items.map(it =>
            it.id === item.id ? { ...it, is_completed: !it.is_completed } : it,
          ),
        })),
      };
    });
    try {
      await fetch(`/api/lvfr-aemt/runsheet/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !item.is_completed }),
      });
    } catch {
      // Revert on error by refetching
      fetchData();
    } finally {
      setTimeout(() => optimisticIds.current.delete(item.id), 500);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this item from the runsheet?')) return;
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        sessions: d.sessions.map(s => ({
          ...s,
          items: s.items.filter(it => it.id !== id),
        })),
      };
    });
    await fetch(`/api/lvfr-aemt/runsheet/items/${id}`, { method: 'DELETE' });
  }

  async function saveNotes(sessionId: string, notes: string) {
    const session = data?.sessions.find(s => s.id === sessionId);
    if (!session) return;
    const sessionKey = session.session;
    await fetch(`/api/lvfr-aemt/runsheet/${dateParam}?session=${sessionKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
  }

  // Brief lives on the morning row, debrief on the afternoon row. Save the
  // single field so it never clobbers notes/the other field, then refresh.
  async function saveSessionField(
    sessionKey: 'morning' | 'afternoon',
    field: 'brief' | 'debrief',
    value: string,
  ) {
    await fetch(`/api/lvfr-aemt/runsheet/${dateParam}?session=${sessionKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value.trim() || null }),
    });
    // Keep local state in sync so the field persists across realtime refetches.
    setData(d => d && {
      ...d,
      sessions: d.sessions.map(s =>
        s.session === sessionKey ? { ...s, [field]: value.trim() || null } : s,
      ),
    });
  }

  // ── Render ─────────────────────────────────────────────────────
  const prevDate = useMemo(() => shiftDate(dateParam, -1), [dateParam]);
  const nextDate = useMemo(() => shiftDate(dateParam, +1), [dateParam]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-red-200 [&_a:hover]:!text-white" />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">LVFR AEMT Runsheet</h1>
                  <p className="text-red-200 text-sm mt-0.5">{formatDate(dateParam)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/lvfr-aemt/day/${prevDate}`}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Link>
              <Link
                href={`/lvfr-aemt/day/${todayIso()}`}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
              >
                Today
              </Link>
              <Link
                href={`/lvfr-aemt/day/${nextDate}`}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {seedResult && (
          <div className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{seedResult}</span>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Action row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Standard day: <strong>7:30 – 11:30 AM</strong> · Lunch · <strong>12:30 – 3:30 PM</strong>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={LVFR_DRIVE.dailyFolder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  title="Open the Google Drive Daily folder — per-day lesson plans & PowerPoints (Day 1–30)"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Lesson plans &amp; slides
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <a
                  href={LVFR_DRIVE.lessonPlans}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                  title="LVFR AEMT Daily Lesson Plans (Google Doc)"
                >
                  Lesson plan doc
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
                <button
                  type="button"
                  onClick={() => handleSeed(false)}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                  title="Re-pull items from the master schedule for this date"
                >
                  {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Re-seed from calendar
                </button>
              </div>
            </div>

            {(() => {
              const morning = data.sessions.find(s => s.session === 'morning');
              const afternoon = data.sessions.find(s => s.session === 'afternoon');
              const card = (s: DaySession) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isAdding={addingTo === s.id}
                  onAdd={() => setAddingTo(s.id)}
                  onCancelAdd={() => setAddingTo(null)}
                  onAddSaved={() => {
                    setAddingTo(null);
                    fetchData();
                  }}
                  onToggle={toggleItem}
                  onDelete={deleteItem}
                  onNotesBlur={(notes) => saveNotes(s.id, notes)}
                />
              );
              return (
                <>
                  {/* Day brief — editable, above the morning block. Lives on the
                      morning session row. */}
                  {morning && (
                    <DayTextField
                      label="Today's brief"
                      sublabel="Short synopsis of what today covers"
                      value={morning.brief}
                      placeholder="What are we covering today? (1–2 lines for the team)"
                      accent="brief"
                      icon={Sparkles}
                      onSave={(v) => saveSessionField('morning', 'brief', v)}
                    />
                  )}

                  {/* Morning first — fixes the PM-above-AM ordering bug */}
                  {morning && card(morning)}

                  {/* Lunch banner between sessions */}
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-center justify-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                    <Coffee className="w-4 h-4" />
                    <span><strong>Lunch</strong> · 11:30 AM – 12:30 PM</span>
                  </div>

                  {afternoon && card(afternoon)}

                  {/* Day debrief — editable, below the afternoon block. Lives on
                      the afternoon session row. The "keep each other apprised" piece. */}
                  {afternoon && (
                    <DayTextField
                      label="Debrief"
                      sublabel="How the day went — anything the next instructor/day should know"
                      value={afternoon.debrief}
                      placeholder="How did today go? What carried over, what to watch tomorrow?"
                      accent="debrief"
                      icon={Moon}
                      onSave={(v) => saveSessionField('afternoon', 'debrief', v)}
                    />
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

// ── DayTextField (brief / debrief) ───────────────────────────────
// Editable day-level synopsis. Controlled local state, saves on blur only
// when changed (mirrors the per-session Notes pattern).
function DayTextField({
  label,
  sublabel,
  value,
  placeholder,
  accent,
  icon: Icon,
  onSave,
}: {
  label: string;
  sublabel: string;
  value: string | null;
  placeholder: string;
  accent: 'brief' | 'debrief';
  icon: LucideIcon;
  onSave: (value: string) => void;
}) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);

  const styles = accent === 'brief'
    ? { box: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20', text: 'text-red-900 dark:text-red-200' }
    : { box: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-900 dark:text-indigo-200' };

  return (
    <div className={`rounded-lg border ${styles.box} px-4 py-3`}>
      <div className={`flex items-baseline justify-between gap-2 mb-1.5 ${styles.text}`}>
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span className="text-xs opacity-70">{sublabel}</span>
      </div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((value ?? '') !== v) onSave(v); }}
        rows={2}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
      />
    </div>
  );
}

// ── SessionCard ─────────────────────────────────────────────────
function SessionCard({
  session,
  isAdding,
  onAdd,
  onCancelAdd,
  onAddSaved,
  onToggle,
  onDelete,
  onNotesBlur,
}: {
  session: DaySession;
  isAdding: boolean;
  onAdd: () => void;
  onCancelAdd: () => void;
  onAddSaved: () => void;
  onToggle: (item: Item) => void;
  onDelete: (id: string) => void;
  onNotesBlur: (notes: string) => void;
}) {
  const isMorning = session.session === 'morning';
  const Icon = isMorning ? Sun : Moon;
  const label = isMorning ? 'Morning Session' : 'Afternoon Session';
  const time = isMorning ? '7:30 AM – 11:30 AM' : '12:30 PM – 3:30 PM';
  const accent = isMorning
    ? 'from-amber-500 to-orange-500'
    : 'from-indigo-500 to-purple-600';

  // "Day complete" depends only on required items — optional checkoffs and
  // info lines (breaks/lunch/roll call) are excluded from the progress meter.
  const requiredItems = session.items.filter(i => i.requirement === 'required');
  const completed = requiredItems.filter(i => i.is_completed).length;
  const total = requiredItems.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [notes, setNotes] = useState(session.notes ?? '');
  useEffect(() => {
    setNotes(session.notes ?? '');
  }, [session.notes]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${accent} text-white px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <div>
            <h2 className="font-semibold text-base leading-tight">{label}</h2>
            <p className="text-xs opacity-90">{time}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{completed}/{total} required</div>
          <div className="text-xs opacity-80">{total > 0 ? `${pct}% done` : 'no required items'}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div className="h-1 bg-green-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {session.items.length === 0 && !isAdding && (
          <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            No items yet. Add one below or re-seed from the master calendar.
          </p>
        )}
        {session.items.map(item => (
          <ItemRow key={item.id} item={item} onToggle={() => onToggle(item)} onDelete={() => onDelete(item.id)} />
        ))}
        {isAdding && (
          <AddItemRow
            dayScheduleId={session.id}
            onCancel={onCancelAdd}
            onSaved={onAddSaved}
          />
        )}
      </div>

      {/* Footer: add + notes */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        {!isAdding ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add item
          </button>
        ) : (
          <span className="text-xs text-gray-400">Adding…</span>
        )}
      </div>

      {/* Notes */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
          <StickyNote className="w-3.5 h-3.5" />
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onNotesBlur(notes)}
          rows={2}
          placeholder={`Anything the ${isMorning ? 'morning' : 'afternoon'} instructor should know`}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );
}

// ── ItemRow ──────────────────────────────────────────────────────
function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: Item;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isInfo = item.requirement === 'info';
  const isOptional = item.requirement === 'optional';
  const time = formatTimeLabel(item.time_label);

  // ── INFO line: no checkbox (breaks, lunch, roll call, transitions) ──
  if (isInfo) {
    return (
      <div className="px-5 py-2 flex items-center gap-3 group bg-gray-50/50 dark:bg-gray-900/20">
        <span className="flex-shrink-0 w-5 flex justify-center text-gray-300 dark:text-gray-600" aria-hidden>
          <Coffee className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-sm text-gray-500 dark:text-gray-400">
          {time && <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{time}</span>}
          <span>{item.title}</span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
          aria-label="Delete item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── REQUIRED / OPTIONAL: checkbox line ──
  const checkedColor = item.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500';
  return (
    <div className="px-5 py-3 flex items-start gap-3 group">
      <button
        type="button"
        onClick={onToggle}
        className={`flex-shrink-0 mt-0.5 ${checkedColor} hover:scale-110 transition-transform`}
        aria-label={item.is_completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {item.is_completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {time && (
            <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{time}</span>
          )}
          <span className={`text-sm font-medium ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {item.title}
          </span>
          {isOptional && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              optional
            </span>
          )}
          {item.item_type && item.item_type !== 'other' && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {item.item_type}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{item.description}</p>
        )}
        {item.is_completed && item.completed_by_name && (
          <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
            ✓ Checked off by {item.completed_by_name}
            {item.completed_at && (
              <span className="text-gray-400 ml-1">
                · {new Date(item.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </p>
        )}
        {item.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{item.notes}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
        aria-label="Delete item"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── AddItemRow ───────────────────────────────────────────────────
function AddItemRow({
  dayScheduleId,
  onCancel,
  onSaved,
}: {
  dayScheduleId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [itemType, setItemType] = useState('other');
  const [minutes, setMinutes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setErr('Title is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/lvfr-aemt/runsheet/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_schedule_id: dayScheduleId,
          title: title.trim(),
          item_type: itemType,
          estimated_minutes: minutes ? parseInt(minutes, 10) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-0.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="e.g. Skills Practice — 12-Lead"
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-0.5">Type</label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {ITEM_TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-0.5">~min</label>
          <input
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="30"
            className="w-20 px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err}</p>}
    </div>
  );
}
