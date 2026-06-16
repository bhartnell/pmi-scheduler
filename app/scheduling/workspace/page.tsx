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
import { ChevronLeft, ChevronRight, Loader2, ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';

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

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }
  if (!session) return null;

  const draftCount = blocks.filter(b => (!programId || b.program_schedule_id === programId) && b.status === 'draft').length;

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
            <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              {draftCount} draft{draftCount === 1 ? '' : 's'} in view
            </span>
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

        {/* Day columns */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {weekDays.map(day => {
              const key = toDateStr(day);
              const dayBlocks = blocksByDate.get(key) || [];
              return (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[120px]">
                  <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {day.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                  </div>
                  <div className="p-1.5 space-y-1.5">
                    {dayBlocks.length === 0 && <div className="text-[11px] text-gray-300 dark:text-gray-600 px-1 py-2">—</div>}
                    {dayBlocks.map(b => {
                      const color = b.color || TYPE_COLORS[b.block_type || 'other'] || TYPE_COLORS.other;
                      const instrs = (b.instructors || []).map(i => i.instructor?.name).filter(Boolean);
                      return (
                        <div key={b.id}
                          className={`rounded-md border-l-4 px-2 py-1 text-[11px] ${b.status === 'draft' ? 'bg-amber-50 dark:bg-amber-900/10 border-dashed' : 'bg-gray-50 dark:bg-gray-700/40'}`}
                          style={{ borderLeftColor: color }}>
                          <div className="font-medium text-gray-800 dark:text-gray-100 leading-tight">{b.course_name || b.title || '(untitled)'}</div>
                          <div className="text-gray-500 dark:text-gray-400">{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</div>
                          {instrs.length > 0 && <div className="text-gray-400 truncate">{instrs.join(', ')}</div>}
                          {b.status === 'draft' && <span className="text-amber-600 dark:text-amber-400">draft</span>}
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
