'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface ScenarioReferencePanelProps {
  scenario: {
    id: string;
    title: string;
    skill_code: string;
    scenario_data: Record<string, unknown>;
  } | null;
  defaultCollapsed?: boolean;
}

type HistoryObj = Record<string, unknown>;
type VitalsObj = Record<string, unknown>;

const HISTORY_LABELS: Array<[string, string]> = [
  ['onset', 'Onset'],
  ['provocation', 'Provocation'],
  ['quality', 'Quality'],
  ['radiation', 'Radiation'],
  ['severity', 'Severity'],
  ['time', 'Time'],
  ['interventions', 'Interventions'],
];

const VITALS_LABELS: Array<[string, string]> = [
  ['bp', 'BP'],
  ['pulse', 'Pulse'],
  ['respirations', 'Respirations'],
  ['spo2', 'SpO2'],
  ['skin', 'Skin'],
  ['pupils', 'Pupils'],
  ['gcs', 'GCS'],
  ['blood_glucose', 'Blood Glucose'],
  ['temperature', 'Temperature'],
  ['etco2', 'EtCO2'],
];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        {title}
      </h4>
      <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}

function VitalsGrid({ vitals }: { vitals: VitalsObj }) {
  const entries = VITALS_LABELS.filter(([k]) => isNonEmptyString(vitals[k]));
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
      {entries.map(([k, label]) => (
        <div key={k} className="text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {label}:
          </span>{' '}
          <span className="text-gray-800 dark:text-gray-200">
            {String(vitals[k])}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScenarioBody({
  scenario,
}: {
  scenario: NonNullable<ScenarioReferencePanelProps['scenario']>;
}) {
  const d = scenario.scenario_data || {};

  const dispatch = isNonEmptyString(d.dispatch) ? d.dispatch : null;
  const mechanism = isNonEmptyString(d.mechanism) ? d.mechanism : null;
  const sceneSafety = isNonEmptyString(d.scene_safety) ? d.scene_safety : null;
  const chiefComplaint = isNonEmptyString(d.chief_complaint)
    ? d.chief_complaint
    : null;
  const initialPresentation = isNonEmptyString(d.initial_presentation)
    ? d.initial_presentation
    : null;
  const history = isObject(d.history) ? (d.history as HistoryObj) : null;
  const bystanderInfo = isNonEmptyString(d.bystander_info)
    ? d.bystander_info
    : null;
  const medicalHistory = isNonEmptyString(d.medical_history)
    ? d.medical_history
    : null;
  const medicationsRaw = d.medications;
  const medicationsList = Array.isArray(medicationsRaw)
    ? (medicationsRaw as unknown[]).filter(isNonEmptyString)
    : null;
  const medicationsText = isNonEmptyString(medicationsRaw) ? medicationsRaw : null;
  const hasMedications =
    (medicationsList && medicationsList.length > 0) || medicationsText !== null;
  const allergies = isNonEmptyString(d.allergies) ? d.allergies : null;
  const lastMeal = isNonEmptyString(d.last_meal) ? d.last_meal : null;
  const physicalFindings = isNonEmptyString(d.physical_findings)
    ? d.physical_findings
    : null;
  const injuries = Array.isArray(d.injuries)
    ? (d.injuries as unknown[]).filter(isNonEmptyString)
    : null;
  const initialVitals = isObject(d.initial_vitals)
    ? (d.initial_vitals as VitalsObj)
    : null;
  const vitalsWithTreatment = isObject(d.vitals_with_treatment)
    ? (d.vitals_with_treatment as VitalsObj)
    : null;
  const vitalsWithoutTreatment = isObject(d.vitals_without_treatment)
    ? (d.vitals_without_treatment as VitalsObj)
    : null;
  const proctorNotes = isNonEmptyString(d.proctor_notes) ? d.proctor_notes : null;

  const historyEntries = history
    ? HISTORY_LABELS.filter(([k]) => isNonEmptyString(history[k]))
    : [];

  return (
    <div className="px-4 py-3">
      <p className="text-xs italic text-gray-500 dark:text-gray-400 mb-3">
        For proctor reference. Do not read aloud unless instructed.
      </p>

      {(dispatch || mechanism) && (
        <Section title="Dispatch">
          {dispatch && (
            <p className="font-bold text-gray-900 dark:text-gray-100">
              {dispatch}
            </p>
          )}
          {mechanism && (
            <p className="mt-2">
              <span className="font-semibold">Mechanism of Injury:</span>{' '}
              {mechanism}
            </p>
          )}
        </Section>
      )}

      {sceneSafety && <Section title="Scene Safety">{sceneSafety}</Section>}

      {chiefComplaint && <Section title="Chief Complaint">{chiefComplaint}</Section>}
      {initialPresentation && (
        <Section title="Initial Presentation">{initialPresentation}</Section>
      )}

      {historyEntries.length > 0 && (
        <Section title="History (OPQRST)">
          <div className="space-y-1">
            {historyEntries.map(([k, label]) => (
              <div key={k}>
                <span className="font-semibold">{label}:</span>{' '}
                {String((history as HistoryObj)[k])}
              </div>
            ))}
          </div>
        </Section>
      )}

      {bystanderInfo && <Section title="Bystander Info">{bystanderInfo}</Section>}
      {medicalHistory && <Section title="Medical History">{medicalHistory}</Section>}

      {hasMedications && (
        <Section title="Medications">
          {medicationsList && medicationsList.length > 0 ? (
            <ul className="list-disc list-inside space-y-0.5">
              {medicationsList.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : medicationsText ? (
            <span>{medicationsText}</span>
          ) : null}
        </Section>
      )}

      {allergies && <Section title="Allergies">{allergies}</Section>}
      {lastMeal && <Section title="Last Meal">{lastMeal}</Section>}

      {injuries && injuries.length > 0 && (
        <Section title="Injuries">
          <ul className="list-disc list-inside space-y-0.5">
            {injuries.map((inj, i) => (
              <li key={i}>{inj}</li>
            ))}
          </ul>
        </Section>
      )}
      {physicalFindings && (
        <Section title="Physical Findings">
          <p>{physicalFindings}</p>
        </Section>
      )}

      {initialVitals && (
        <Section title="Initial Vitals">
          <VitalsGrid vitals={initialVitals} />
        </Section>
      )}

      {(vitalsWithTreatment || vitalsWithoutTreatment) && (
        <Section title="Vitals Response">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vitalsWithTreatment && (
              <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                <div className="text-xs font-bold text-green-800 dark:text-green-300 uppercase tracking-wide mb-2">
                  With Appropriate Treatment
                </div>
                <VitalsGrid vitals={vitalsWithTreatment} />
              </div>
            )}
            {vitalsWithoutTreatment && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <div className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wide mb-2">
                  Without Treatment
                </div>
                <VitalsGrid vitals={vitalsWithoutTreatment} />
              </div>
            )}
          </div>
        </Section>
      )}

      {proctorNotes && (
        <div className="mt-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-1">
            ⚠️ Proctor Reference Only — Do Not Read to Candidate
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
            {proctorNotes}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ScenarioReferencePanel({
  scenario,
  defaultCollapsed = false,
}: ScenarioReferencePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when mobile modal is open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  if (!scenario) return null;

  return (
    <>
      {/* Mobile: button that opens full-screen modal */}
      <div className="lg:hidden mb-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30"
        >
          <span>📋</span>
          <span>View Scenario — {scenario.title}</span>
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>📋</span>
                <span>Scenario Reference — {scenario.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                aria-label="Close scenario reference"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ScenarioBody scenario={scenario} />
          </div>
        )}
      </div>

      {/* Desktop: collapsible inline card */}
      <div className="hidden lg:block mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          aria-expanded={!collapsed}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">📋</span>
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
              Scenario Reference — {scenario.title}
            </span>
          </div>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
          )}
        </button>
        {!collapsed && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <ScenarioBody scenario={scenario} />
          </div>
        )}
      </div>
    </>
  );
}
