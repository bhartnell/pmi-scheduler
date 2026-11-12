'use client';

import { useState } from 'react';
import {
  type ScenarioApi,
  buildFullTextLines,
  buildOralSections,
  buildPhaseSections,
  buildVitalsTable,
  dispatchLines,
  parseCriticalActions,
} from './scenarioMapping';

const card = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4';
const h3 = 'font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 text-sm';

export default function ScenarioReference({ data, letter }: { data: ScenarioApi; letter: string }) {
  const [showFull, setShowFull] = useState(false);
  const dispatch = dispatchLines(data.dispatch_text);
  const actions = parseCriticalActions(data.critical_actions);
  const vitals = buildVitalsTable(data.vital_sign_progressions);
  const phases = buildPhaseSections(data.expected_interventions, data.vital_sign_progressions);
  const oral = buildOralSections(data.oral_board_domains);
  const fullLines = buildFullTextLines(data.full_content);
  const age = data.patient_age !== null && data.patient_age !== undefined ? String(data.patient_age) : '';

  return (
    <div className="space-y-4 text-base text-slate-800 dark:text-slate-200">
      <div className="bg-blue-600 text-white rounded-xl p-4">
        <h2 className="text-xl font-bold">Scenario {letter} - {data.title}</h2>
        {dispatch && <p className="text-blue-50 mt-2 whitespace-pre-line">{dispatch}</p>}
      </div>

      {(data.patient_name || age || data.chief_complaint) && (
        <div className={card}>
          <h3 className={h3}>Patient</h3>
          <div className="space-y-1">
            {data.patient_name && <div><span className="text-slate-500 dark:text-slate-400">Name:</span> <span className="font-medium">{data.patient_name}</span></div>}
            {age && <div><span className="text-slate-500 dark:text-slate-400">Age:</span> <span className="font-medium">{age}</span></div>}
            {data.chief_complaint && <div><span className="text-slate-500 dark:text-slate-400">Chief complaint:</span> <span className="font-medium">{data.chief_complaint}</span></div>}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
          <h3 className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 text-sm">Critical actions</h3>
          <ol className="space-y-2">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">{i + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {vitals.rows.length > 0 && (
        <div className={card}>
          <h3 className={h3}>Vital signs by phase</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="py-1 pr-3 font-semibold">Phase</th>
                  {vitals.columns.map(c => <th key={c} className="py-1 px-2 font-semibold whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {vitals.rows.map(r => (
                  <tr key={r.key} className="border-b border-slate-100 dark:border-slate-700 align-top">
                    <td className={`py-1.5 pr-3 ${r.isSet ? 'pl-4 text-slate-500 dark:text-slate-400' : 'font-medium'}`}>{r.phaseLabel}</td>
                    {vitals.columns.map(c => <td key={c} className="py-1.5 px-2 whitespace-nowrap">{r.cells[c] ?? '-'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vitals.hasMultiSet && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Where a phase has two sets, see that phase in the full case text for which path each belongs to.</p>
          )}
        </div>
      )}

      {phases.length > 0 && (
        <div className={card}>
          <h3 className={h3}>By phase</h3>
          <div className="space-y-4">
            {phases.map(p => (
              <div key={p.phase}>
                <h4 className="font-bold">Phase {p.phase}{p.title ? ` - ${p.title}` : ''}</h4>
                {p.actions.length > 0 && (
                  <div className="mt-1">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Expected actions</p>
                    <ul className="list-disc pl-6 space-y-1">{p.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
                {p.cues && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Instructor cues</p>
                    <p>{p.cues}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {oral.length > 0 && (
        <div className={card}>
          <h3 className={h3}>Oral board / debrief</h3>
          {oral.map((s, si) => (
            <div key={si} className={si > 0 ? 'mt-3' : ''}>
              {s.heading && <h4 className="font-bold mb-1">{s.heading}</h4>}
              <ol className="space-y-2">
                {s.items.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">{i + 1}</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {fullLines.length > 0 && (
        <div className={card}>
          <button
            onClick={() => setShowFull(s => !s)}
            className="min-h-[44px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            {showFull ? 'Hide full case text' : 'Show full case text'}
          </button>
          {showFull && (
            <div className="mt-2 space-y-1">
              {fullLines.map((l, i) =>
                l.heading ? (
                  <h4 key={i} className="font-bold tracking-wide pt-3 text-slate-900 dark:text-white">{l.text}</h4>
                ) : (
                  <p key={i}>{l.text}</p>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
