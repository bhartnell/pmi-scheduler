'use client';

// ONE shared OSCE scenario view. Rendered by the standalone page
// (/osce-scenario/[letter]) and by the left pane of the grading page.
// Fills the width it is given. Renders from either API response and omits
// any section whose field is absent. No data is invented.

import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, ClipboardList, FileText, Lock, Stethoscope } from 'lucide-react';
import {
  type ScenarioApi,
  buildFullTextLines,
  buildOralSections,
  buildPhaseSections,
  dispatchPairs,
  parseCriticalActions,
  VITAL_COLUMN_ORDER,
} from './scenarioMapping';

const card = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
const h2 = 'text-lg font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3';

interface PhaseVitals {
  phase: number;
  title: string;
  sets: Record<string, string>[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function vitalsByPhase(progressions: unknown): PhaseVitals[] {
  if (!Array.isArray(progressions)) return [];
  return progressions
    .filter(isObj)
    .map((p, idx) => ({
      phase: Number(p.phase) || idx + 1,
      title: typeof p.title === 'string' ? p.title.trim() : '',
      sets: (Array.isArray(p.vitals) ? p.vitals.filter(isObj) : []).map(s =>
        Object.fromEntries(
          Object.entries(s).map(([k, v]) => [k, v === null || v === undefined || String(v).trim() === '' ? '-' : String(v).trim()]),
        ),
      ),
    }))
    .sort((a, b) => a.phase - b.phase);
}

function orderedKeys(set: Record<string, string>): string[] {
  const keys = Object.keys(set);
  return [...VITAL_COLUMN_ORDER.filter(k => keys.includes(k)), ...keys.filter(k => !VITAL_COLUMN_ORDER.includes(k))];
}

export default function OsceScenarioView({ scenario, letter }: { scenario: ScenarioApi; letter?: string }) {
  const [showFull, setShowFull] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set()); // all phases start open
  const toggle = (n: number) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const L = letter || scenario.scenario_letter || '';
  const dispatch = dispatchPairs(scenario.dispatch_text);
  const actions = parseCriticalActions(scenario.critical_actions);
  const vitals = vitalsByPhase(scenario.vital_sign_progressions);
  const phases = buildPhaseSections(scenario.expected_interventions, scenario.vital_sign_progressions);
  const oral = buildOralSections(scenario.oral_board_domains);
  const fullLines = buildFullTextLines(scenario.full_content);
  const age = scenario.patient_age !== null && scenario.patient_age !== undefined ? String(scenario.patient_age) : '';
  const gender = scenario.patient_gender === 'M' ? 'Male' : scenario.patient_gender === 'F' ? 'Female' : scenario.patient_gender || '';
  const hasPatient = scenario.patient_name || age || gender || scenario.chief_complaint;

  const row = (label: string, value: string) => (
    <div key={label} className="flex gap-2 flex-wrap">
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );

  return (
    <div className="w-full space-y-5 text-base leading-relaxed text-slate-800 dark:text-slate-200">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white text-xl font-bold flex-shrink-0">{L}</span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scenario {L}{scenario.title ? `: ${scenario.title}` : ''}</h1>
      </div>

      {scenario.instructor_notes && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-300 flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5" /> Instructor notes (read first)
          </h2>
          <div className="text-red-900 dark:text-red-200 whitespace-pre-wrap">{scenario.instructor_notes}</div>
        </div>
      )}

      {dispatch.length > 0 && (
        <div className={card}>
          <h2 className={h2}><FileText className="h-5 w-5 text-orange-500" /> Dispatch</h2>
          <div className="space-y-1">
            {dispatch.map((d, i) => (
              <div key={i}>
                {d.label && <span className="text-slate-500 dark:text-slate-400">{d.label}: </span>}
                <span className="font-medium text-slate-900 dark:text-white">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasPatient && (
        <div className={card}>
          <h2 className={h2}><Stethoscope className="h-5 w-5 text-blue-500" /> Patient information</h2>
          <div className="space-y-1">
            {scenario.patient_name && row('Name', scenario.patient_name)}
            {age && row('Age', age)}
            {gender && row('Gender', gender)}
            {scenario.chief_complaint && row('Chief complaint', scenario.chief_complaint)}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-300 dark:border-amber-700 p-5">
          <h2 className="text-lg font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-3">Critical actions (must perform)</h2>
          <ol className="space-y-2">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">{i + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {vitals.length > 0 && (
        <div className={card}>
          <h2 className={h2}><Activity className="h-5 w-5 text-green-500" /> Vital sign progressions</h2>
          <div className="space-y-3">
            {vitals.map(p => {
              const open = !collapsed.has(p.phase);
              return (
                <div key={p.phase} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                  <button
                    onClick={() => toggle(p.phase)}
                    aria-expanded={open}
                    className="w-full min-h-[44px] flex items-center justify-between px-4 py-2 text-left"
                  >
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-bold">{p.phase}</span>
                      {p.title}
                    </span>
                    <span className="print:hidden">{open ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-3">
                      {p.sets.map((set, si) => (
                        <div key={si}>
                          {p.sets.length > 1 && <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">set {si + 1}</p>}
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3">
                            {orderedKeys(set).map(k => (
                              <div key={k} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{k}</div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">{set[k]}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {p.sets.length > 1 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Where a phase has two sets, see that phase in the full case text for which path each belongs to.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phases.length > 0 && (
        <div className={card}>
          <h2 className={h2}><ClipboardList className="h-5 w-5 text-purple-500" /> Expected interventions by phase</h2>
          <div className="space-y-4">
            {phases.map(p => (
              <div key={p.phase}>
                <h3 className="font-bold">Phase {p.phase}{p.title ? `: ${p.title}` : ''}</h3>
                {p.actions.length > 0 && <ul className="list-disc pl-6 space-y-1 mt-1">{p.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
                {p.cues && (
                  <p className="mt-2"><span className="font-semibold text-slate-500 dark:text-slate-400">Instructor cues: </span>{p.cues}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {oral.length > 0 && (
        <div className={card}>
          <h2 className={h2}><ClipboardList className="h-5 w-5 text-indigo-500" /> Oral board / debrief discussion points</h2>
          {oral.map((s, si) => (
            <div key={si} className={si > 0 ? 'mt-3' : ''}>
              {s.heading && <h3 className="font-bold mb-1">{s.heading}</h3>}
              <ol className="space-y-2">
                {s.items.map((q, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">{i + 1}</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {fullLines.length > 0 && (
        <div className={`${card} print:hidden`}>
          <button onClick={() => setShowFull(s => !s)} className="min-h-[44px] flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            <FileText className="h-5 w-5" />
            {showFull ? 'Hide' : 'Show'} full case text
          </button>
          {showFull && (
            <div className="mt-2 space-y-1">
              {fullLines.map((l, i) =>
                l.heading ? <h3 key={i} className="font-bold tracking-wide pt-3 text-slate-900 dark:text-white">{l.text}</h3> : <p key={i}>{l.text}</p>,
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
