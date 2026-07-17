'use client';

import { useState } from 'react';

// Renders the OCR'd AHA PALS case narrative (scenarios.pals_narrative -> 'card')
// in the PROGRAM'S assessment order-of-ops (scene/dispatch -> primary
// assessment (PAT + ABCDE) -> objectives/instructor meta), NOT the AHA card's
// front/back layout. Content is the AHA card; layout mirrors how the program
// runs every lab scenario so instructors follow one pathway across ACLS/PALS.
// Bedside-usable: vitals boxed and glanceable, primary assessment always
// visible, teaching/instructor-only meta collapsed out of the way.
// See Notion Task Handoff Queue "PALS scenario view..." (2026-07-16/17) for
// the design history behind this structure.

export interface PalsCard {
  overview?: string;
  objectives?: string[];
  lead_in?: Record<string, string>;
  default_setting?: string;
  initial_vitals?: Record<string, string>;
  instructor_note?: string;
  debrief_question?: string;
  paramedic_scope_na_candidates?: string[];
  flow?: {
    identify?: string;
    intervene?: string[];
    evaluate_initial_pat?: Record<string, string>;
    evaluate_primary_abcde?: Record<string, string>;
    identify_after_primary?: string[];
    intervene_after_primary?: string[];
  };
}

function fmtKey(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function KeyValueGrid({ data }: { data: Record<string, string> }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{fmtKey(k)}</dt>
          <dd className="text-sm text-gray-800 dark:text-gray-100">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One color-coded band in the assessment flow (Evaluate / Identify / Intervene). */
function PhaseBand({
  label, color, children,
}: {
  label: string;
  color: 'blue' | 'amber' | 'green';
  children: React.ReactNode;
}) {
  const colorClasses = {
    blue: 'border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-900/10',
    amber: 'border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-900/10',
    green: 'border-green-400 dark:border-green-600 bg-green-50/60 dark:bg-green-900/10',
  }[color];
  const labelClasses = {
    blue: 'text-blue-700 dark:text-blue-300',
    amber: 'text-amber-700 dark:text-amber-300',
    green: 'text-green-700 dark:text-green-300',
  }[color];
  return (
    <div className={`border-l-4 rounded-r-md px-3 py-2 ${colorClasses}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelClasses}`}>{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-100">{children}</div>
    </div>
  );
}

export default function PalsCaseCard({ card }: { card: PalsCard | null | undefined }) {
  const settings = Object.keys(card?.lead_in || {});
  const [setting, setSetting] = useState(card?.default_setting && settings.includes(card.default_setting) ? card.default_setting : settings[0]);

  if (!card) return null;

  const flow = card.flow;

  return (
    <div className="space-y-3 mt-3">
      {/* 1. Scene / Dispatch */}
      {settings.length > 0 && (
        <div className="border-l-4 border-gray-400 dark:border-gray-500 rounded-r-md px-3 py-2 bg-gray-50 dark:bg-gray-700/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Scene / Dispatch</span>
            {settings.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {settings.map((s) => (
                  <button key={s} type="button" onClick={() => setSetting(s)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      setting === s
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}>
                    {fmtKey(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
            {setting ? card.lead_in?.[setting] : null}
          </p>
        </div>
      )}

      {/* 2. Patient info & vitals — boxed, glanceable */}
      {card.initial_vitals && Object.keys(card.initial_vitals).length > 0 && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800">
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Patient Info &amp; Vitals</div>
          <KeyValueGrid data={card.initial_vitals} />
        </div>
      )}

      {/* 3. Primary assessment — PAT -> identify -> intervene -> ABCDE -> identify -> intervene */}
      {flow && (flow.evaluate_initial_pat || flow.evaluate_primary_abcde) && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Primary Assessment</div>

          {flow.evaluate_initial_pat && (
            <PhaseBand label="Evaluate — General Impression (PAT)" color="blue">
              <KeyValueGrid data={flow.evaluate_initial_pat} />
            </PhaseBand>
          )}
          {flow.identify && (
            <PhaseBand label="Identify" color="amber">{flow.identify}</PhaseBand>
          )}
          {flow.intervene && flow.intervene.length > 0 && (
            <PhaseBand label="Intervene" color="green">
              <ul className="list-disc list-inside space-y-0.5">{flow.intervene.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </PhaseBand>
          )}
          {flow.evaluate_primary_abcde && (
            <PhaseBand label="Evaluate — Primary (ABCDE)" color="blue">
              <KeyValueGrid data={flow.evaluate_primary_abcde} />
            </PhaseBand>
          )}
          {flow.identify_after_primary && flow.identify_after_primary.length > 0 && (
            <PhaseBand label="Identify" color="amber">
              <ul className="list-disc list-inside space-y-0.5">{flow.identify_after_primary.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </PhaseBand>
          )}
          {flow.intervene_after_primary && flow.intervene_after_primary.length > 0 && (
            <PhaseBand label="Intervene" color="green">
              <ul className="list-disc list-inside space-y-0.5">{flow.intervene_after_primary.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </PhaseBand>
          )}
        </div>
      )}

      {/* 4. Teaching / instructor-only meta — de-emphasized, collapsed by default */}
      {(card.overview || (card.objectives && card.objectives.length > 0) || card.instructor_note || card.debrief_question ||
        (card.paramedic_scope_na_candidates && card.paramedic_scope_na_candidates.length > 0)) && (
        <details className="text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400">Instructor / teaching notes</summary>
          <div className="mt-2 space-y-2.5">
            {card.overview && (
              <p className="text-sm text-gray-700 dark:text-gray-300">{card.overview}</p>
            )}

            {card.objectives && card.objectives.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Objectives</div>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                  {card.objectives.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            )}

            {card.instructor_note && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Instructor note (not for students):</span> {card.instructor_note}
              </div>
            )}

            {card.debrief_question && (
              <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">Debrief:</span> {card.debrief_question}</p>
            )}

            {card.paramedic_scope_na_candidates && card.paramedic_scope_na_candidates.length > 0 && (
              <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded p-2 text-xs text-sky-800 dark:text-sky-300">
                <span className="font-semibold">Possible out-of-paramedic-scope items for this case:</span>{' '}
                {card.paramedic_scope_na_candidates.join(', ')} — cross-reference against the checklist below; mark N/A per the tester&apos;s actual scope, not this list alone.
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
