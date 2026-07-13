'use client';

import { useState } from 'react';

// Renders the OCR'd AHA PALS case narrative (scenarios.pals_narrative -> 'card').
// Same shape across practice + testing cases (see docs/pals/pals_scenario_seed.json /
// the narrative loader). Unknown/future keys are ignored rather than guessed at.

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

export default function PalsCaseCard({ card }: { card: PalsCard | null | undefined }) {
  const settings = Object.keys(card?.lead_in || {});
  const [setting, setSetting] = useState(card?.default_setting && settings.includes(card.default_setting) ? card.default_setting : settings[0]);

  if (!card) return null;

  return (
    <div className="space-y-3">
      {card.overview && (
        <p className="text-sm text-gray-700 dark:text-gray-300">{card.overview}</p>
      )}

      {settings.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {settings.map((s) => (
              <button key={s} type="button" onClick={() => setSetting(s)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  setting === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}>
                {fmtKey(s)}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 italic whitespace-pre-wrap">
            {setting ? card.lead_in?.[setting] : null}
          </p>
        </div>
      )}

      {card.initial_vitals && Object.keys(card.initial_vitals).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {Object.entries(card.initial_vitals).map(([k, v]) => (
            <div key={k} className="bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
              <div className="text-gray-400">{fmtKey(k)}</div>
              <div className="font-medium text-gray-800 dark:text-gray-100">{String(v)}</div>
            </div>
          ))}
        </div>
      )}

      {card.objectives && card.objectives.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Objectives</div>
          <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
            {card.objectives.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}

      {card.flow && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400">Case flow (identify / intervene)</summary>
          <div className="mt-1.5 space-y-2 text-gray-700 dark:text-gray-300">
            {card.flow.identify && <p><span className="font-medium">Identify:</span> {card.flow.identify}</p>}
            {card.flow.evaluate_initial_pat && (
              <p><span className="font-medium">Initial PAT:</span> {Object.entries(card.flow.evaluate_initial_pat).map(([k, v]) => `${fmtKey(k)}: ${v}`).join(' • ')}</p>
            )}
            {card.flow.evaluate_primary_abcde && (
              <p><span className="font-medium">Primary (ABCDE):</span> {Object.entries(card.flow.evaluate_primary_abcde).map(([k, v]) => `${fmtKey(k)}: ${v}`).join(' • ')}</p>
            )}
            {card.flow.intervene && card.flow.intervene.length > 0 && (
              <ul className="list-disc list-inside">{card.flow.intervene.map((s, i) => <li key={i}>{s}</li>)}</ul>
            )}
            {card.flow.identify_after_primary && card.flow.identify_after_primary.length > 0 && (
              <p><span className="font-medium">Identify after primary:</span> {card.flow.identify_after_primary.join(', ')}</p>
            )}
            {card.flow.intervene_after_primary && card.flow.intervene_after_primary.length > 0 && (
              <ul className="list-disc list-inside">{card.flow.intervene_after_primary.map((s, i) => <li key={i}>{s}</li>)}</ul>
            )}
          </div>
        </details>
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
  );
}
