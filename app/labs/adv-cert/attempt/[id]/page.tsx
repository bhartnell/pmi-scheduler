'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Loader2 } from 'lucide-react';

interface Criterion { id: string; text: string; is_critical: boolean | null; met: boolean }
interface Segment { id: string; name: string; result: string | null; comments: string | null; criteria: Criterion[] }
interface Person { id: string; first_name: string; last_name: string }
interface AttemptRec {
  attempt: {
    id: string; overall_result: string; started_at: string; comments: string | null; cert_course: string;
    team_lead: Person | null; grader: { id: string; name: string } | null;
    scenario: { id: string; name: string; case_code: string | null } | null; group: { id: string; name: string } | null;
  };
  students: Person[];
  segments: Segment[];
}

const resultCls = (r: string | null) =>
  r === 'pass' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  : r === 'fail' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

// Read-only megacode attempt record. Opened from the ACLS board's Student progress panel.
export default function AttemptRecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rec, setRec] = useState<AttemptRec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/adv-cert/attempts/${id}`)
      .then(r => r.json())
      .then(j => { if (!off) { if (j.success) setRec(j); else setError(j.error || 'Failed to load'); } })
      .catch(() => { if (!off) setError('Failed to load'); });
    return () => { off = true; };
  }, [id]);

  const name = (p: Person) => `${p.first_name} ${p.last_name}`;
  const missed = rec ? rec.segments.reduce((n, s) => n + s.criteria.filter(c => !c.met).length, 0) : 0;

  return (
    <div className="mx-auto max-w-6xl p-4 text-gray-900 dark:text-gray-100">
      <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-300 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      {error && <div role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</div>}
      {!rec && !error && <Loader2 className="w-5 h-5 animate-spin" />}
      {rec && (
        <div className="space-y-4">
          <header className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 grid grid-cols-3 max-md:grid-cols-1 gap-3">
            <div>
              <div className="text-xs uppercase text-gray-500">Scenario</div>
              <div className="font-semibold">{rec.attempt.scenario?.case_code ? `${rec.attempt.scenario.case_code} · ` : ''}{rec.attempt.scenario?.name ?? 'Unknown'}</div>
              <div className="text-xs text-gray-500">{new Date(rec.attempt.started_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Team</div>
              <div className="text-sm">{rec.attempt.group?.name ?? ''}</div>
              <div className="text-sm">Team lead: {rec.attempt.team_lead ? name(rec.attempt.team_lead) : 'not recorded'}</div>
              <div className="text-xs text-gray-500">{rec.students.map(name).join(', ')}</div>
              <div className="text-xs text-gray-500">Grader: {rec.attempt.grader?.name ?? 'not recorded'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Overall</div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold uppercase ${resultCls(rec.attempt.overall_result)}`}>{rec.attempt.overall_result}</span>
              <div className="text-xs text-gray-500 mt-1">{missed} criteri{missed === 1 ? 'on' : 'a'} not met</div>
            </div>
            {rec.attempt.comments && <div className="col-span-3 max-md:col-span-1 text-sm whitespace-pre-wrap border-t border-gray-100 dark:border-gray-700 pt-2"><span className="text-xs uppercase text-gray-500">Attempt comment </span>{rec.attempt.comments}</div>}
          </header>
          {rec.segments.map(s => (
            <section key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-semibold">{s.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${resultCls(s.result)}`}>{s.result ?? 'not marked'}</span>
              </div>
              <ul className="space-y-1">
                {s.criteria.map(c => (
                  <li key={c.id} className={`flex items-start gap-2 text-sm rounded px-2 py-1 ${c.met ? '' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    {c.met ? <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-label="Met" /> : <X className="w-4 h-4 mt-0.5 text-red-600 shrink-0" aria-label="Not met" />}
                    <span className={c.met ? 'text-gray-700 dark:text-gray-200' : 'font-medium'}>{c.text}</span>
                    {c.is_critical === true && <span className="text-[10px] uppercase text-red-700">critical</span>}
                  </li>
                ))}
              </ul>
              {s.comments && <p className="mt-2 text-sm whitespace-pre-wrap border-t border-gray-100 dark:border-gray-700 pt-2"><span className="text-xs uppercase text-gray-500">Comment </span>{s.comments}</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
