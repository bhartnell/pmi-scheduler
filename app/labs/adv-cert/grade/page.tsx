'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/Toast';
import ScenarioFullDisplay from '@/components/scenario/ScenarioFullDisplay';
import type { AdvCertScenario, CertCourse } from '@/types/adv-cert';

interface DayOpt {
  id: string;
  date: string;
  cohort_id: string;
  is_adv_cert_testing: boolean;
  cert_course: string | null;
  cohort?: { id: string; cohort_number: number } | null;
}
interface StudentOpt { id: string; first_name: string; last_name: string; status?: string | null }
interface GroupOpt { id: string; name: string; members: StudentOpt[] }
interface StationOpt { id: string; station_number: number; scenario_id: string | null }
interface ScenarioOpt { id: string; name: string; case_code: string | null; cert_tier: string | null; scenario_scope: string | null; segment_count: number }

export default function AdvCertGradePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [course, setCourse] = useState<CertCourse>('acls');
  const [days, setDays] = useState<DayOpt[]>([]);
  const [scenarioOpts, setScenarioOpts] = useState<ScenarioOpt[]>([]);

  const [labDayId, setLabDayId] = useState('');
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [groupId, setGroupId] = useState('');
  const [stationId, setStationId] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const [scenarioId, setScenarioId] = useState('');
  const [scenario, setScenario] = useState<AdvCertScenario | null>(null);
  // Full scenario row for the rich, FAMILIAR display (same component the
  // standard scenarios use) — separate from `scenario` (segments/criteria).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fullScenario, setFullScenario] = useState<any>(null);

  // grading state keyed by scenario_segment_id
  const [criteriaMet, setCriteriaMet] = useState<Record<string, boolean>>({});
  const [segResult, setSegResult] = useState<Record<string, 'pass' | 'fail' | ''>>({});
  const [segComments, setSegComments] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState<'pass' | 'fail' | ''>('');
  const [overallComments, setOverallComments] = useState('');

  const [loadingScenario, setLoadingScenario] = useState(false);
  const [saving, setSaving] = useState(false);
  // Preselect from URL (the lab-day station "Grade (ACLS)" button links here with
  // ?labDayId=&stationId=). Read once on mount; window avoids a Suspense boundary.
  const [urlStationId, setUrlStationId] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const ld = p.get('labDayId');
    const st = p.get('stationId');
    if (ld) setLabDayId(ld);
    if (st) setUrlStationId(st);
  }, []);

  // Once the day's stations load, apply the preselected station from the URL.
  useEffect(() => {
    if (urlStationId && stations.some((s) => s.id === urlStationId)) {
      setStationId(urlStationId);
      setUrlStationId('');
    }
  }, [stations, urlStationId]);

  // Auto-select the station's drawn scenario when a station is chosen — so the
  // grader doesn't make you re-pick the case every rotation. A manual scenario
  // change afterward sticks (this only re-fires when the station changes).
  useEffect(() => {
    if (!stationId) return;
    const st = stations.find((s) => s.id === stationId);
    if (st?.scenario_id && st.scenario_id !== scenarioId) setScenarioId(st.scenario_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, stations]);

  // candidate days
  useEffect(() => {
    if (!session) return;
    fetch('/api/adv-cert/grading-context')
      .then((r) => r.json())
      .then((d) => { if (d.success) setDays(d.days || []); })
      .catch(() => toast.error('Failed to load testing days'));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // scenario pool for the chosen course
  useEffect(() => {
    if (!session) return;
    fetch(`/api/adv-cert/scenarios?course=${course}&tier=megacode_practice,megacode_testing`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setScenarioOpts(d.scenarios || []); })
      .catch(() => toast.error('Failed to load scenarios'));
  }, [session, course]); // eslint-disable-line react-hooks/exhaustive-deps

  // context for the chosen day
  useEffect(() => {
    if (!session || !labDayId) { setGroups([]); setStations([]); return; }
    fetch(`/api/adv-cert/grading-context?labDayId=${labDayId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setGroups(d.groups || []);
          setStations(d.stations || []);
          if (d.day?.cert_course) setCourse(d.day.cert_course);
        }
      })
      .catch(() => toast.error('Failed to load day context'));
    setGroupId(''); setStationId(''); setTeamLeadId(''); setMemberIds([]);
  }, [session, labDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  // full scenario (segments + criteria)
  useEffect(() => {
    if (!session || !scenarioId) { setScenario(null); return; }
    setLoadingScenario(true);
    fetch(`/api/adv-cert/scenarios/${scenarioId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setScenario(d.scenario); resetGrading(); }
        else toast.error(d.error || 'Failed to load scenario');
      })
      .catch(() => toast.error('Failed to load scenario'))
      .finally(() => setLoadingScenario(false));
  }, [session, scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full scenario row (all columns) for the rich familiar display.
  useEffect(() => {
    if (!session || !scenarioId) { setFullScenario(null); return; }
    fetch(`/api/lab-management/scenarios/${scenarioId}`)
      .then((r) => r.json())
      .then((d) => { setFullScenario(d?.scenario ?? d ?? null); })
      .catch(() => setFullScenario(null));
  }, [session, scenarioId]);

  function resetGrading() {
    setCriteriaMet({}); setSegResult({}); setSegComments({});
    setOverall(''); setOverallComments('');
  }

  const selectedGroup = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);
  const groupMembers = selectedGroup?.members || [];

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!labDayId) return toast.error('Pick a testing day');
    if (!groupId) return toast.error('Pick a group');
    if (!scenarioId) return toast.error('Pick a scenario');
    if (!overall) return toast.error('Set the overall result (pass/fail)');
    if (!teamLeadId) return toast.error('Select the team lead');

    const segment_results = (scenario?.segments || []).map((seg) => ({
      scenario_segment_id: seg.id,
      result: segResult[seg.id] || null,
      comments: segComments[seg.id] || null,
      criteria: (seg.segment?.criteria || []).map((c) => ({
        criterion_id: c.id,
        met: !!criteriaMet[`${seg.id}:${c.id}`],
      })),
    }));

    const payload = {
      lab_day_id: labDayId,
      lab_station_id: stationId || null,
      lab_group_id: groupId,
      scenario_id: scenarioId,
      team_lead_id: teamLeadId,
      cert_course: course,
      overall_result: overall,
      comments: overallComments || null,
      student_ids: Array.from(new Set([teamLeadId, ...memberIds])),
      segment_results,
      // offline-readiness: stable idempotency key minted client-side
      client_uuid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/adv-cert/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Saved — ${String(overall).toUpperCase()}${data.teamLeadLogWritten ? ' (team-lead logged)' : ''}`);
        // ready for the next group on the same day
        resetGrading();
        setGroupId(''); setStationId(''); setTeamLeadId(''); setMemberIds([]);
        setScenarioId(''); setScenario(null);
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }

  const fmtDay = (d: DayOpt) =>
    `${d.date}${d.cohort?.cohort_number ? ` — Cohort ${d.cohort.cohort_number}` : ''}${d.is_adv_cert_testing ? ' • testing' : ''}`;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <Link href={labDayId ? `/labs/schedule/${labDayId}` : '/labs'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> {labDayId ? 'Back to Lab Day' : 'Back to Labs'}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Advanced-Cert Megacode Grading</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        ACLS / PALS station testing — checklist scoring with an instructor-set group result.
      </p>

      {/* Context selectors */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Course</label>
          <select value={course} onChange={(e) => setCourse(e.target.value as CertCourse)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
            <option value="acls">ACLS</option>
            <option value="pals">PALS</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Testing day</label>
          <select value={labDayId} onChange={(e) => setLabDayId(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
            <option value="">Select a day…</option>
            {days.map((d) => <option key={d.id} value={d.id}>{fmtDay(d)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group</label>
          <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setTeamLeadId(''); setMemberIds([]); }}
            disabled={!labDayId}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm disabled:opacity-50">
            <option value="">Select a group…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Station (optional)</label>
          <select value={stationId} onChange={(e) => setStationId(e.target.value)}
            disabled={!labDayId}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm disabled:opacity-50">
            <option value="">No station</option>
            {stations.map((s) => <option key={s.id} value={s.id}>Station {s.station_number}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scenario (drawn case)</label>
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
            <option value="">Select a megacode scenario…</option>
            {scenarioOpts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.case_code ? `[${s.case_code}] ` : ''}{s.name}
                {s.cert_tier === 'megacode_testing' ? ' • TEST' : ' • practice'}
                {s.segment_count === 0 ? ' — no segments yet' : ` (${s.segment_count} segments)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team */}
      {selectedGroup && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Team — {selectedGroup.name}</h2>
          {groupMembers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No members recorded for this group.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Team lead</label>
                <select value={teamLeadId} onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full sm:w-72 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
                  <option value="">Select team lead…</option>
                  {groupMembers.map((m) => <option key={m.id} value={m.id}>{m.last_name}, {m.first_name}</option>)}
                </select>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Team members tested</span>
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map((m) => {
                    const on = memberIds.includes(m.id) || m.id === teamLeadId;
                    return (
                      <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                        disabled={m.id === teamLeadId}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          on
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                        } ${m.id === teamLeadId ? 'opacity-70' : ''}`}>
                        {m.last_name}, {m.first_name}{m.id === teamLeadId ? ' (lead)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grading form */}
      {loadingScenario && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>}

      {scenario && !loadingScenario && (
        <div className="space-y-4">
          {/* Case identity + structure (Phase 1). Phase 2 will render the full
              narrative (lead-in, vitals, progression) here once the OCR'd case
              content is seeded + imported. */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-900 dark:text-white">
                {scenario.case_code ? `[${scenario.case_code}] ` : ''}{scenario.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                scenario.cert_tier === 'megacode_testing'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              }`}>
                {scenario.cert_tier === 'megacode_testing' ? 'TESTING (scored)'
                  : scenario.cert_tier === 'megacode_practice' ? 'Practice' : scenario.cert_tier}
              </span>
            </div>
            {scenario.segments.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Case flow:</span>{' '}
                {scenario.segments.map((s) => s.segment?.name).filter(Boolean).join(' → ')}
              </p>
            )}

            {/* Free-text lead-in + narrative (OCR) — the structured panel below
                has no home for these, so they show here. */}
            {scenario.patient_presentation && (
              <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">
                <span className="font-semibold">Scenario:</span> {scenario.patient_presentation}
              </p>
            )}
            {scenario.history && (
              <details className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                <summary className="cursor-pointer font-medium text-gray-500 dark:text-gray-400">Case narrative / progression</summary>
                <p className="mt-1 whitespace-pre-line">{scenario.history}</p>
              </details>
            )}
            <p className="mt-1 text-[11px] text-gray-400">
              Grade each segment below. Case content (OCR-derived — proofread as needed) shows in the panel.
            </p>
          </div>

          {/* Scenario reference — the SAME structured display the standard
              scenarios use (patient info, vitals, secondary assessment, phases,
              critical actions). Shows whatever the case has populated. */}
          {fullScenario && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <ScenarioFullDisplay scenario={fullScenario} hideEmpty />
            </div>
          )}

          {scenario.segments.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
              This scenario has no segments assembled yet. Import or assemble segments before grading.
            </div>
          )}
          {scenario.segments.map((seg, i) => (
            <div key={seg.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {i + 1}. {seg.segment?.name || 'Segment'}
                  {seg.segment?.always_present && <span className="ml-2 text-xs text-gray-400">(always present)</span>}
                </h3>
                <div className="flex gap-1">
                  {(['pass', 'fail'] as const).map((r) => (
                    <button key={r} type="button"
                      onClick={() => setSegResult((p) => ({ ...p, [seg.id]: p[seg.id] === r ? '' : r }))}
                      className={`px-2.5 py-1 rounded text-xs font-medium border ${
                        segResult[seg.id] === r
                          ? r === 'pass' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}>
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-1.5">
                {(seg.segment?.criteria || []).map((c) => {
                  const key = `${seg.id}:${c.id}`;
                  return (
                    <li key={c.id}>
                      <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-200">
                        <input type="checkbox" checked={!!criteriaMet[key]}
                          onChange={(e) => setCriteriaMet((p) => ({ ...p, [key]: e.target.checked }))}
                          className="mt-0.5 rounded border-gray-300 dark:border-gray-600" />
                        <span>{c.text}{c.is_critical && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(critical)</span>}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <input type="text" placeholder="Segment notes (optional)"
                value={segComments[seg.id] || ''}
                onChange={(e) => setSegComments((p) => ({ ...p, [seg.id]: e.target.value }))}
                className="mt-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm" />
            </div>
          ))}

          {/* Overall */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Overall result</h3>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setOverall(overall === 'pass' ? '' : 'pass')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border ${
                  overall === 'pass' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}>
                <CheckCircle2 className="w-4 h-4" /> Pass
              </button>
              <button type="button" onClick={() => setOverall(overall === 'fail' ? '' : 'fail')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border ${
                  overall === 'fail' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}>
                <XCircle className="w-4 h-4" /> Fail
              </button>
            </div>
            <textarea placeholder="Overall comments (optional)" rows={2}
              value={overallComments} onChange={(e) => setOverallComments(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />

            <button type="button" onClick={handleSave} disabled={saving}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save result
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
