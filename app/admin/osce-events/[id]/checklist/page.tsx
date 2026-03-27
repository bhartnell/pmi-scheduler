'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  ClipboardList,
  CalendarCheck,
  Stethoscope,
  UserCheck,
  FolderCheck,
} from 'lucide-react';

// ─── Checklist Definition ─────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  hasInput?: boolean;
  inputPlaceholder?: string;
  inputType?: 'number' | 'text';
}

interface ChecklistSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
}

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: 'pre-event',
    title: 'Pre-Event Setup',
    icon: <ClipboardList className="w-5 h-5" />,
    items: [
      { id: 'wifi-confirmed', label: 'WiFi confirmed working at EMS Annex', },
      { id: 'tablets-charged', label: 'Tablets charged and ready', hasInput: true, inputPlaceholder: 'Qty', inputType: 'number' },
      { id: 'pin-tested', label: 'PIN tested on each tablet: OSCE2026' },
      { id: 'paper-sheets-printed', label: 'Paper scoring sheets printed as backup' },
      { id: 'guest-evaluator-list', label: 'Guest evaluator list confirmed' },
      { id: 'scenario-assignments', label: 'Scenario assignments finalized (A/B/D/E/F)' },
      { id: 'student-schedule-posted', label: 'Student schedule posted' },
      { id: 'medical-directors-confirmed', label: 'Medical Directors confirmed' },
    ],
  },
  {
    id: 'day1-morning',
    title: 'Day 1 Morning (0900\u20131230)',
    icon: <UserCheck className="w-5 h-5" />,
    items: [
      { id: 'evaluators-checked-in', label: 'Evaluators checked in and logged into system' },
      { id: 'slot1-porfirio', label: 'Slot 1 \u2014 PORFIRIO: Evaluators ready' },
      { id: 'slot2-gifford', label: 'Slot 2 \u2014 GIFFORD: Evaluators ready' },
      { id: 'slot3-johnson', label: 'Slot 3 \u2014 JOHNSON: Evaluators ready' },
      { id: 'slot4-solari', label: 'Slot 4 \u2014 SOLARI: Evaluators ready' },
      { id: 'slot5-miranda', label: 'Slot 5 \u2014 MIRANDA: Evaluators ready' },
      { id: 'slot6-bilharz', label: 'Slot 6 \u2014 BILHARZ: Evaluators ready' },
    ],
  },
  {
    id: 'day1-early-afternoon',
    title: 'Day 1 Early Afternoon (1330\u20131500)',
    icon: <CalendarCheck className="w-5 h-5" />,
    items: [
      { id: 'slot7-nixon', label: 'Slot 7 \u2014 NIXON: Evaluators ready' },
      { id: 'slot8-grahovac', label: 'Slot 8 \u2014 GRAHOVAC: Evaluators ready' },
    ],
  },
  {
    id: 'day1-late-afternoon',
    title: 'Day 1 Late Afternoon (1500\u20131700)',
    icon: <Stethoscope className="w-5 h-5" />,
    items: [
      { id: 'dr-barnum-arrived', label: 'Dr. Barnum arrived' },
      { id: 'slot9-cottrell', label: 'Slot 9 \u2014 COTTRELL' },
      { id: 'slot10-ruiz', label: 'Slot 10 \u2014 RUIZ' },
      { id: 'slot11-acosta', label: 'Slot 11 \u2014 ACOSTA' },
      { id: 'slot12-zentek', label: 'Slot 12 \u2014 ZENTEK' },
      { id: 'slot13-jakicevic', label: 'Slot 13 \u2014 JAKICEVIC' },
    ],
  },
  {
    id: 'day2-afternoon',
    title: 'Day 2 Afternoon (1300\u20131700)',
    icon: <CalendarCheck className="w-5 h-5" />,
    items: [
      { id: 'slot14-sarellano-lopez', label: 'Slot 14 \u2014 SARELLANO LOPEZ' },
      { id: 'slot15-sullivan', label: 'Slot 15 \u2014 SULLIVAN' },
      { id: 'slot16-caha', label: 'Slot 16 \u2014 CAHA' },
      { id: 'slot17-smith', label: 'Slot 17 \u2014 SMITH' },
      { id: 'slot18-kennedy', label: 'Slot 18 \u2014 KENNEDY' },
      { id: 'slot19-williams', label: 'Slot 19 \u2014 WILLIAMS' },
    ],
  },
  {
    id: 'post-event',
    title: 'Post-Event',
    icon: <FolderCheck className="w-5 h-5" />,
    items: [
      { id: 'all-scores-submitted', label: 'All evaluator scores submitted' },
      { id: 'score-reconciliation', label: 'Score reconciliation complete' },
      { id: 'csv-exported', label: 'CSV exported for gradebook' },
      { id: 'paper-backups-filed', label: 'Paper backups collected and filed' },
    ],
  },
];

// Total item count
const TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

// ─── Types for state ──────────────────────────────────────────────────────────

interface CheckState {
  [itemId: string]: boolean;
}

interface InputState {
  [itemId: string]: string;
}

interface FullChecklistState {
  checks: CheckState;
  inputs: InputState;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function OsceChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [eventId, setEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checks, setChecks] = useState<CheckState>({});
  const [inputs, setInputs] = useState<InputState>({});
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(p => setEventId(p.id));
  }, [params]);

  // Fetch checklist state + event title
  const fetchData = useCallback(async () => {
    if (!eventId) return;
    try {
      const [checklistRes, eventRes] = await Promise.all([
        fetch(`/api/osce/events/${eventId}/checklist`),
        fetch(`/api/osce/events/${eventId}`),
      ]);

      if (checklistRes.ok) {
        const data = await checklistRes.json();
        const state: FullChecklistState = data.checklist_state || {};
        setChecks(state.checks || {});
        setInputs(state.inputs || {});
      }

      if (eventRes.ok) {
        const data = await eventRes.json();
        setEventTitle(data.event?.title || 'OSCE Event');
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (authStatus === 'authenticated' && eventId) fetchData();
  }, [authStatus, eventId, fetchData]);

  // Save to DB (debounced)
  const saveState = useCallback(
    (newChecks: CheckState, newInputs: InputState) => {
      if (!eventId) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);

      saveTimeout.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/osce/events/${eventId}/checklist`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              checklist_state: { checks: newChecks, inputs: newInputs },
            }),
          });
        } catch {
          /* ignore */
        }
        setSaving(false);
      }, 500);
    },
    [eventId]
  );

  // Toggle a checkbox
  const toggleCheck = (itemId: string) => {
    setChecks(prev => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      saveState(next, inputs);
      return next;
    });
  };

  // Update an input value
  const updateInput = (itemId: string, value: string) => {
    setInputs(prev => {
      const next = { ...prev, [itemId]: value };
      saveState(checks, next);
      return next;
    });
  };

  // Count completed
  const completedCount = Object.values(checks).filter(Boolean).length;

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (authStatus === 'loading' || loading || !eventId) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading checklist...
      </div>
    );
  }

  // Progress percentage
  const progressPct = TOTAL_ITEMS > 0 ? Math.round((completedCount / TOTAL_ITEMS) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => router.push(`/admin/osce-events/${eventId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to event
      </button>

      {/* Title + progress */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Day-of Checklist
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {eventTitle}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {completedCount}/{TOTAL_ITEMS} complete
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              backgroundColor: progressPct === 100 ? '#22c55e' : '#3b82f6',
            }}
          />
        </div>
        {saving && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </p>
        )}
        {progressPct === 100 && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
            All items complete!
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {CHECKLIST_SECTIONS.map(section => {
          const sectionCompleted = section.items.filter(i => checks[i.id]).length;
          const sectionTotal = section.items.length;

          return (
            <div
              key={section.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2.5">
                  <span className="text-gray-500 dark:text-gray-400">
                    {section.icon}
                  </span>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {section.title}
                  </h2>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  sectionCompleted === sectionTotal
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {sectionCompleted}/{sectionTotal}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {section.items.map(item => {
                  const isChecked = !!checks[item.id];

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${
                        isChecked
                          ? 'bg-green-50 dark:bg-green-950/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                      }`}
                      onClick={() => toggleCheck(item.id)}
                    >
                      {/* Checkbox */}
                      <div className="flex-shrink-0">
                        {isChecked ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={`flex-1 text-sm ${
                          isChecked
                            ? 'text-green-700 dark:text-green-400 line-through'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {item.label}
                      </span>

                      {/* Optional input */}
                      {item.hasInput && (
                        <input
                          type={item.inputType || 'text'}
                          placeholder={item.inputPlaceholder}
                          value={inputs[item.id] || ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateInput(item.id, e.target.value)}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
