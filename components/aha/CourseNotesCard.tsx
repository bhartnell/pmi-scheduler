'use client';

/**
 * CourseNotesCard (PALS P5d) — the day's instruction notes for an ACLS/PALS course,
 * one note per course day, editable by any instructor. Used expanded on the
 * coordinator and collapsed on the hub header.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, NotebookPen } from 'lucide-react';

interface Note { note_date: string; content: string; updated_by: string | null; updated_at: string }

const prettyDay = (d: string, i: number) =>
  `Day ${i + 1} · ${new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;

export default function CourseNotesCard({
  cohortId, course, dates, initialDate, defaultOpen = true,
}: {
  cohortId?: string | null;
  course: 'acls' | 'pals';
  dates: string[];
  initialDate?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [active, setActive] = useState<string>(initialDate && dates.includes(initialDate) ? initialDate : dates[0] || '');
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dates.includes(active)) setActive(initialDate && dates.includes(initialDate) ? initialDate : dates[0] || '');
  }, [dates, active, initialDate]);

  const load = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/adv-cert/course-notes?cohortId=${encodeURIComponent(cohortId)}&course=${course}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load notes');
      const map: Record<string, Note> = {};
      for (const n of json.notes as Note[]) map[String(n.note_date).slice(0, 10)] = n;
      setNotes(map);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [cohortId, course]);

  useEffect(() => { load(); }, [load]);

  // Switching day (or a fresh load) resets the draft to the saved text unless the user is mid-edit.
  useEffect(() => {
    if (!dirty) setDraft(notes[active]?.content ?? '');
  }, [active, notes, dirty]);

  const switchDay = (d: string) => {
    if (dirty && !window.confirm('Discard unsaved changes to this day\'s notes?')) return;
    setDirty(false);
    setActive(d);
  };

  const save = async () => {
    if (!cohortId || !active) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/adv-cert/course-notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId, course, date: active, content: draft }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');
      setNotes((n) => ({ ...n, [active]: json.note }));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!cohortId || dates.length === 0) return null;
  const saved = notes[active];
  const anyNotes = Object.values(notes).some((n) => n.content.trim());

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 print:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 w-full text-left min-h-[44px]" aria-expanded={open}>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <NotebookPen className="w-4 h-4" /> Course notes
        {anyNotes && !open && <span className="ml-1 text-[11px] font-normal text-blue-600 dark:text-blue-400">has notes</span>}
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {dates.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {dates.map((d, i) => (
                <button key={d} type="button" onClick={() => switchDay(d)}
                  className={`px-3 min-h-[44px] text-xs rounded-md border ${active === d ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}>
                  {prettyDay(d, i)}{notes[d]?.content.trim() ? ' •' : ''}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            rows={8}
            maxLength={20000}
            placeholder="Instruction notes for this day: what was said, what to change next time, reminders for the next cohort."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 p-2"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 text-sm rounded-md bg-red-600 text-white disabled:opacity-50">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save notes
            </button>
            {saved && !dirty && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Saved{saved.updated_by ? ` by ${saved.updated_by}` : ''} {new Date(saved.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            {dirty && <span className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            {error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
