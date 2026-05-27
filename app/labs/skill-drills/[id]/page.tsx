'use client';

// Skill Drill reference / print view.
// /labs/skill-drills/[id]
//
// Renders the structured fields per docs/Skill_Drill_Webapp_Brief.md.
// All sections are conditional — only render when data is present —
// per the "flexible sections" requirement. Fixed section order
// (concept → run steps → equipment → setups → instructor notes)
// regardless of which sections are present.
//
// Print-friendly: a Print button triggers window.print(); the
// print stylesheet (@media print) strips chrome and uses serif
// body for the printed version.

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, ListChecks, Wrench, Settings, FileText, Clock, Users, AlertTriangle } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

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

export default function SkillDrillReferencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [drill, setDrill] = useState<SkillDrill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/lab-management/skill-drills/${id}`);
        const data = await res.json();
        if (data.success && data.drill) {
          setDrill(data.drill);
        } else {
          setError(data.error ?? 'Drill not found');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }
  if (error || !drill) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error || 'Drill not found'}
        </div>
        <Link href="/labs" className="mt-4 inline-flex text-sm text-blue-600 hover:underline">← Back to Labs</Link>
      </div>
    );
  }

  const d: DrillData = drill.drill_data ?? {};
  const concept = (d.concept ?? drill.description ?? '').trim();
  const runSteps = Array.isArray(d.run_steps) ? d.run_steps : (drill.instructions ?? '').split('\n').filter(Boolean);
  const equipment = Array.isArray(d.equipment)
    ? d.equipment
    : (drill.equipment_needed ?? '').split('\n').filter(Boolean);
  const setups = Array.isArray(d.setups) ? d.setups : [];
  const studentsPerSetup = typeof d.students_per_setup === 'number' ? d.students_per_setup : null;
  const instructorNotes = (d.instructor_notes ?? '').trim();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 print:p-0 print:max-w-none">
      {/* Top chrome — hidden on print */}
      <div className="print:hidden">
        <Breadcrumbs />
        <div className="flex items-center justify-between mt-3">
          <Link href="/labs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <ArrowLeft className="w-4 h-4" /> Labs
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Print header — only visible on print */}
      <div className="hidden print:block border-b border-gray-300 pb-2 mb-4">
        <div className="text-xs text-gray-600 uppercase tracking-wide">
          {drill.program} {drill.semester != null && `· Semester ${drill.semester}`} · Skill Drill Reference
        </div>
      </div>

      {/* Title + metadata */}
      <header className="border-b border-gray-200 dark:border-gray-700 pb-4 print:border-b-2 print:border-black">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-black print:text-2xl">
          {drill.name}
        </h1>
        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400 print:text-black">
          <span className="inline-flex items-center gap-1">
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 print:bg-transparent print:border print:border-black">
              {drill.program}
              {drill.semester != null && ` · S${drill.semester}`}
            </span>
          </span>
          {drill.estimated_duration_minutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" /> {drill.estimated_duration_minutes} min/rotation
            </span>
          )}
          {studentsPerSetup != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-4 h-4" /> {studentsPerSetup} students/setup
            </span>
          )}
          {drill.category && (
            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 print:text-black">
              {drill.category}
            </span>
          )}
        </div>
      </header>

      {/* 1. Concept */}
      {concept && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2 print:text-black">
            <FileText className="w-5 h-5 text-gray-500 print:hidden" /> Concept
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed print:text-black print:font-serif">
            {concept}
          </p>
        </section>
      )}

      {/* 2. How the station runs */}
      {runSteps.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2 print:text-black">
            <ListChecks className="w-5 h-5 text-gray-500 print:hidden" /> How the station runs
          </h2>
          <ol className="list-decimal pl-6 space-y-1.5 text-gray-700 dark:text-gray-300 print:text-black print:font-serif">
            {runSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {/* 3. Equipment */}
      {equipment.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2 print:text-black">
            <Wrench className="w-5 h-5 text-gray-500 print:hidden" /> Equipment
          </h2>
          {/* Two-column equipment grid mirrors the Word doc reference. */}
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-gray-700 dark:text-gray-300 print:text-black print:font-serif">
            {equipment.map((e, i) => (
              <li key={i} className="before:content-['•'] before:mr-2 before:text-gray-400">
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. Setup configurations */}
      {setups.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2 print:text-black">
            <Settings className="w-5 h-5 text-gray-500 print:hidden" /> Setup configurations
          </h2>
          <div className="space-y-4">
            {setups.map((s, i) => (
              <div
                key={i}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 print:bg-transparent print:border-black"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white print:text-black">
                    {s.label || `Setup ${i + 1}`}
                  </h3>
                  {typeof s.count === 'number' && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 print:text-black">
                      ×{s.count}
                    </span>
                  )}
                </div>
                {s.items && s.items.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-0.5 print:text-black print:font-serif">
                    {s.items.map((it, j) => <li key={j}>{it}</li>)}
                  </ul>
                )}
                {s.notes && (
                  <div className="mt-3 px-3 py-2 rounded bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 text-sm text-amber-800 dark:text-amber-200 print:bg-transparent print:border-l-2 print:border-black print:text-black">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 print:hidden" />
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
        <section className="border-t border-gray-200 dark:border-gray-700 pt-4 print:border-t-2 print:border-black">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 print:text-black">
            Instructor notes
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line print:text-black print:font-serif">
            {instructorNotes}
          </p>
        </section>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-xs text-gray-600 mt-6 pt-2 border-t border-gray-300">
        Generated from PMI Scheduler · /labs/skill-drills/{drill.id}
      </div>
    </div>
  );
}
