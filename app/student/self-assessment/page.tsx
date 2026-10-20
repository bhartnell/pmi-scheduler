'use client';

/**
 * Pre-Internship Self-Assessment (student side) - Rae's tool, RAE R2/3.
 * Questions live in lib/preinternship-content.ts (Rae's content.js, verbatim).
 * Persistence goes only through SA_STORAGE; the server enforces access, the
 * cohort window and the post-review lock. Phone-first (allowed exception to
 * desktop-first), single working column that also reads well on a laptop.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { SA_LEVELS, SA_DOMAINS, SA_SCENARIOS, SA_REFLECT, SA_PREFS } from '@/lib/preinternship-content';
import { SA_STORAGE } from '@/lib/preinternship-storage';

const DRAFT_KEY = 'pmi-sa-draft-v1';

interface Form {
  ratings: Record<string, number>;
  scenarios: Record<string, string>;
  reflections: Record<string, string>;
  prefs: { learn: number | null; feedback: number | null; autonomy: number | null; challenges: number[] };
  ack: boolean;
}
interface Saved extends Partial<Form> { submittedAt?: string }

const blank = (): Form => ({
  ratings: {}, scenarios: {}, reflections: {},
  prefs: { learn: null, feedback: null, autonomy: null, challenges: [] }, ack: false,
});
const PREF_KEYS = ['learn', 'feedback', 'autonomy'] as const;
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

function fromSaved(d: Saved): Form {
  const b = blank();
  return {
    ratings: { ...b.ratings, ...(d.ratings || {}) },
    scenarios: { ...b.scenarios, ...(d.scenarios || {}) },
    reflections: { ...b.reflections, ...(d.reflections || {}) },
    prefs: { ...b.prefs, ...(d.prefs || {}), challenges: [...(d.prefs?.challenges || [])] },
    ack: !!d.ack,
  };
}

function missingList(f: Form): [string, string][] {
  const m: [string, string][] = [];
  SA_DOMAINS.forEach((d) => { if (!f.ratings[d.id]) m.push([`d-${d.id}`, `Rating: ${d.name}`]); });
  SA_SCENARIOS.forEach((s, i) => { if (!f.scenarios[s.id]) m.push([`c-${s.id}`, `Call ${i + 1}: ${s.title}`]); });
  SA_REFLECT.forEach((r, i) => {
    if (r.req && (f.reflections[r.id] || '').trim().length < 10) m.push([`f-${r.id}`, `Reflection question ${i + 1}`]);
  });
  PREF_KEYS.forEach((k) => { if (f.prefs[k] == null) m.push([`p-${k}`, SA_PREFS[k].label]); });
  if (!f.ack) m.push(['f-ack', 'The acknowledgment checkbox']);
  return m;
}

export default function SelfAssessmentPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [locked, setLocked] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [errors, setErrors] = useState<[string, string][]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = await SA_STORAGE.getMyStatus();
        setOpen(st.open);
        setLocked(st.locked);
        if (st.response) {
          const d = st.response as Saved;
          setForm(fromSaved(d));
          setSubmittedAt(d.submittedAt || null);
        } else {
          try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) setForm(fromSaved(JSON.parse(raw)));
          } catch { /* draft is a convenience only */ }
        }
      } catch {
        setFailed(true);
      }
      setLoading(false);
    })();
  }, []);

  const update = useCallback((fn: (f: Form) => Form) => {
    setForm((prev) => {
      const next = fn(prev);
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }, 400);
      return next;
    });
    setJustSaved(false);
  }, []);

  const status = useMemo(() => [
    { id: 'sec-ratings', label: 'Behaviors', done: SA_DOMAINS.filter((d) => form.ratings[d.id]).length, of: SA_DOMAINS.length },
    { id: 'sec-scen', label: 'Scenarios', done: SA_SCENARIOS.filter((s) => form.scenarios[s.id]).length, of: SA_SCENARIOS.length },
    { id: 'sec-reflect', label: 'Reflection', done: SA_REFLECT.filter((r) => r.req && (form.reflections[r.id] || '').trim().length >= 10).length, of: SA_REFLECT.filter((r) => r.req).length },
    { id: 'sec-prefs', label: 'Learning', done: PREF_KEYS.filter((k) => form.prefs[k] != null).length, of: 3 },
  ], [form]);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const miss = missingList(form);
    setErrors(miss);
    if (miss.length) return;
    setSaving(true);
    setFailed(false);
    try {
      await SA_STORAGE.saveMyResponse({
        v: 1, name: session?.user?.name || undefined, email: session?.user?.email || undefined,
        ratings: form.ratings, scenarios: form.scenarios, reflections: form.reflections,
        prefs: form.prefs, ack: form.ack,
      });
      const st = await SA_STORAGE.getMyStatus();
      const d = st.response as Saved | null;
      setSubmittedAt(d?.submittedAt || new Date().toISOString());
      setLocked(st.locked);
      setJustSaved(true);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setFailed(true);
    }
    setSaving(false);
  };

  const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6';
  const opt = 'flex items-start gap-3 p-3 min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50 dark:has-[:checked]:bg-cyan-900/20 has-[:disabled]:opacity-60 has-[:disabled]:cursor-default';
  const key = 'font-mono text-xs bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 mt-0.5';
  const dis = locked;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20">
      <Link href="/student" className="inline-flex items-center gap-1 text-sm text-cyan-700 dark:text-cyan-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Student dashboard
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pre-Internship Self-Assessment</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1 mb-6">About 15 to 20 minutes. Your answers help match you with a preceptor who fits how you learn.</p>

      {!open ? (
        <div className={card}>
          <p className="font-semibold text-gray-900 dark:text-white">Not open for your cohort yet</p>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Your instructors will open this when it is time. Nothing is due right now.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-8">
          {submittedAt && (
            <div className="flex gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-900 dark:text-green-200" role="status">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>{justSaved ? 'Saved.' : 'Submitted.'}</strong> You submitted this on {fmtDate(submittedAt)}.{' '}
                {locked ? 'An instructor has reviewed it, so it is locked.' : 'You can change your answers and update until an instructor reviews it.'}
              </div>
            </div>
          )}
          {locked && (
            <div className="flex gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
              <Lock className="w-5 h-5 shrink-0 mt-0.5" />
              <div>Locked after review. Ask an instructor to unlock it if you need to change something.</div>
            </div>
          )}

          <div className="sticky top-16 z-10 -mx-4 px-4 py-2 flex flex-wrap gap-2 bg-gray-50/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-700">
            {status.map((s) => (
              <button type="button" key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`px-3 min-h-[32px] rounded-full text-xs font-mono border ${s.done >= s.of ? 'border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
                {s.label} {s.done}/{s.of}
              </button>
            ))}
          </div>

          <section id="sec-ratings" className="space-y-4">
            <header className="border-l-4 border-cyan-600 pl-3">
              <span className="text-xs font-mono uppercase tracking-wide text-gray-500">Section 1 · 10 items</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Professional behaviors</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">For each area, choose the description that sounds most like you on a typical call today. Pick based on what you actually do, not what you plan to do. Honest ratings help us match you with a preceptor who fits how you learn, and your instructors complete the same ratings so you can compare.</p>
            </header>
            {SA_DOMAINS.map((d) => (
              <fieldset key={d.id} id={`d-${d.id}`} className={card} disabled={dis}>
                <legend className="sr-only">{d.name}</legend>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">{d.name}</h3>
                <div className="space-y-2">
                  {d.anchors.map((a, i) => (
                    <label key={i} className={opt}>
                      <input type="radio" name={`rate-${d.id}`} className="mt-1" checked={form.ratings[d.id] === i + 1}
                        onChange={() => update((f) => ({ ...f, ratings: { ...f.ratings, [d.id]: i + 1 } }))} />
                      <span><span className="block text-xs font-mono uppercase text-gray-500">{i + 1} · {SA_LEVELS[i]}</span>
                        <span className="text-gray-800 dark:text-gray-200">{a}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>

          <section id="sec-scen" className="space-y-4">
            <header className="border-l-4 border-cyan-600 pl-3">
              <span className="text-xs font-mono uppercase tracking-wide text-gray-500">Section 2 · 5 calls</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Field scenarios</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Choose what you would most likely do first. Go with your instinct rather than the answer you think we want.</p>
            </header>
            {SA_SCENARIOS.map((s, i) => (
              <fieldset key={s.id} id={`c-${s.id}`} className={card} disabled={dis}>
                <legend className="sr-only">Call {i + 1}: {s.title}</legend>
                <span className="text-xs font-mono uppercase tracking-wide text-gray-500">Call {i + 1}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                <p className="border-l-4 border-cyan-600 pl-3 mb-3 text-gray-800 dark:text-gray-200">{s.text}</p>
                <div className="space-y-2">
                  {s.options.map((o) => (
                    <label key={o.k} className={opt}>
                      <input type="radio" name={`scen-${s.id}`} className="mt-1" checked={form.scenarios[s.id] === o.k}
                        onChange={() => update((f) => ({ ...f, scenarios: { ...f.scenarios, [s.id]: o.k } }))} />
                      <span className={key}>{o.k}</span><span className="text-gray-800 dark:text-gray-200">{o.t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>

          <section id="sec-reflect" className="space-y-4">
            <header className="border-l-4 border-cyan-600 pl-3">
              <span className="text-xs font-mono uppercase tracking-wide text-gray-500">Section 3</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reflection</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">A few sentences each is enough. Specific examples are more useful than general statements.</p>
            </header>
            {SA_REFLECT.map((r) => (
              <label key={r.id} className={`${card} block`}>
                <span id={`f-${r.id}`} className="font-semibold text-gray-900 dark:text-white block">{r.label}</span>
                {r.help && <span className="text-sm text-gray-500 block">{r.help}</span>}
                <textarea disabled={dis} value={form.reflections[r.id] || ''} rows={4}
                  onChange={(e) => update((f) => ({ ...f, reflections: { ...f.reflections, [r.id]: e.target.value } }))}
                  className="mt-2 w-full min-h-[96px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-3" />
              </label>
            ))}
          </section>

          <section id="sec-prefs" className="space-y-4">
            <header className="border-l-4 border-cyan-600 pl-3">
              <span className="text-xs font-mono uppercase tracking-wide text-gray-500">Section 4</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">How you learn best</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">These answers go straight to your agency&apos;s placement coordinator to help pair you with a preceptor.</p>
            </header>
            {PREF_KEYS.map((k) => (
              <fieldset key={k} id={`p-${k}`} className={card} disabled={dis}>
                <legend className="sr-only">{SA_PREFS[k].label}</legend>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">{SA_PREFS[k].label}</h3>
                <div className="space-y-2">
                  {SA_PREFS[k].options.map((o, i) => (
                    <label key={i} className={opt}>
                      <input type="radio" name={`pref-${k}`} className="mt-1" checked={form.prefs[k] === i}
                        onChange={() => update((f) => ({ ...f, prefs: { ...f.prefs, [k]: i } }))} />
                      <span className={key}>{String.fromCharCode(65 + i)}</span><span className="text-gray-800 dark:text-gray-200">{o}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset id="p-challenges" className={card} disabled={dis}>
              <legend className="sr-only">{SA_PREFS.challenges.label}</legend>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">{SA_PREFS.challenges.label}</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {SA_PREFS.challenges.options.map((o, i) => (
                  <label key={i} className={opt}>
                    <input type="checkbox" className="mt-1" checked={form.prefs.challenges.includes(i)}
                      onChange={(e) => update((f) => ({
                        ...f, prefs: { ...f.prefs, challenges: e.target.checked ? [...f.prefs.challenges, i] : f.prefs.challenges.filter((x) => x !== i) },
                      }))} />
                    <span className="text-gray-800 dark:text-gray-200">{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="space-y-4">
            <label className={`${opt} !items-start`} id="f-ack">
              <input type="checkbox" disabled={dis} className="mt-1" checked={form.ack} onChange={(e) => update((f) => ({ ...f, ack: e.target.checked }))} />
              <span className="text-gray-800 dark:text-gray-200">I understand that a summary of my responses, alongside my instructors&apos; ratings, will be shared with my field internship agency to help match me with a preceptor. My reflection answers to the first two questions stay with my instructors.</span>
            </label>
            {errors.length > 0 && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200">
                <strong>Finish these items before submitting:</strong>
                <ul className="mt-2 pl-5 list-disc">
                  {errors.map(([id, label]) => (
                    <li key={id}><button type="button" className="underline text-left" onClick={() => jump(id)}>{label}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {failed && (
              <div className="flex gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200" role="alert">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div><strong>Your responses didn&apos;t save.</strong> Check your connection and select the button again. Your answers are still here.</div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={saving || dis}
                className="min-h-[44px] px-5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-50">
                {saving ? 'Submitting…' : submittedAt ? 'Update my responses' : 'Submit self-assessment'}
              </button>
              {!submittedAt && <span className="text-sm text-gray-500">Your answers are saved as a draft in this browser as you go.</span>}
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
