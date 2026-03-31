'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

type Rating = 'S' | 'N' | 'U' | null;
type Readiness = 'ready' | 'ready_with_concerns' | 'not_yet_ready' | null;

// Scenario reference data (evaluator-safe, no instructor notes)
interface ScenarioData {
  title: string;
  dispatch: string;
  patient: string;
  age: string;
  setting: string;
  cc: string;
  vitals: { label: string; value: string }[];
  history: string;
  criticalActions: string[];
  oralQuestions: string[];
}

// Parse vital_sign_progressions JSONB into the vitals display format
function parseVitals(progressions: unknown): { label: string; value: string }[] {
  if (!progressions) return [];
  if (Array.isArray(progressions)) {
    return progressions.map((v: { label?: string; value?: string }) => ({
      label: String(v.label || ''),
      value: String(v.value || ''),
    }));
  }
  if (typeof progressions === 'object' && progressions !== null) {
    const obj = progressions as Record<string, unknown>;
    // Try to find phase_1 or "Phase 1" key first
    const phase1 = obj.phase_1 || obj['Phase 1'] || obj['initial'] || obj;
    if (Array.isArray(phase1)) {
      return phase1.map((v: { label?: string; value?: string }) => ({
        label: String(v.label || ''),
        value: String(v.value || ''),
      }));
    }
    if (typeof phase1 === 'object' && phase1 !== null) {
      return Object.entries(phase1 as Record<string, unknown>).map(([k, v]) => ({
        label: k,
        value: String(v),
      }));
    }
  }
  return [];
}

// Parse oral_board_domains JSONB into string array for display
function parseOralQuestions(domains: unknown): string[] {
  if (!domains) return [];
  if (Array.isArray(domains)) {
    return domains.map((d: unknown) => {
      if (typeof d === 'string') return d;
      if (typeof d === 'object' && d !== null) {
        const obj = d as Record<string, unknown>;
        return String(obj.question || obj.text || obj.domain || JSON.stringify(d));
      }
      return String(d);
    });
  }
  return [];
}

// Extract setting/history from full_content text as fallback
function extractFromFullContent(fullContent: string): { setting: string; history: string } {
  let setting = '';
  let history = '';
  if (!fullContent) return { setting, history };

  // Try to extract setting
  const settingMatch = fullContent.match(/(?:Setting|Scene|Location)[:\s]*([^\n]+)/i);
  if (settingMatch) setting = settingMatch[1].trim();

  // Try to extract history
  const historyMatch = fullContent.match(/(?:History|PMH|Past Medical)[:\s]*([^\n]+(?:\n(?!(?:Vital|Assessment|Chief|Dispatch))[^\n]+)*)/i);
  if (historyMatch) history = historyMatch[1].trim();

  return { setting, history };
}

interface Assessment {
  id: string;
  student_name: string;
  scenario: string;
  slot_number: number;
  day_number: number;
  assessment_date: string;
}

interface Score {
  id: string;
  assessment_id: string;
  evaluator_name: string;
  evaluator_role: string | null;
  scene_safety: Rating;
  initial_assessment: Rating;
  history_cc: Rating;
  physical_exam_vs: Rating;
  protocol_treatment: Rating;
  affective_domain: Rating;
  communication: Rating;
  skills_overall: Rating;
  scene_safety_notes: string | null;
  initial_assessment_notes: string | null;
  history_cc_notes: string | null;
  physical_exam_vs_notes: string | null;
  protocol_treatment_notes: string | null;
  affective_domain_notes: string | null;
  communication_notes: string | null;
  skills_overall_notes: string | null;
  oral_prioritization: Rating;
  oral_differential: Rating;
  oral_decision_defense: Rating;
  oral_reassessment: Rating;
  oral_transport_handoff: Rating;
  oral_notes: string | null;
  readiness: Readiness;
  concerns_notes: string | null;
  general_notes: string | null;
  submitted_at: string | null;
}

const SNHD_FACTORS = [
  { key: 'scene_safety', label: 'Scene Safety / PPE' },
  { key: 'initial_assessment', label: 'Initial Assessment' },
  { key: 'history_cc', label: 'History / Chief Complaint' },
  { key: 'physical_exam_vs', label: 'Physical Exam / Vitals' },
  { key: 'protocol_treatment', label: 'Protocol / Treatment' },
  { key: 'affective_domain', label: 'Affective Domain' },
  { key: 'communication', label: 'Communication' },
  { key: 'skills_overall', label: 'Skills / Overall' },
] as const;

const ORAL_DOMAINS = [
  { key: 'oral_prioritization', label: 'Prioritization' },
  { key: 'oral_differential', label: 'Differential Diagnosis' },
  { key: 'oral_decision_defense', label: 'Decision Defense' },
  { key: 'oral_reassessment', label: 'Reassessment Plan' },
  { key: 'oral_transport_handoff', label: 'Transport / Handoff' },
] as const;

function RatingButton({ value, selected, onClick, disabled }: {
  value: 'S' | 'N' | 'U';
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const colors = {
    S: selected ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100',
    N: selected ? 'bg-amber-500 text-white ring-2 ring-amber-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100',
    U: selected ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100',
  };
  const labels = { S: 'Satisfactory', N: 'Needs Improvement', U: 'Unsatisfactory' };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-h-[60px] min-w-[44px] rounded-xl font-bold text-lg transition-all ${colors[value]} ${disabled ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
    >
      <span className="text-2xl block">{value}</span>
      <span className="text-xs block mt-0.5 opacity-80">{labels[value]}</span>
    </button>
  );
}

function FactorCard({ label, ratingKey, notesKey, score, onChange, disabled, expandedNotes, onToggleNotes }: {
  label: string;
  ratingKey: string;
  notesKey: string;
  score: Score;
  onChange: (field: string, value: string | null) => void;
  disabled: boolean;
  expandedNotes: Set<string>;
  onToggleNotes: (key: string) => void;
}) {
  const scoreRecord = score as unknown as Record<string, unknown>;
  const rating = scoreRecord[ratingKey] as Rating;
  const notes = (scoreRecord[notesKey] as string) || '';
  const isExpanded = expandedNotes.has(ratingKey);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">{label}</h3>
        <button
          type="button"
          onClick={() => onToggleNotes(ratingKey)}
          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 px-3 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {isExpanded ? 'Hide Notes' : 'Notes'}
        </button>
      </div>
      <div className="flex gap-2">
        {(['S', 'N', 'U'] as const).map(v => (
          <RatingButton
            key={v}
            value={v}
            selected={rating === v}
            onClick={() => onChange(ratingKey, rating === v ? null : v)}
            disabled={disabled}
          />
        ))}
      </div>
      {isExpanded && (
        <textarea
          value={notes}
          onChange={e => onChange(notesKey, e.target.value)}
          disabled={disabled}
          placeholder="Add notes..."
          className="mt-3 w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none"
          rows={2}
        />
      )}
    </div>
  );
}

function ScenarioPanel({ scenario, letter, fullContent }: { scenario: ScenarioData; letter: string; fullContent?: string | null }) {
  const [showFullContent, setShowFullContent] = useState(false);
  const hasStructuredData = scenario.vitals.length > 0 || scenario.criticalActions.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-600 text-white rounded-xl p-4">
        <p className="text-blue-200 text-xs mb-1">PMI Paramedic Clinical Capstone</p>
        <h2 className="text-lg font-bold">Scenario {letter} — {scenario.title}</h2>
        {scenario.dispatch && <p className="text-blue-100 text-sm mt-1">{scenario.dispatch}</p>}
      </div>

      {/* Patient Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">Patient Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {scenario.patient && <div><span className="text-slate-500 dark:text-slate-400">Patient:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.patient}</span></div>}
          {scenario.age && <div><span className="text-slate-500 dark:text-slate-400">Age/Sex:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.age}</span></div>}
          {scenario.setting && <div className="col-span-2"><span className="text-slate-500 dark:text-slate-400">Setting:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.setting}</span></div>}
          {scenario.cc && <div className="col-span-2"><span className="text-slate-500 dark:text-slate-400">Chief Complaint:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.cc}</span></div>}
        </div>
      </div>

      {/* Vitals */}
      {scenario.vitals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Vital Signs</h3>
          <div className="grid grid-cols-2 gap-2">
            {scenario.vitals.map(v => (
              <div key={v.label} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">{v.label}</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{v.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {scenario.history && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Medical History</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">{scenario.history}</p>
        </div>
      )}

      {/* Critical Actions */}
      {scenario.criticalActions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">Critical Actions</h3>
          <ul className="space-y-1.5">
            {scenario.criticalActions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Oral Board Questions */}
      {scenario.oralQuestions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Oral Board Questions</h3>
          <ol className="space-y-2">
            {scenario.oralQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{q}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Full Content fallback — shown when structured fields are sparse or on demand */}
      {fullContent && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          {hasStructuredData ? (
            <>
              <button
                onClick={() => setShowFullContent(!showFullContent)}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                {showFullContent ? 'Hide Full Scenario Text' : 'Show Full Scenario Text'}
              </button>
              {showFullContent && (
                <pre className="mt-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{fullContent}</pre>
              )}
            </>
          ) : (
            <>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Scenario Details</h3>
              <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{fullContent}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScoringPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.assessmentId as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [evaluator, setEvaluator] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);
  const [showScenario, setShowScenario] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('osce_show_scenario');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [activeTab, setActiveTab] = useState<'scenario' | 'score'>('score');
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChangesRef = useRef<Record<string, unknown>>({});
  const saveQueueRef = useRef<Record<string, unknown>[]>([]);
  const isSubmitted = !!score?.submitted_at;

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); flushQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('osce_evaluator');
    if (!saved) {
      router.push('/osce-scoring/enter');
      return;
    }
    const ev = JSON.parse(saved);
    setEvaluator(ev);

    // Check for test mode
    const sessionStr = localStorage.getItem('osce_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        const pin = session.pin || '';
        const title = session.eventTitle || '';
        if (pin.toUpperCase() === 'TEST2026' || title.includes('TEST') || title.includes('DRY RUN')) {
          setIsTestMode(true);
        }
      } catch { /* ignore */ }
    }

    fetchScore(ev.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // Persist scenario panel preference
  useEffect(() => {
    localStorage.setItem('osce_show_scenario', String(showScenario));
  }, [showScenario]);

  const scenarioLetter = assessment?.scenario?.toUpperCase() || '';

  // Fetch scenario data from database when assessment loads
  useEffect(() => {
    if (!assessment?.scenario) return;
    const letter = assessment.scenario.toUpperCase();
    setScenarioLoading(true);
    fetch(`/api/osce/scenario/${letter}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          const extracted = extractFromFullContent(data.full_content || '');
          setFullContent(data.full_content || null);
          setScenarioData({
            title: data.title || '',
            dispatch: data.dispatch_text || '',
            patient: data.patient_name || '',
            age: data.patient_age ? `${data.patient_age}` : '',
            setting: extracted.setting,
            cc: data.chief_complaint || '',
            vitals: parseVitals(data.vital_sign_progressions),
            history: extracted.history,
            criticalActions: Array.isArray(data.critical_actions) ? data.critical_actions : [],
            oralQuestions: parseOralQuestions(data.oral_board_domains),
          });
        }
      })
      .catch(err => console.error('Failed to fetch scenario:', err))
      .finally(() => setScenarioLoading(false));
  }, [assessment?.scenario]);

  async function fetchScore(evaluatorName: string) {
    try {
      const res = await fetch(`/api/osce/scores/${assessmentId}?evaluator=${encodeURIComponent(evaluatorName)}`);
      const data = await res.json();
      if (data.success) {
        setAssessment(data.assessment);
        setScore(data.score);
      } else {
        console.error('Failed to fetch score:', data.error);
      }
    } catch (err) {
      console.error('Error loading score:', err);
    } finally {
      setLoading(false);
    }
  }

  async function flushQueue() {
    if (!evaluator || saveQueueRef.current.length === 0) return;
    const queue = [...saveQueueRef.current];
    saveQueueRef.current = [];
    // Merge all queued saves into one payload
    const merged: Record<string, unknown> = {};
    for (const item of queue) {
      Object.assign(merged, item);
    }
    try {
      const res = await fetch(`/api/osce/scores/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluator_name: evaluator.name,
          ...merged,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch {
      // Re-queue on failure
      saveQueueRef.current.unshift(merged);
    }
  }

  const debouncedSave = useCallback(async () => {
    if (!evaluator || Object.keys(pendingChangesRef.current).length === 0) return;
    const dataToSave = { ...pendingChangesRef.current };
    pendingChangesRef.current = {};
    setSaving(true);
    try {
      const res = await fetch(`/api/osce/scores/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluator_name: evaluator.name,
          ...dataToSave,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Flush any queued saves too
        if (saveQueueRef.current.length > 0) {
          flushQueue();
        }
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch {
      // Queue for later when back online
      saveQueueRef.current.push(dataToSave);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, evaluator]);

  function handleChange(field: string, value: string | null) {
    if (isSubmitted) return;
    setScore(prev => prev ? { ...prev, [field]: value } as Score : prev);
    pendingChangesRef.current[field] = value;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(debouncedSave, 1000);
  }

  function handleToggleNotes(key: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handlePrintScore() {
    if (!assessment || !score || !evaluator) return;
    const scoreRecord = score as unknown as Record<string, unknown>;

    const readinessMap: Record<string, string> = {
      ready: 'READY FOR FIELD',
      ready_with_concerns: 'READY WITH CONCERNS',
      not_yet_ready: 'NOT YET READY',
    };

    const snhdRows = SNHD_FACTORS.map(f => {
      const rating = (scoreRecord[f.key] as string) || '--';
      const notes = (scoreRecord[`${f.key}_notes`] as string) || '';
      return `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${f.label}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${rating}</td><td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;">${notes}</td></tr>`;
    }).join('');

    const oralRows = ORAL_DOMAINS.map(d => {
      const rating = (scoreRecord[d.key] as string) || '--';
      return `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${d.label}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${rating}</td></tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>OSCE Score Sheet - ${assessment.student_name}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 20px; margin-bottom: 8px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
  th { padding: 6px 10px; border: 1px solid #ddd; background: #f5f5f5; text-align: left; font-size: 12px; }
  .meta { font-size: 13px; color: #555; margin-bottom: 16px; }
  .readiness { font-size: 16px; font-weight: bold; margin: 12px 0; padding: 10px; border: 2px solid #333; text-align: center; }
  .notes { font-size: 12px; color: #333; margin: 6px 0 12px; padding: 8px; background: #f9f9f9; border-radius: 4px; white-space: pre-wrap; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>OSCE Clinical Capstone - Score Sheet</h1>
<p class="meta">
  <strong>Student:</strong> ${assessment.student_name} &nbsp;|&nbsp;
  <strong>Scenario:</strong> ${assessment.scenario} &nbsp;|&nbsp;
  <strong>Slot:</strong> ${assessment.slot_number} &nbsp;|&nbsp;
  <strong>Day:</strong> ${assessment.day_number}<br/>
  <strong>Evaluator:</strong> ${evaluator.name} &nbsp;|&nbsp;
  <strong>Submitted:</strong> ${score.submitted_at ? new Date(score.submitted_at).toLocaleString() : 'Not submitted'}
</p>

<h2>SNHD Evaluation Factors</h2>
<table><thead><tr><th>Factor</th><th style="width:60px;text-align:center;">Rating</th><th>Notes</th></tr></thead><tbody>${snhdRows}</tbody></table>

<h2>Oral Board Domains</h2>
<table><thead><tr><th>Domain</th><th style="width:60px;text-align:center;">Rating</th></tr></thead><tbody>${oralRows}</tbody></table>
${score.oral_notes ? `<div class="notes"><strong>Oral Board Notes:</strong> ${score.oral_notes}</div>` : ''}

<h2>Field Readiness Assessment</h2>
<div class="readiness">${score.readiness ? readinessMap[score.readiness] || score.readiness : 'Not assessed'}</div>
${score.concerns_notes ? `<div class="notes"><strong>Concerns:</strong> ${score.concerns_notes}</div>` : ''}
${score.general_notes ? `<div class="notes"><strong>General Notes:</strong> ${score.general_notes}</div>` : ''}

<p style="font-size:11px;color:#999;margin-top:24px;text-align:center;">Pima Medical Institute &mdash; Paramedic Program &mdash; Spring 2026 Clinical Capstone</p>
</body></html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }

  async function handleSubmit() {
    if (!evaluator || !score?.readiness) return;

    // Flush pending changes first
    if (Object.keys(pendingChangesRef.current).length > 0) {
      await debouncedSave();
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/osce/scores/${assessmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluator_name: evaluator.name }),
      });
      const data = await res.json();
      if (data.success) {
        setScore(data.score);
      } else {
        alert(data.error || 'Submit failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Submit failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!assessment || !score || !evaluator) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Assessment not found</p>
          <button onClick={() => router.push('/osce-scoring/dashboard')} className="text-blue-500 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const scenarioColors: Record<string, string> = {
    A: 'bg-red-500', B: 'bg-blue-500', C: 'bg-green-500',
    D: 'bg-purple-500', E: 'bg-amber-500', F: 'bg-pink-500',
  };

  const readinessOptions = [
    { value: 'ready' as const, label: 'Ready for Field', color: 'bg-green-600 text-white ring-green-400', icon: '✓' },
    { value: 'ready_with_concerns' as const, label: 'Ready w/ Concerns', color: 'bg-amber-500 text-white ring-amber-400', icon: '!' },
    { value: 'not_yet_ready' as const, label: 'Not Yet Ready', color: 'bg-red-600 text-white ring-red-400', icon: '✗' },
  ];

  // Scoring content extracted as a variable for reuse in both mobile and desktop layouts
  const scoringContent = (
    <>
      {isOnline && !isSubmitted && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-2 print:hidden">
          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
          Connected
        </div>
      )}

      {isSubmitted && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
          <p className="text-green-800 dark:text-green-200 font-medium text-sm">
            This score was submitted and locked on {new Date(score.submitted_at!).toLocaleString()}.
            Scores cannot be modified after submission.
          </p>
          <button
            onClick={() => router.push('/osce-scoring/dashboard')}
            className="mt-3 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-base"
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Scenario title in score sheet header */}
      {scenarioData && (
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-8 h-8 rounded-lg ${scenarioColors[scenarioLetter]} text-white font-bold flex items-center justify-center text-sm flex-shrink-0`}>
            {scenarioLetter}
          </span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">
              Scenario {scenarioLetter} — {scenarioData.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {assessment.student_name} | Slot {assessment.slot_number} | Day {assessment.day_number}
            </p>
          </div>
        </div>
      )}

      {/* SNHD Evaluation Factors */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-4 mb-3">
        SNHD Evaluation Factors
      </h2>
      <div className="space-y-3">
        {SNHD_FACTORS.map(f => (
          <FactorCard
            key={f.key}
            label={f.label}
            ratingKey={f.key}
            notesKey={`${f.key}_notes`}
            score={score}
            onChange={handleChange}
            disabled={isSubmitted}
            expandedNotes={expandedNotes}
            onToggleNotes={handleToggleNotes}
          />
        ))}
      </div>

      {/* Oral Board Domains */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-8 mb-3">
        Oral Board Domains
      </h2>
      <div className="space-y-3">
        {ORAL_DOMAINS.map(d => (
          <div key={d.key} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{d.label}</h3>
            <div className="flex gap-2">
              {(['S', 'N', 'U'] as const).map(v => (
                <RatingButton
                  key={v}
                  value={v}
                  selected={(score as unknown as Record<string, unknown>)[d.key] === v}
                  onClick={() => handleChange(d.key, (score as unknown as Record<string, unknown>)[d.key] === v ? null : v)}
                  disabled={isSubmitted}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Oral Board Notes</h3>
          <textarea
            value={score.oral_notes || ''}
            onChange={e => handleChange('oral_notes', e.target.value)}
            disabled={isSubmitted}
            placeholder="Notes on oral board performance..."
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* Readiness Assessment */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-8 mb-3">
        Field Readiness Assessment
      </h2>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {readinessOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleChange('readiness', score.readiness === opt.value ? null : opt.value)}
              disabled={isSubmitted}
              className={`min-h-[60px] rounded-xl font-bold text-center transition-all ${
                score.readiness === opt.value
                  ? `${opt.color} ring-2`
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
              } ${isSubmitted ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
            >
              <span className="text-2xl block">{opt.icon}</span>
              <span className="text-xs">{opt.label}</span>
            </button>
          ))}
        </div>

        {(score.readiness === 'ready_with_concerns' || score.readiness === 'not_yet_ready') && (
          <textarea
            value={score.concerns_notes || ''}
            onChange={e => handleChange('concerns_notes', e.target.value)}
            disabled={isSubmitted}
            placeholder="Describe specific concerns..."
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none mb-3"
            rows={3}
          />
        )}
      </div>

      {/* General Notes */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-8 mb-3">
        General Notes
      </h2>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
        <textarea
          value={score.general_notes || ''}
          onChange={e => handleChange('general_notes', e.target.value)}
          disabled={isSubmitted}
          placeholder="Any additional observations..."
          className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none"
          rows={4}
        />
      </div>

      {/* Submit or Back to Dashboard */}
      {!isSubmitted ? (
        <div className="mt-8 mb-8">
          <button
            onClick={handleSubmit}
            disabled={submitting || !score.readiness}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              score.readiness
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
            }`}
          >
            {submitting ? 'Submitting...' : !score.readiness ? 'Select Readiness to Submit' : 'Submit & Lock Score'}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
            Once submitted, the score cannot be modified.
          </p>
        </div>
      ) : (
        <div className="mt-8 mb-8 space-y-3">
          <button
            onClick={() => handlePrintScore()}
            className="w-full py-4 rounded-xl font-bold text-lg bg-slate-700 text-white hover:bg-slate-800 active:scale-[0.98] transition-all print:hidden"
          >
            Print Score Sheet
          </button>
          <button
            onClick={() => router.push('/osce-scoring/dashboard')}
            className="w-full py-4 rounded-xl font-bold text-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all print:hidden"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      {/* Sticky header — shared across all layouts */}
      <div className="flex-shrink-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/osce-scoring/dashboard')}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center flex-1">
              <div className="flex items-center justify-center gap-2">
                <span className={`w-8 h-8 rounded-lg ${scenarioColors[assessment.scenario]} text-white font-bold flex items-center justify-center text-sm`}>
                  {assessment.scenario}
                </span>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">{assessment.student_name}</h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {scenarioData ? `Scenario ${scenarioLetter} — ${scenarioData.title} | ` : ''}Slot {assessment.slot_number} &middot; {evaluator.name}
              </p>
            </div>
            <div className="text-right min-w-[60px]">
              {isSubmitted ? (
                <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                  Locked
                </span>
              ) : saving ? (
                <span className="text-xs text-amber-500">Saving...</span>
              ) : lastSaved ? (
                <span className="text-xs text-green-600 dark:text-green-400">Saved {lastSaved}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Test mode banner */}
      {isTestMode && (
        <div className="flex-shrink-0 bg-orange-500 text-white text-center py-2 font-bold text-sm print:hidden">
          TEST MODE — Practice event. Scores will not affect real assessments.
        </div>
      )}

      {/* Connection status indicator */}
      {!isOnline && (
        <div className="flex-shrink-0 bg-red-600 text-white text-center py-2 px-4 text-sm font-medium print:hidden">
          <span className="inline-block w-2 h-2 bg-red-300 rounded-full mr-2 animate-pulse" />
          Offline — scores saved locally, will sync when reconnected
        </div>
      )}

      {/* Mobile: Tab toggle bar (< 1024px) */}
      {scenarioData && (
        <div className="flex-shrink-0 lg:hidden flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('scenario')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeTab === 'scenario'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Scenario
          </button>
          <button
            onClick={() => setActiveTab('score')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeTab === 'score'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Score Sheet
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Desktop: Left panel — Scenario Reference (>= 1024px) */}
        {scenarioData && showScenario && (
          <div className="hidden lg:flex lg:flex-col lg:w-1/2 border-r border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scenario Reference</h2>
              <button
                onClick={() => setShowScenario(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1"
              >
                &#9664; Hide
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-0">
              <ScenarioPanel scenario={scenarioData} letter={scenarioLetter} fullContent={fullContent} />
            </div>
          </div>
        )}

        {/* Desktop: Right panel — Score Sheet (>= 1024px) */}
        <div className={`hidden lg:flex lg:flex-col ${scenarioData && showScenario ? 'lg:w-1/2' : 'lg:w-full'}`}>
          {scenarioData && !showScenario && (
            <div className="flex-shrink-0 px-4 pt-3">
              <button
                onClick={() => setShowScenario(true)}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                &#9654; Show Scenario
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 pb-32">
            <div className="max-w-3xl mx-auto">
              {scoringContent}
            </div>
          </div>
        </div>

        {/* Mobile: Single panel with tab switching (< 1024px) */}
        <div className="flex-1 lg:hidden overflow-y-auto">
          {scenarioData && activeTab === 'scenario' ? (
            <div className="p-4">
              <ScenarioPanel scenario={scenarioData} letter={scenarioLetter} fullContent={fullContent} />
            </div>
          ) : (
            <div className="p-4 pb-32">
              <div className="max-w-3xl mx-auto">
                {scoringContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
