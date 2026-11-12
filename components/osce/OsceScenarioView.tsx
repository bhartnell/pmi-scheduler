'use client';

// ONE shared OSCE scenario view. Rendered by the standalone page
// (/osce-scenario/[letter]) and by the left pane of the grading page.
// The case is mapped (mapOsceToScenario) and rendered THROUGH the standard lab
// ScenarioFullDisplay, phases expanded, absent sections hidden. No data invented.

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import ScenarioFullDisplay from '@/components/scenario/ScenarioFullDisplay';
import { type ScenarioApi, buildFullTextLines, mapOsceToScenario } from './scenarioMapping';

const card = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';

export default function OsceScenarioView({ scenario, letter }: { scenario: ScenarioApi; letter?: string }) {
  const [showFull, setShowFull] = useState(false);
  const L = letter || scenario.scenario_letter || '';
  const mapped = useMemo(() => mapOsceToScenario(scenario), [scenario]);
  const fullLines = buildFullTextLines(scenario.full_content);

  return (
    <div className="w-full space-y-5 text-base leading-relaxed text-slate-800 dark:text-slate-200">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white text-xl font-bold flex-shrink-0">{L}</span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scenario {L}{scenario.title ? `: ${scenario.title}` : ''}</h1>
      </div>

      <ScenarioFullDisplay scenario={mapped} expandAllPhases hideEmpty />

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
