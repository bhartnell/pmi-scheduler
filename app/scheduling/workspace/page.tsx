'use client';

/**
 * Planning Workspace (calendar master sequence — Stage 4b).
 *
 * A draft-then-publish drag-to-arrange surface over pmi_schedule_blocks,
 * generalizing the LVFR planner's drag + time-cascade model to the main
 * calendar. You pick a cohort + week, rearrange blocks within a day (drag to
 * reorder → times re-cascade keeping each block's length), then PUBLISH — drafts
 * don't affect the live calendar until published (status: draft → published).
 *
 * Safe/additive: edits ride the existing pmi_schedule_blocks status field; no
 * new store, independent of the held lab_days constraint work.
 *
 * Build increments:
 *   1 (this file): route + selectors + read-only day-column render.   ← current
 *   2: drag-to-reorder within/between days + time cascade + save.
 *   3: publish-drafts action + per-block instructor assignment + nav entry.
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, ArrowLeft, Calendar as CalendarIcon, Upload, User, AlertTriangle } from 'lucide-react';

// ── Light local types (subset of the planner shapes we use) ──
interface WsBlock {
  id: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  block_type: string | null;
  title: string | null;
  course_name: string | null;
  color: string | null;
  status: string | null;
  sort_order: number | null;
  program_schedule_id: string | null;
  room_id?: string | null;
  room?: { id: string; name: string } | null;
  instructors?: { instructor?: { id: string; name: string } | null }[];
}
interface WsSemester { id: string; name: string; start_date: string; end_date: string }
interface WsProgram {
  id: string;
  label?: string | null;
  cohort?: { id: string; cohort_number: number; program?: { abbreviation?: string; name?: string } } | null;
}

// ── Helpers ──
function getMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'p' : 'a';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}${ap}`;
}
function toMin(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minToTime(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function durationMin(b: WsBlock): number {
  const d = toMin(b.end_time) - toMin(b.start_time);
  return d > 0 ? d : 30; // default 30 if missing/invalid
}
/**
 * Tetris cascade: re-lay a day's blocks in array order from the day's anchor
 * (its earliest existing start, else 08:00), each block starting where the
 * previous ended, preserving each block's length. Returns blocks with corrected
 * start/end/sort_order. Removing gaps is the intended drag-to-arrange behavior;
 * keep an explicit Break/Lunch block to hold a gap.
 */
function cascadeDay(dayBlocks: WsBlock[]): WsBlock[] {
  if (dayBlocks.length === 0) return [];
  const anchor = Math.min(...dayBlocks.map(b => toMin(b.start_time)).filter(n => n > 0).concat([8 * 60]));
  let cur = anchor;
  return dayBlocks.map((b, i) => {
    const dur = durationMin(b);
    const start = cur, end = cur + dur;
    cur = end;
    return { ...b, start_time: minToTime(start), end_time: minToTime(end), sort_order: i };
  });
}

function programLabel(p: WsProgram | undefined): string {
  if (!p) return '';
  if (p.label) return p.label;
  const c = p.cohort;
  const abbr = c?.program?.abbreviation || c?.program?.name || '';
  return `${abbr} C${c?.cohort_number ?? '?'}`.trim();
}
const TYPE_COLORS: Record<string, string> = {
  lab: '#8B5CF6', exam: '#EF4444', lecture: '#3B82F6', class: '#3B82F6',
  admin: '#6B7280', meeting: '#6B7280', clinical: '#0EA5E9', other: '#6B7280',
};

export default function PlanningWorkspacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [semesters, setSemesters] = useState<WsSemester[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [programs, setPrograms] = useState<WsProgram[]>([]);
  const [programId, setProgramId] = useState('');
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [blocks, setBlocks] = useState<WsBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [instructorsList, setInstructorsList] = useState<{ id: string; name: string }[]>([]);
  const [editingInstrId, setEditingInstrId] = useState<string | null>(null); // block id whose instructor picker is open

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Load semesters; default to the one covering today (else most recent).
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/scheduling/planner/semesters?active_only=false')
      .then(r => r.json())
      .then(d => {
        const list: WsSemester[] = d.semesters || [];
        setSemesters(list);
        const today = toDateStr(new Date());
        const cur = list.find(s => s.start_date <= today && s.end_date >= today);
        setSemesterId(cur?.id || list[0]?.id || '');
      })
      .catch(() => {});
  }, [status]);

  // Load programs (cohorts) for the semester.
  useEffect(() => {
    if (!semesterId) return;
    fetch(`/api/scheduling/planner/programs?semester_id=${semesterId}`)
      .then(r => r.json())
      .then(d => {
        const list: WsProgram[] = d.programs || [];
        setPrograms(list);
        setProgramId(prev => (prev && list.some(p => p.id === prev) ? prev : list[0]?.id || ''));
      })
      .catch(() => {});
  }, [semesterId]);

  // Load instructor list once (for per-block assignment).
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/scheduling/planner/instructors')
      .then(r => r.json())
      .then(d => setInstructorsList(d.instructors || []))
      .catch(() => {});
  }, [status]);

  // Load blocks for the semester + week.
  const loadBlocks = useCallback(async () => {
    if (!semesterId) return;
    setLoading(true);
    try {
      const from = toDateStr(weekStart);
      const to = toDateStr(addDays(weekStart, 6));
      const res = await fetch(`/api/scheduling/planner/blocks?semester_id=${semesterId}&date_from=${from}&date_to=${to}`);
      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [semesterId, weekStart]);

  useEffect(() => { if (status === 'authenticated') loadBlocks(); }, [loadBlocks, status]);

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Mon–Sat

  // Blocks for the selected cohort, grouped by date and ordered.
  const blocksByDate = useMemo(() => {
    const map = new Map<string, WsBlock[]>();
    for (const b of blocks) {
      if (programId && b.program_schedule_id !== programId) continue;
      if (!b.date) continue;
      const arr = map.get(b.date);
      if (arr) arr.push(b); else map.set(b.date, [b]);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) =>
        (a.start_time || '').localeCompare(b.start_time || '') ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
    }
    return map;
  }, [blocks, programId]);

  // Persist changed blocks (start/end/date/sort) via the existing block PUT.
  const persist = useCallback(async (changed: WsBlock[]) => {
    if (!changed.length) return;
    setSaving(true);
    try {
      await Promise.all(changed.map(b =>
        fetch(`/api/scheduling/planner/blocks/${b.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_time: b.start_time, end_time: b.end_time, date: b.date, sort_order: b.sort_order }),
        })
      ));
    } catch { /* reload below reconciles */ } finally {
      setSaving(false);
      loadBlocks();
    }
  }, [loadBlocks]);

  // Move a block to (targetDate, targetIndex), re-cascade affected days, save.
  const moveBlock = useCallback((blockId: string, targetDate: string, targetIndex: number) => {
    if (!programId) return; // editing requires a single cohort selected
    const moving = blocks.find(b => b.id === blockId);
    if (!moving || !moving.date) return;
    const sourceDate = moving.date;
    if (sourceDate === targetDate) {
      // no-op if dropped onto itself in the same slot
    }
    // Group this cohort's blocks by date (ordered).
    const byDate = new Map<string, WsBlock[]>();
    for (const b of blocks) {
      if (b.program_schedule_id !== programId || !b.date) continue;
      const a = byDate.get(b.date); if (a) a.push(b); else byDate.set(b.date, [b]);
    }
    for (const [, a] of byDate) {
      a.sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '') || (x.sort_order ?? 0) - (y.sort_order ?? 0));
    }
    // Remove from source, insert into target.
    byDate.set(sourceDate, (byDate.get(sourceDate) || []).filter(b => b.id !== blockId));
    const tgt = (byDate.get(targetDate) || []).filter(b => b.id !== blockId);
    const idx = Math.max(0, Math.min(targetIndex, tgt.length));
    tgt.splice(idx, 0, { ...moving, date: targetDate });
    byDate.set(targetDate, tgt);
    // Cascade affected day(s).
    const affected = sourceDate === targetDate ? [targetDate] : [sourceDate, targetDate];
    const updated = new Map<string, WsBlock>();
    for (const d of affected) for (const b of cascadeDay(byDate.get(d) || [])) updated.set(b.id, b);
    // Diff vs current.
    const changed: WsBlock[] = [];
    for (const [, nb] of updated) {
      const ob = blocks.find(b => b.id === nb.id);
      if (!ob || ob.start_time !== nb.start_time || ob.end_time !== nb.end_time || ob.date !== nb.date || (ob.sort_order ?? 0) !== (nb.sort_order ?? 0)) {
        changed.push(nb);
      }
    }
    if (!changed.length) return;
    setBlocks(prev => prev.map(b => updated.get(b.id) || b)); // optimistic
    persist(changed);
  }, [blocks, programId, persist]);

  // Publish the selected cohort's draft blocks in the visible week.
  const publishDrafts = useCallback(async () => {
    if (!programId || !semesterId) return;
    setSaving(true);
    try {
      await fetch('/api/scheduling/planner/blocks/publish-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semester_id: semesterId,
          program_schedule_id: programId,
          date_from: toDateStr(weekStart),
          date_to: toDateStr(addDays(weekStart, 6)),
        }),
      });
    } catch { /* reload reconciles */ } finally {
      setSaving(false);
      loadBlocks();
    }
  }, [programId, semesterId, weekStart, loadBlocks]);

  // Assign / clear a block's instructor (single primary). Writes the
  // pmi_block_instructors join via the block PUT (instructor_ids).
  const assignInstructor = useCallback(async (blockId: string, instrId: string | null) => {
    const inst = instrId ? instructorsList.find(i => i.id === instrId) : null;
    setEditingInstrId(null);
    setBlocks(prev => prev.map(b => b.id === blockId
      ? { ...b, instructors: inst ? [{ instructor: { id: inst.id, name: inst.name } }] : [] }
      : b)); // optimistic
    setSaving(true);
    try {
      await fetch(`/api/scheduling/planner/blocks/${blockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructor_ids: instrId ? [instrId] : [] }),
      });
    } catch { /* reload reconciles */ } finally {
      setSaving(false);
      loadBlocks();
    }
  }, [instructorsList, loadBlocks]);

  // Live conflict detection: same INSTRUCTOR or same ROOM on time-overlapping
  // blocks on the same date (across ALL cohorts in the week). Recomputes on
  // every blocks change, so dragging shows/clears conflicts immediately.
  const conflicts = useMemo(() => {
    const reason = new Map<string, Set<string>>(); // blockId -> {'instructor','room'}
    const addOverlaps = (keysOf: (b: WsBlock) => string[], label: string) => {
      const groups = new Map<string, WsBlock[]>();
      for (const b of blocks) {
        if (!b.date || !b.start_time || !b.end_time) continue;
        for (const k of keysOf(b)) {
          const gk = `${k}|${b.date}`;
          const a = groups.get(gk); if (a) a.push(b); else groups.set(gk, [b]);
        }
      }
      for (const [, arr] of groups) {
        if (arr.length < 2) continue;
        arr.sort((x, y) => toMin(x.start_time) - toMin(y.start_time));
        for (let i = 1; i < arr.length; i++) {
          if (toMin(arr[i].start_time) < toMin(arr[i - 1].end_time)) {
            for (const id of [arr[i].id, arr[i - 1].id]) {
              const s = reason.get(id) || new Set<string>(); s.add(label); reason.set(id, s);
            }
          }
        }
      }
    };
    addOverlaps(b => (b.instructors || []).map(iu => iu.instructor?.id).filter(Boolean) as string[], 'instructor');
    addOverlaps(b => (b.room_id ? [b.room_id] : []), 'room');
    return { ids: new Set(reason.keys()), reason };
  }, [blocks]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }
  if (!session) return null;

  const draftCount = blocks.filter(b => (!programId || b.program_schedule_id === programId) && b.status === 'draft').length;
  const conflictBlocks = blocks.filter(b => (!programId || b.program_schedule_id === programId) && conflicts.ids.has(b.id));
  const instrConflicts = conflictBlocks.filter(b => conflicts.reason.get(b.id)?.has('instructor')).length;
  const roomConflicts = conflictBlocks.filter(b => conflicts.reason.get(b.id)?.has('room')).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1400px] mx-auto px-4 py-5">
        <Link href="/calendar" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" /> Calendar
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planning Workspace</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag to arrange a cohort&apos;s week, then publish. Drafts stay off the live calendar until published.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {saving && <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>}
            {instrConflicts > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-3.5 h-3.5" /> {instrConflicts} instructor
              </span>
            )}
            {roomConflicts > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-3.5 h-3.5" /> {roomConflicts} room
              </span>
            )}
            <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              {draftCount} draft{draftCount === 1 ? '' : 's'} in view
            </span>
            {programId && draftCount > 0 && (
              <button onClick={publishDrafts} disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white">
                <Upload className="w-3.5 h-3.5" /> Publish {draftCount} draft{draftCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={semesterId} onChange={e => setSemesterId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
            {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={programId} onChange={e => setProgramId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
            <option value="">All cohorts</option>
            {programs.map(p => <option key={p.id} value={p.id}>{programLabel(p)}</option>)}
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setWeekStart(w => addDays(w, -7))} className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setWeekStart(getMonday(new Date()))} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" /> This week</button>
            <button onClick={() => setWeekStart(w => addDays(w, 7))} className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {!programId && (
          <div className="mb-3 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
            Select a cohort above to drag-arrange its week. (&quot;All cohorts&quot; is view-only.)
          </div>
        )}

        {/* Day columns */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {weekDays.map(day => {
              const key = toDateStr(day);
              const dayBlocks = blocksByDate.get(key) || [];
              const editable = !!programId;
              return (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[120px]">
                  <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {day.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                  </div>
                  <div
                    className={`p-1.5 space-y-1.5 min-h-[80px] ${draggingId && editable ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                    onDragOver={e => { if (draggingId && editable) e.preventDefault(); }}
                    onDrop={e => { if (!draggingId || !editable) return; e.preventDefault(); moveBlock(draggingId, key, dayBlocks.length); }}
                  >
                    {dayBlocks.length === 0 && <div className="text-[11px] text-gray-300 dark:text-gray-600 px-1 py-2">—</div>}
                    {dayBlocks.map((b, i) => {
                      const color = b.color || TYPE_COLORS[b.block_type || 'other'] || TYPE_COLORS.other;
                      const instrs = (b.instructors || []).map(iu => iu.instructor?.name).filter(Boolean);
                      return (
                        <div key={b.id}
                          draggable={editable && editingInstrId !== b.id}
                          onDragStart={e => { if (!editable) return; setDraggingId(b.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => setDraggingId(null)}
                          onDragOver={e => { if (draggingId && editable) e.preventDefault(); }}
                          onDrop={e => { if (!draggingId || !editable) return; e.preventDefault(); e.stopPropagation(); moveBlock(draggingId, key, i); }}
                          className={`rounded-md border-l-4 px-2 py-1 text-[11px] ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingId === b.id ? 'opacity-40' : ''} ${conflicts.ids.has(b.id) ? 'ring-2 ring-red-500' : ''} ${b.status === 'draft' ? 'bg-amber-50 dark:bg-amber-900/10 border-dashed' : 'bg-gray-50 dark:bg-gray-700/40'}`}
                          style={{ borderLeftColor: color }}>
                          <div className="font-medium text-gray-800 dark:text-gray-100 leading-tight flex items-start gap-1">
                            <span className="flex-1">{b.course_name || b.title || '(untitled)'}</span>
                            {conflicts.ids.has(b.id) && (
                              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5"
                                aria-label={`${[...(conflicts.reason.get(b.id) || [])].join(' + ')} conflict`} />
                            )}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {fmtTime(b.start_time)}–{fmtTime(b.end_time)}{b.room?.name ? ` · ${b.room.name}` : ''}
                          </div>
                          {/* Instructor chip / picker */}
                          {editable && editingInstrId === b.id ? (
                            <select
                              autoFocus
                              value={(b.instructors?.[0]?.instructor?.id) || ''}
                              onClick={e => e.stopPropagation()}
                              onChange={e => assignInstructor(b.id, e.target.value || null)}
                              onBlur={() => setEditingInstrId(null)}
                              className="mt-0.5 w-full text-[11px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                            >
                              <option value="">— Unassigned —</option>
                              {instructorsList.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); if (editable) setEditingInstrId(b.id); }}
                              className={`mt-0.5 inline-flex items-center gap-1 ${editable ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''} ${instrs.length ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}
                            >
                              <User className="w-3 h-3" />
                              <span className="truncate">{instrs.length ? instrs.join(', ') : (editable ? 'assign' : '—')}</span>
                            </button>
                          )}
                          {b.status === 'draft' && <span className="ml-1 text-amber-600 dark:text-amber-400">· draft</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
