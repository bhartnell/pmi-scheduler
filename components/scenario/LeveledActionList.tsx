'use client';

import { ACTION_LEVELS, hasLeveledActions, parseLeveledActions } from '@/lib/scenario-actions';

interface LeveledActionListProps {
  /** string, string[] or legacy shapes; [EMT]/[AEMT]/[Paramedic] prefixes are grouped. */
  actions: unknown;
  /** Tailwind classes for the text size/color of the list. */
  textClassName?: string;
}

/**
 * Expected actions as short labeled lists (EMT, AEMT, Paramedic), one action
 * per line. Unprefixed lines render first as a plain list. Shared by the lab
 * station grader, the standalone scenario view and the megacode pane.
 */
export default function LeveledActionList({
  actions,
  textClassName = 'text-sm text-gray-600 dark:text-gray-400',
}: LeveledActionListProps) {
  const parsed = parseLeveledActions(actions);
  if (!hasLeveledActions(parsed)) return null;

  return (
    <div className={`space-y-1.5 ${textClassName}`}>
      {parsed.plain.length > 0 && (
        <ul className="list-disc list-inside">
          {parsed.plain.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {ACTION_LEVELS.map((level) =>
        parsed[level].length > 0 ? (
          <div key={level}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {level}
            </div>
            <ul className="list-disc list-inside">
              {parsed[level].map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}
    </div>
  );
}
