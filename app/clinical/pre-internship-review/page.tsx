'use client';

/**
 * Pre-Internship Self-Assessment: instructor review (Rae's tool, RAE R3/3).
 * Roster on the left, student detail on the right. Persistence goes only through
 * SA_STORAGE; the server enforces instructor-only access, so a student who finds
 * this URL sees "Instructor access required" and gets 403 from every API call.
 * Scoring and summary rules live in lib/preinternship-review.ts (Rae's app.js).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Lock, Unlock, RefreshCw, FileSpreadsheet, Trash2, CheckCircle } from 'lucide-react';
import { SA_DOMAINS, SA_LEVELS, SA_PREFS, SA_REFLECT } from '@/lib/preinternship-content';
import { SA_STORAGE } from '@/lib/preinternship-storage';
import {
  autoSummary, blankEdit, buildCsv, calibration, fmtDate, gapInfo, isFullyRated, scenarioScore, slug,
  summaryPlain, summaryStandalone, type SaEdit, type SaRecord, type Tone,
} from '@/lib/preinternship-review';

interface Row { id: string; data: SaRecord; locked: boolean }

const TAG: Record<Tone, string> = {
  bad: 'border-red-600 text-red-700 dark:text-red-400',
  warn: 'border-amber-600 text-amber-700 dark:text-amber-400',
  ok: 'border-green-600 text-green-700 dark:text-green-400',
  info: 'border-blue-600 text-blue-700 dark:text-blue-400',
  '': 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300',
};
const Tag = ({ tone = '', children }: { tone?: Tone; children: React.ReactNode }) => (
  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${TAG[tone]}`}>{children}</span>
);

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5';
const input = 'w-full min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-60';
const area = `${input} py-2 min-h-[96px]`;
const btn = 'inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-medium disabled:opacity-50';
const btnPrimary = `${btn} bg-cyan-700 hover:bg-cyan-800 text-white`;
const btnGhost = `${btn} border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700`;

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PreInternshipReviewPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [reviews, setReviews] = useState<Record<string, SaEdit>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<SaEdit>(blankEdit());
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [q, setQ] = useState('');
  const [cohort, setCohort] = useState('');

  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    const [resp, revs] = await Promise.all([SA_STORAGE.listResponses(), SA_STORAGE.listReviews()]);
    setRows(resp as Row[]);
    setReviews(revs as Record<string, SaEdit>);
    return { resp: resp as Row[], revs: revs as Record<string, SaEdit> };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ok = await SA_STORAGE.isInstructor();
        setAllowed(ok);
        if (ok) await load();
      } catch {
        setError('Could not load submissions. Check your connection and refresh.');
      }
      setLoading(false);
    })();
  }, [load]);

  const records = useMemo(
    () => [...rows].sort((a, b) => (a.data.name || '').localeCompare(b.data.name || '')),
    [rows],
  );
  const cohorts = useMemo(() => [...new Set(records.map((r) => r.data.cohort).filter(Boolean))].sort() as string[], [records]);
  const shown = records.filter((r) =>
    (!cohort || r.data.cohort === cohort) && (!q || (r.data.name || '').toLowerCase().includes(q.toLowerCase())));
  const reviewedCount = records.filter((r) => isFullyRated(reviews[`r-${r.id}`])).length;
  const current = records.find((r) => r.id === selected) || null;

  const openRecord = (id: string, recs: Row[], revs: Record<string, SaEdit>) => {
    const rec = recs.find((r) => r.id === id);
    if (!rec) return;
    const saved = revs[`r-${id}`];
    const e: SaEdit = saved
      ? { ...blankEdit(), ...JSON.parse(JSON.stringify(saved)) }
      : blankEdit();
    if (!saved) e.summary = { ...e.summary, ...autoSummary(rec.data, e) };
    setSelected(id); setEdit(e); setDirty(false); setPending(null); setConfirmRemove(false);
  };
  const select = (id: string) => {
    if (dirty && selected && selected !== id) { setPending(id); return; }
    openRecord(id, records, reviews);
  };

  const change = (fn: (e: SaEdit) => SaEdit) => { setEdit((e) => fn(e)); setDirty(true); };

  const save = async (switchTo?: string): Promise<boolean> => {
    if (!current) return false;
    setSaving(true);
    const body = { ...edit, updatedAt: new Date().toISOString() };
    try {
      await SA_STORAGE.saveReview(`r-${current.id}`, body);
      const fresh = await load();
      setEdit(body); setDirty(false);
      say('Review saved');
      if (switchTo) openRecord(switchTo, fresh.resp, fresh.revs);
      setSaving(false);
      return true;
    } catch {
      say("The review didn't save. Check your connection and try again.");
      setSaving(false);
      return false;
    }
  };

  const unlock = async () => {
    if (!current) return;
    try { await SA_STORAGE.unlockResponse(current.id); await load(); say('Unlocked. The student can edit again.'); }
    catch { say("Couldn't unlock. Try again."); }
  };

  const remove = async () => {
    if (!current) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    try {
      await SA_STORAGE.deleteResponse(current.id);
      setSelected(null); setDirty(false); setConfirmRemove(false);
      await load(); say('Record removed');
    } catch { say("That record couldn't be removed. Try again."); }
  };

  const copySummary = async () => {
    if (!current) return;
    try { await navigator.clipboard.writeText(summaryPlain(current.data, edit)); say('Copied'); }
    catch { say('Copy was blocked by the browser. Use Download instead.'); }
  };

  const exportCsv = () => {
    const csv = buildCsv(records.map((r) => ({ rec: r.data, edit: reviews[`r-${r.id}`] || null })));
    download(`pre-internship-self-assessments-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" /></div>;
  }
  if (error || !allowed) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-10">
        <div className={card}>
          <p className="font-semibold text-gray-900 dark:text-white">{error ? 'Something went wrong' : 'Instructor access required'}</p>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{error || 'Only instructors can review pre-internship self-assessments.'}</p>
        </div>
      </div>
    );
  }

  const cal = current ? calibration(current.data, edit) : null;
  const sc = current ? scenarioScore(current.data) : null;
  const p = current?.data.prefs || {};

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 max-sm:px-4">
      <Link href="/clinical" className="inline-flex items-center gap-1 text-sm text-cyan-700 dark:text-cyan-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Clinical
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pre-Internship Self-Assessment Review</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1 mb-5">
        Compare each student&apos;s self-ratings with yours and build the one-page summary for their agency. Summaries are download-and-send; nothing is emailed from here.
      </p>

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg bg-gray-900 text-white shadow-lg">{toast}</div>}

      <div className="grid grid-cols-[22rem_minmax(0,1fr)] gap-6 max-lg:grid-cols-1 items-start">
        <aside className={`${card} space-y-3 lg:sticky lg:top-20`}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white">Students</h2>
            <Tag>{reviewedCount}/{records.length} reviewed</Tag>
          </div>
          <input className={input} placeholder="Search by name" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={input} aria-label="Filter by cohort" value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">All cohorts</option>
            {cohorts.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {shown.length ? shown.map((r) => {
              const e = reviews[`r-${r.id}`];
              const done = isFullyRated(e);
              const c = e ? calibration(r.data, e) : null;
              return (
                <button key={r.id} onClick={() => select(r.id)} aria-current={selected === r.id}
                  className="w-full text-left p-3 min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 aria-[current=true]:border-cyan-600 aria-[current=true]:bg-cyan-50 dark:aria-[current=true]:bg-cyan-900/20">
                  <span className="block font-semibold text-gray-900 dark:text-white">{r.data.name || 'Unnamed'}</span>
                  <span className="flex flex-wrap gap-1 mt-1">
                    <Tag>{r.data.cohort || 'No cohort'}</Tag>
                    {done ? <Tag tone="ok">Reviewed</Tag> : <Tag>Awaiting review</Tag>}
                    {c && done && <Tag tone={c.cls}>{c.label}</Tag>}
                    {r.locked && <Tag tone="info">Locked</Tag>}
                  </span>
                </button>
              );
            }) : (
              <p className="p-3 text-sm text-gray-600 dark:text-gray-400">
                {records.length ? 'No students match this filter.' : 'No submissions yet.'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => load().then(() => say('List updated')).catch(() => say("Couldn't refresh."))}>
              <RefreshCw className="w-4 h-4" /> Refresh list
            </button>
            <button className={btnGhost} onClick={exportCsv} disabled={!records.length}>
              <FileSpreadsheet className="w-4 h-4" /> Export all as CSV
            </button>
          </div>
        </aside>

        <section className="space-y-5 min-w-0">
          {!current || !sc ? (
            <div className={card}>
              <h2 className="font-bold text-gray-900 dark:text-white">{records.length ? 'Select a student' : 'Waiting for students'}</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {records.length
                  ? 'Choose a student on the left to compare their self-ratings with yours and build the agency summary.'
                  : 'Submissions appear here as students complete the form. Select Refresh list to check for new ones.'}
              </p>
            </div>
          ) : (
            <>
              {pending && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
                  <span>You have unsaved changes for {current.data.name}.</span>
                  <span className="flex gap-2">
                    <button className={btnPrimary} onClick={() => { void save(pending); }}>Save and switch</button>
                    <button className={btnGhost} onClick={() => openRecord(pending, records, reviews)}>Discard changes</button>
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wide text-gray-500">
                    {current.data.cohort} · Submitted {fmtDate(current.data.submittedAt)}
                  </span>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{current.data.name}</h2>
                  {current.data.email && <span className="text-gray-600 dark:text-gray-400 select-all">{current.data.email}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {cal && <Tag tone={cal.cls}>{cal.label} ({cal.mean > 0 ? '+' : ''}{cal.mean.toFixed(1)})</Tag>}
                  <Tag tone="info">Scenarios {sc.total}/{sc.max}</Tag>
                  {current.locked && (
                    <>
                      <Tag tone="info"><Lock className="inline w-3 h-3 mr-1" />Locked for the student</Tag>
                      <button className={btnGhost} onClick={unlock}><Unlock className="w-4 h-4" /> Unlock</button>
                    </>
                  )}
                </div>
              </div>

              <div className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">Professional behaviors</h3>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Rate each area using the same anchors the student saw.</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-3">Behavior</th><th className="py-2 pr-3">Self</th>
                        <th className="py-2 pr-3">Instructor</th><th className="py-2">Comparison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SA_DOMAINS.map((d) => {
                        const a = current.data.ratings?.[d.id];
                        const b = edit.instr?.[d.id];
                        const g = gapInfo(a, b);
                        return (
                          <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700 align-top">
                            <td className="py-2 pr-3 text-gray-900 dark:text-gray-100" title={a ? d.anchors[a - 1] : ''}>
                              {d.name}
                              {a ? <span className="block text-xs text-gray-500 max-w-xl">{d.anchors[a - 1]}</span> : null}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{a || '-'}</td>
                            <td className="py-2 pr-3">
                              <select className={`${input} min-w-[11rem]`} aria-label={`Instructor rating for ${d.name}`} value={b || ''}
                                onChange={(e) => change((ed) => {
                                  const instr = { ...ed.instr };
                                  if (e.target.value) instr[d.id] = Number(e.target.value); else delete instr[d.id];
                                  return { ...ed, instr };
                                })}>
                                <option value="">Rate...</option>
                                {SA_LEVELS.map((l, i) => <option key={l} value={i + 1}>{i + 1} · {l}</option>)}
                              </select>
                            </td>
                            <td className="py-2">{g.label ? <Tag tone={g.cls}>{g.label}</Tag> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 max-xl:grid-cols-1 gap-5">
                <div className={card}>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-3">Scenario choices</h3>
                  <div className="space-y-3">
                    {sc.items.map(({ s, o, sc: v }, i) => (
                      <div key={s.id} className="pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-gray-900 dark:text-white">Call {i + 1}: {s.title}</strong>
                          {v === 2 ? <Tag tone="ok">Best choice</Tag> : v === 1 ? <Tag tone="warn">Acceptable</Tag> : v === 0 ? <Tag tone="bad">Concern</Tag> : <Tag>No answer</Tag>}
                        </div>
                        {o && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{o.k}. {o.t}</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-5">
                  <div className={card}>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Reflections <Tag>Instructor only</Tag></h3>
                    <div className="space-y-3">
                      {SA_REFLECT.map((r) => (
                        <div key={r.id}>
                          <strong className="text-sm text-gray-900 dark:text-white">{r.label}</strong>
                          {(current.data.reflections?.[r.id] || '').trim()
                            ? <p className="mt-1 pl-3 border-l-4 border-gray-300 dark:border-gray-600 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{current.data.reflections?.[r.id]}</p>
                            : <p className="text-sm text-gray-500 mt-1">No answer.</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={card}>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Learning preferences</h3>
                    <dl className="space-y-2 text-sm">
                      {(['learn', 'feedback', 'autonomy'] as const).map((k) => (
                        <div key={k}>
                          <dt className="text-xs font-mono uppercase text-gray-500">{SA_PREFS[k].label}</dt>
                          <dd className="text-gray-900 dark:text-gray-100">{p[k] != null ? SA_PREFS[k].options[p[k] as number] : '-'}</dd>
                        </div>
                      ))}
                      <div>
                        <dt className="text-xs font-mono uppercase text-gray-500">Situations that throw them off</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {p.challenges?.length ? p.challenges.map((i) => SA_PREFS.challenges.options[i]).join('; ') : 'None selected'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              <div className={`${card} space-y-4`}>
                <h3 className="font-bold text-gray-900 dark:text-white">Academic standing</h3>
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                  <label className="block text-sm text-gray-800 dark:text-gray-200">Cognitive standing
                    <small className="block text-gray-500">e.g., summative exam average, module scores</small>
                    <input className={input} value={edit.academic?.cog || ''}
                      onChange={(e) => change((ed) => ({ ...ed, academic: { ...ed.academic, cog: e.target.value } }))} />
                  </label>
                  <label className="block text-sm text-gray-800 dark:text-gray-200">Psychomotor / skills
                    <small className="block text-gray-500">e.g., skills check-offs complete, remediation</small>
                    <input className={input} value={edit.academic?.skills || ''}
                      onChange={(e) => change((ed) => ({ ...ed, academic: { ...ed.academic, skills: e.target.value } }))} />
                  </label>
                </div>
              </div>

              <div className={`${card} space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">Agency summary</h3>
                  <button className={btnGhost} onClick={() => {
                    change((ed) => ({ ...ed, summary: { ...ed.summary, ...autoSummary(current.data, ed) } }));
                    say('Summary refilled');
                  }}>Refill from ratings</button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pre-filled from both sets of ratings and the student&apos;s preferences. Edit freely; one item per line for strengths and growth areas. Only the student&apos;s optional note for the preceptor is included; the two instructor-only reflections never are.
                </p>
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                  <label className="block text-sm text-gray-800 dark:text-gray-200">Strengths
                    <textarea className={area} value={edit.summary?.strengths || ''}
                      onChange={(e) => change((ed) => ({ ...ed, summary: { ...ed.summary, strengths: e.target.value } }))} />
                  </label>
                  <label className="block text-sm text-gray-800 dark:text-gray-200">Growth areas
                    <textarea className={area} value={edit.summary?.growth || ''}
                      onChange={(e) => change((ed) => ({ ...ed, summary: { ...ed.summary, growth: e.target.value } }))} />
                  </label>
                </div>
                <label className="block text-sm text-gray-800 dark:text-gray-200">Preceptor match
                  <textarea className={`${area} min-h-[120px]`} value={edit.summary?.match || ''}
                    onChange={(e) => change((ed) => ({ ...ed, summary: { ...ed.summary, match: e.target.value } }))} />
                </label>
                <label className="block text-sm text-gray-800 dark:text-gray-200">Instructor comments <small className="text-gray-500">Optional</small>
                  <textarea className={area} value={edit.summary?.comments || ''}
                    onChange={(e) => change((ed) => ({ ...ed, summary: { ...ed.summary, comments: e.target.value } }))} />
                </label>
                <label className="block text-sm text-gray-800 dark:text-gray-200 max-w-sm">Prepared by
                  <input className={input} value={edit.preparedBy || ''}
                    onChange={(e) => change((ed) => ({ ...ed, preparedBy: e.target.value }))} />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                    {dirty ? 'Unsaved changes' : reviews[`r-${current.id}`] ? <><CheckCircle className="w-4 h-4 text-green-600" /> Saved</> : 'Not saved yet'}
                    {' '}· Saving locks the student&apos;s answers until you unlock them.
                  </span>
                  <button className={btnPrimary} onClick={() => { void save(); }} disabled={saving}>{saving ? 'Saving...' : 'Save review'}</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">Summary preview</h3>
                <span className="flex gap-2">
                  <button className={btnGhost} onClick={copySummary}><Copy className="w-4 h-4" /> Copy as text</button>
                  <button className={btnPrimary}
                    onClick={() => download(`profile-${slug(current.data.name)}.html`, summaryStandalone(current.data, edit), 'text/html')}>
                    <Download className="w-4 h-4" /> Download summary
                  </button>
                </span>
              </div>
              <iframe title="Agency summary preview" className="w-full h-[640px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white"
                sandbox="" srcDoc={summaryStandalone(current.data, edit)} />

              <div className="flex flex-wrap items-center gap-3">
                <button className={`${btn} border border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`} onClick={remove}>
                  <Trash2 className="w-4 h-4" /> {confirmRemove ? "Confirm: remove this student's record" : 'Remove this record'}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Use this for test submissions or duplicates. The record is archived, not erased.</span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
