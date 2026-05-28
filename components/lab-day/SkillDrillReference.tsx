'use client';

/**
 * SkillDrillReference — inline drill reference renderer.
 *
 * Same content as /labs/skill-drills/[id]/page.tsx, packaged as a
 * standalone component so the grade view (and any future surface)
 * can drop it in without duplicating layout. Fetches the drill by
 * id from /api/lab-management/skill-drills/[id].
 *
 * Renders in two modes:
 *   compact=false (default) — full sections (concept → run steps →
 *     equipment → setups → instructor notes), suitable for a
 *     dedicated panel.
 *   compact=true — collapsible card style with header + brief
 *     summary, expand-to-see-full toggle. Good for grade view where
 *     multiple drills may stack on one screen.
 *
 * Print is handled by the *parent* page's print stylesheet — this
 * component just renders semantic content. Callers wanting a Print
 * button should add their own that calls window.print().
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ListChecks,
  Wrench,
  Settings,
  FileText,
  Clock,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

interface SetupBlock {
  label: string;
  count: number;
  items: string[];
  notes: string | null;
}

interface DrillData {
  concept?: string;
  students_per_setup?: number | null;
  instructor_notes?: string | null;
  equipment?: string[];
  setups?: SetupBlock[];
  run_steps?: string[];
}

interface SkillDrill {
  id: string;
  name: string;
  program: string;
  semester: number | null;
  category: string | null;
  estimated_duration_minutes: number | null;
  description: string | null;
  equipment_needed: string | null;
  instructions: string | null;
  drill_data: DrillData | null;
}

interface SkillDrillReferenceProps {
  drillId: string;
  /** When true, render as a collapsible card (header always visible,
   *  sections behind an expand toggle). Default false = expanded. */
  compact?: boolean;
  /** When true, hide the "Open full reference" link. Default false. */
  hideOpenLink?: boolean;
}

export default function SkillDrillReference({
  drillId,
  compact = false,
  hideOpenLink = false,
}: SkillDrillReferenceProps) {
  const [drill, setDrill] = useState<SkillDrill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lab-management/skill-drills/${drillId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.drill) {
          setDrill(data.drill);
        } else {
          setError(data.error ?? 'Drill not found');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drillId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
        Loading drill reference…
      </div>
    );
  }
  if (error || !drill) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        {error || 'Drill not found'}
      </div>
    );
  }

  const d: DrillData = drill.drill_data ?? {};
  const concept = (d.concept ?? drill.description ?? '').trim();
  const runSteps = Array.isArray(d.run_steps)
    ? d.run_steps
    : (drill.instructions ?? '').split('\n').filter(Boolean);
  const equipment = Array.isArray(d.equipment)
    ? d.equipment
    : (drill.equipment_needed ?? '').split('\n').filter(Boolean);
  const setups = Array.isArray(d.setups) ? d.setups : [];
  const studentsPerSetup =
    typeof d.students_per_setup === 'number' ? d.students_per_setup : null;
  const instructorNotes = (d.instructor_notes ?? '').trim();

  return (
    <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-900/10 overflow-hidden">
      {/* Header — always visible */}
      <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-orange-900 dark:text-orange-100">
            {drill.name}
          </h3>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-orange-700 dark:text-orange-300">
            <span className="px-1.5 py-0.5 rounded bg-orange-200 dark:bg-orange-800/60 font-medium uppercase">
              {drill.program}
              {drill.semester != null && ` · S${drill.semester}`}
            </span>
            {drill.estimated_duration_minutes != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {drill.estimated_duration_minutes} min/rotation
              </span>
            )}
            {studentsPerSetup != null && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" /> {studentsPerSetup}/setup
              </span>
            )}
            {drill.category && (
              <span className="text-orange-600 dark:text-orange-400">{drill.category}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!hideOpenLink && (
            <Link
              href={`/labs/skill-drills/${drill.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40"
              title="Open full reference + print view"
            >
              <ExternalLink className="w-3 h-3" />
              Open / Print
            </Link>
          )}
          {compact && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="p-1 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* 1. Concept */}
          {concept && (
            <section>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-gray-500" /> Concept
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{concept}</p>
            </section>
          )}

          {/* 2. How the station runs */}
          {runSteps.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-gray-500" /> How the station runs
              </h4>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {runSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </section>
          )}

          {/* 3. Equipment */}
          {equipment.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-gray-500" /> Equipment
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                {equipment.map((e, i) => (
                  <li key={i} className="before:content-['•'] before:mr-1.5 before:text-gray-400">
                    {e}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 4. Setup configurations */}
          {setups.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-gray-500" /> Setup configurations
              </h4>
              <div className="space-y-2">
                {setups.map((s, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {s.label || `Setup ${i + 1}`}
                      </span>
                      {typeof s.count === 'number' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">×{s.count}</span>
                      )}
                    </div>
                    {s.items && s.items.length > 0 && (
                      <ul className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                        {s.items.map((it, j) => (
                          <li key={j}>{it}</li>
                        ))}
                      </ul>
                    )}
                    {s.notes && (
                      <div className="mt-2 px-2 py-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400 text-xs text-amber-800 dark:text-amber-200">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <div>{s.notes}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 5. Instructor notes (always last) */}
          {instructorNotes && (
            <section className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Instructor notes
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {instructorNotes}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
