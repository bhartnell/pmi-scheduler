'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Save, WifiOff, RefreshCw, Crown } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useOffline } from '@/components/OfflineProvider';
import PalsCaseCard, { type PalsCard } from '@/components/pals/PalsCaseCard';
import {
  mintClientUuid, saveDraft, loadDraft, clearDraft,
  queueAttempt, flushQueue, queueLength,
} from '@/lib/pals-offline';
import type {
  PalsScenarioWithChecklist, PalsCriterionState, SavePalsAttemptInput, Discipline,
} from '@/types/pals';

const ACTIVE_DRAFT_KEY = 'pals_active_draft_uuid';

interface DayOpt {
  id: string; date: string; cohort_id: string; is_adv_cert_testing: boolean;
  cert_course: string | null; cohort?: { id: string; cohort_number: number } | null;
}
interface StudentOpt { id: string; first_name: string; last_name: string; status?: string | null; discipline?: Discipline | null }
interface GroupOpt { id: string; name: string; members: StudentOpt[] }
interface StationOpt { id: string; station_number: number; scenario_id: string | null }
interface ScenarioOpt {
  id: string; title: string; case_code: string | null; cert_tier: string | null;
  checklist_id: string | null; category: string | null; subtype: string | null;
}
interface RetestCandidate { id: string; attempted_at: string; result: string; remediation_due_at: string | null; remediation_notes: string | null }

interface Draft {
  clientUuid: string; labDayId: string; groupId: string; stationId: string; scenarioId: string;
  teamLeadId: string; memberIds: string[]; criterionStates: Record<string, PalsCriterionState>;
  remediationNotes: string; instructorInitials: string; instructorNumber: string; retestOf: string;
}

export default function PalsGradePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { isOnline } = useOffline();

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
  const [scenario, setScenario] = useState<PalsScenarioWithChecklist | null>(null);

  const [criterionStates, setCriterionStates] = useState<Record<string, PalsCriterionState>>({});
  const [remediationNotes, setRemediationNotes] = useState('');
  const [instructorInitials, setInstructorInitials] = useState('');
  const [instructorNumber, setInstructorNumber] = useState('');
  const [retestOf, setRetestOf] = useState('');
  const [retestCandidates, setRetestCandidates] = useState<RetestCandidate[]>([]);

  const [clientUuid, setClientUuid] = useState('');
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [urlStationId, setUrlStationId] = useState('');
  const restoredRef = useRef(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Preselect from URL (the lab-day station "Grade" button links here with
  // ?labDayId=&stationId=).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const ld = p.get('labDayId');
    const st = p.get('stationId');
    if (ld) setLabDayId(ld);
    if (st) setUrlStationId(st);
  }, []);

  // Restore an in-progress draft (reload during an outage must not lose work).
  // URL params (if present) win over a stale draft's context.
  useEffect(() => {
    if (typeof window === 'undefined' || restoredRef.current) return;
    restoredRef.current = true;
    const activeUuid = window.localStorage.getItem(ACTIVE_DRAFT_KEY);
    if (!activeUuid) { setClientUuid(mintClientUuid()); return; }
    const draft = loadDraft<Draft>(activeUuid);
    if (!draft) { setClientUuid(mintClientUuid()); return; }
    setClientUuid(draft.clientUuid);
    if (!new URLSearchParams(window.location.search).get('labDayId')) setLabDayId(draft.labDayId);
    setGroupId(draft.groupId); setStationId(draft.stationId); setScenarioId(draft.scenarioId);
    setTeamLeadId(draft.teamLeadId); setMemberIds(draft.memberIds || []);
    setCriterionStates(draft.criterionStates || {});
    setRemediationNotes(draft.remediationNotes || ''); setInstructorInitials(draft.instructorInitials || '');
    setInstructorNumber(draft.instructorNumber || ''); setRetestOf(draft.retestOf || '');
    toast.info('Restored an in-progress grading draft.');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (urlStationId && stations.some((s) => s.id === urlStationId)) {
      setStationId(urlStationId);
      setUrlStationId('');
    }
  }, [stations, urlStationId]);

  useEffect(() => {
    if (!stationId) return;
    const st = stations.find((s) => s.id === stationId);
    if (st?.scenario_id && st.scenario_id !== scenarioId) setScenarioId(st.scenario_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, stations]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/pals/grading-context')
      .then((r) => r.json())
      .then((d) => { if (d.success) setDays(d.days || []); })
      .catch(() => toast.error('Failed to load testing days'));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return;
    fetch('/api/pals/scenarios?tier=scenario_practice,scenario_testing')
      .then((r) => r.json())
      .then((d) => { if (d.success) setScenarioOpts(d.scenarios || []); })
      .catch(() => toast.error('Failed to load scenarios'));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevLabDayIdRef = useRef<string>('');
  useEffect(() => {
    if (!session || !labDayId) { setGroups([]); setStations([]); return; }
    fetch(`/api/pals/grading-context?labDayId=${labDayId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) { setGroups(d.groups || []); setStations(d.stations || []); } })
      .catch(() => toast.error('Failed to load day context'));
    if (prevLabDayIdRef.current !== labDayId) {
      setGroupId(''); setStationId(''); setTeamLeadId(''); setMemberIds([]);
      prevLabDayIdRef.current = labDayId;
    }
  }, [session, labDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastResetScenarioRef = useRef<string>('');
  useEffect(() => {
    if (!session || !scenarioId) { setScenario(null); return; }
    if (lastResetScenarioRef.current === scenarioId) return;
    setLoadingScenario(true);
    fetch(`/api/pals/scenarios/${scenarioId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setScenario(d.scenario);
          setCriterionStates((prev) => {
            // Only reset if this is a genuinely new scenario selection (not a
            // restored draft — draft restoration already populated states).
            if (Object.keys(prev).length > 0 && lastResetScenarioRef.current === '') return prev;
            const next: Record<string, PalsCriterionState> = {};
            for (const c of d.scenario?.checklist?.criteria || []) next[c.id] = 'not_checked';
            return next;
          });
          lastResetScenarioRef.current = scenarioId;
        } else toast.error(d.error || 'Failed to load scenario');
      })
      .catch(() => toast.error('Failed to load scenario'))
      .finally(() => setLoadingScenario(false));
  }, [session, scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGroup = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);
  const groupMembers = selectedGroup?.members || [];
  const teamLead = groupMembers.find((m) => m.id === teamLeadId);

  // Retest candidates: open (NR) prior attempts for this team lead + checklist.
  useEffect(() => {
    if (!session || !teamLeadId || !scenario?.checklist?.id) { setRetestCandidates([]); return; }
    fetch(`/api/pals/attempts?studentId=${teamLeadId}&checklistId=${scenario.checklist.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setRetestCandidates(d.candidates || []); })
      .catch(() => {});
  }, [session, teamLeadId, scenario?.checklist?.id]);

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setCriterionState(criterionId: string, state: PalsCriterionState) {
    setCriterionStates((prev) => ({ ...prev, [criterionId]: prev[criterionId] === state ? 'not_checked' : state }));
  }

  const criteria = scenario?.checklist?.criteria || [];
  const inScopeCriteria = criteria.filter((c) => criterionStates[c.id] !== 'na');
  const computedResult: 'PASS' | 'NR' =
    inScopeCriteria.length > 0 && inScopeCriteria.every((c) => criterionStates[c.id] === 'checked') ? 'PASS' : 'NR';
  const uncheckedCriticalCount = criteria.filter((c) => c.is_critical && criterionStates[c.id] !== 'checked' && criterionStates[c.id] !== 'na').length;

  // Persist an in-progress draft on every meaningful change (survives reload).
  useEffect(() => {
    if (!clientUuid || typeof window === 'undefined') return;
    const hasAnyProgress = !!(labDayId || groupId || scenarioId || teamLeadId || remediationNotes);
    if (!hasAnyProgress) return;
    const draft: Draft = {
      clientUuid, labDayId, groupId, stationId, scenarioId, teamLeadId, memberIds,
      criterionStates, remediationNotes, instructorInitials, instructorNumber, retestOf,
    };
    saveDraft(clientUuid, draft);
    window.localStorage.setItem(ACTIVE_DRAFT_KEY, clientUuid);
  }, [clientUuid, labDayId, groupId, stationId, scenarioId, teamLeadId, memberIds, criterionStates, remediationNotes, instructorInitials, instructorNumber, retestOf]);

  function resetForNextStudent() {
    setTeamLeadId(''); setMemberIds([]); setCriterionStates(() => {
      const next: Record<string, PalsCriterionState> = {};
      for (const c of criteria) next[c.id] = 'not_checked';
      return next;
    });
    setRemediationNotes(''); setRetestOf('');
    if (clientUuid) { clearDraft(clientUuid); }
    if (typeof window !== 'undefined') window.localStorage.removeItem(ACTIVE_DRAFT_KEY);
    lastResetScenarioRef.current = ''; // allow the next scenario pick to re-seed states cleanly
    setClientUuid(mintClientUuid());
  }

  async function postAttempt(payload: SavePalsAttemptInput) {
    const res = await fetch('/api/pals/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  }

  async function handleSyncQueue() {
    setSyncing(true);
    try {
      const { synced, remaining } = await flushQueue(postAttempt);
      setPendingCount(remaining);
      if (synced > 0) toast.success(`Synced ${synced} queued attempt${synced === 1 ? '' : 's'}${remaining ? ` — ${remaining} still pending` : ''}`);
      else if (remaining > 0) toast.error('Still offline — attempts remain queued');
    } finally {
      setSyncing(false);
    }
  }

  // Auto-sync on reconnect.
  useEffect(() => {
    if (isOnline && queueLength() > 0) handleSyncQueue();
    setPendingCount(queueLength());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  async function handleSave() {
    if (!labDayId) return toast.error('Pick a testing day');
    if (!scenarioId || !scenario?.checklist) return toast.error('Pick a scenario with a checklist');
    if (!teamLeadId) return toast.error('Select the Team Leader (the graded student)');
    if (!instructorInitials.trim() || !instructorNumber.trim()) return toast.error('Instructor initials and number are required (AHA sign-off)');
    if (computedResult === 'NR' && !remediationNotes.trim()) return toast.error('Remediation notes are required for an NR result');

    const payload: SavePalsAttemptInput = {
      checklist_id: scenario.checklist.id,
      scenario_id: scenarioId,
      student_id: teamLeadId,
      lab_day_id: labDayId,
      lab_station_id: stationId || null,
      lab_group_id: groupId || null,
      discipline: (teamLead?.discipline as Discipline | undefined) || null,
      result: computedResult,
      remediation_notes: remediationNotes || null,
      instructor_initials: instructorInitials.trim(),
      instructor_number: instructorNumber.trim(),
      retest_of: retestOf || null,
      criterion_results: criteria.map((c) => ({ criterion_id: c.id, state: criterionStates[c.id] || 'not_checked' })),
      team_member_ids: memberIds.filter((id) => id !== teamLeadId),
      client_uuid: clientUuid,
    };

    setSaving(true);
    try {
      const data = await postAttempt(payload);
      if (data.success) {
        const dueNote = data.attempt?.remediation_due_at
          ? ` — remediation due ${new Date(data.attempt.remediation_due_at).toLocaleDateString()}`
          : '';
        toast.success(`Saved — ${computedResult}${dueNote}`);
        resetForNextStudent();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      // Network failure (offline / sustained outage) — queue locally, don't lose the grade.
      queueAttempt(payload);
      setPendingCount(queueLength());
      toast.success(`Saved offline (${computedResult}) — will sync when back online`);
      resetForNextStudent();
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }

  const fmtDay = (d: DayOpt) => `${d.date}${d.cohort?.cohort_number ? ` — Cohort ${d.cohort.cohort_number}` : ''}`;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <Link href={labDayId ? `/labs/schedule/${labDayId}` : '/labs'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
          <ArrowLeft className="w-4 h-4" /> {labDayId ? 'Back to Lab Day' : 'Back to Labs'}
        </Link>
        {(pendingCount > 0 || !isOnline) && (
          <button type="button" onClick={handleSyncQueue} disabled={syncing || !isOnline}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 disabled:opacity-60">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : !isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {pendingCount > 0 ? `${pendingCount} pending sync` : 'Offline'}
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">PALS Testing Grading</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        AHA PALS 2025 Case Scenario Testing Checklist — PASS / NR per student (Team Leader), all in-scope steps checked.
      </p>

      {/* Context selectors */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scenario (drawn case)</label>
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
            <option value="">Select a PALS scenario…</option>
            {scenarioOpts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.case_code ? `[${s.case_code}] ` : ''}{s.title}
                {s.cert_tier === 'scenario_testing' ? ' • TEST' : ' • practice'}
                {s.subtype ? ` — ${s.subtype}` : ''}
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Team leader (graded student)</label>
                <select value={teamLeadId} onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full sm:w-72 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
                  <option value="">Select team lead…</option>
                  {groupMembers.map((m) => <option key={m.id} value={m.id}>{m.last_name}, {m.first_name}</option>)}
                </select>
                {teamLead && (
                  <p className="mt-1 text-xs text-gray-400">
                    Discipline: {teamLead.discipline ? teamLead.discipline.toUpperCase() : 'not set — mark out-of-scope steps N/A per the tester’s actual scope'}
                  </p>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Team members tested (not individually graded) — tap <Crown size={11} className="inline -mt-0.5" /> to set the team leader
                </span>
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map((m) => {
                    const isLead = m.id === teamLeadId;
                    const on = memberIds.includes(m.id) || isLead;
                    return (
                      <span key={m.id} className={`inline-flex items-center rounded-full text-sm border transition-colors overflow-hidden ${
                        on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                      }`}>
                        <button type="button" onClick={() => toggleMember(m.id)} disabled={isLead}
                          className={`px-3 py-1.5 ${isLead ? 'opacity-90' : ''}`}>
                          {m.last_name}, {m.first_name}{isLead ? ' (lead)' : ''}
                        </button>
                        <button type="button"
                          onClick={() => setTeamLeadId(isLead ? '' : m.id)}
                          title={isLead ? 'Clear team leader' : 'Set as team leader (graded student)'}
                          aria-label={isLead ? 'Clear team leader' : 'Set as team leader'}
                          className={`px-2 py-1.5 border-l ${
                            isLead
                              ? 'border-blue-400 text-yellow-300'
                              : on
                                ? 'border-blue-400 text-blue-200 hover:text-yellow-200'
                                : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:text-yellow-500'
                          }`}>
                          <Crown size={14} fill={isLead ? 'currentColor' : 'none'} />
                        </button>
                      </span>
                    );
                  })}
                </div>
                {!teamLeadId && memberIds.length > 0 && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    No team leader set yet — this attempt cannot be saved until you tap a crown or use the dropdown above. Clicking a name only marks it &quot;tested,&quot; it does not register the leader.
                  </p>
                )}
              </div>
              {retestCandidates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Retest of (optional — this student has open NR attempts on this checklist)</label>
                  <select value={retestOf} onChange={(e) => setRetestOf(e.target.value)}
                    className="w-full sm:w-96 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
                    <option value="">Not a retest</option>
                    {retestCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        NR on {new Date(c.attempted_at).toLocaleDateString()}
                        {c.remediation_due_at ? ` — remediation due ${new Date(c.remediation_due_at).toLocaleDateString()}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grading form */}
      {loadingScenario && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>}

      {scenario && !loadingScenario && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-900 dark:text-white">
                {scenario.case_code ? `[${scenario.case_code}] ` : ''}{scenario.title}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                scenario.cert_tier === 'scenario_testing'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              }`}>
                {scenario.cert_tier === 'scenario_testing' ? 'TESTING (scored)' : 'Practice'}
              </span>
              {scenario.checklist && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {scenario.checklist.category}{scenario.checklist.subtype ? ` — ${scenario.checklist.subtype}` : ''}
                </span>
              )}
            </div>
            <PalsCaseCard card={(scenario.pals_narrative as { card?: PalsCard } | null)?.card} />
          </div>

          {!scenario.checklist && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
              This scenario has no checklist linked yet — cannot be graded.
            </div>
          )}

          {scenario.checklist && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Critical Performance Steps</h3>
                <span className="text-[11px] text-gray-400">Tap: not-checked → checked → N/A → not-checked</span>
              </div>
              <ul className="space-y-2">
                {criteria.map((c, i) => {
                  const st = criterionStates[c.id] || 'not_checked';
                  return (
                    <li key={c.id} className="flex items-start gap-2">
                      <div className="flex gap-1 shrink-0 mt-0.5">
                        {(['checked', 'na'] as const).map((opt) => (
                          <button key={opt} type="button" onClick={() => setCriterionState(c.id, opt)}
                            className={`w-8 h-7 rounded text-[10px] font-bold border ${
                              st === opt
                                ? opt === 'checked' ? 'bg-green-600 text-white border-green-600' : 'bg-gray-400 text-white border-gray-400'
                                : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                            }`}>
                            {opt === 'checked' ? '✓' : 'N/A'}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1">
                        <span className={`text-sm ${st === 'not_checked' ? 'text-gray-700 dark:text-gray-200' : st === 'checked' ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
                          {i + 1}. {c.text}
                          {c.is_critical && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">CRITICAL</span>}
                          {c.scope_conditional && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">scope-conditional</span>}
                        </span>
                        {c.instructor_prompt && (
                          <p className="mt-0.5 text-xs text-gray-400 italic">
                            If not verbalized, prompt ({c.prompt_kind || 'question'}): &ldquo;{c.instructor_prompt}&rdquo;
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  {computedResult === 'PASS' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-green-600 text-white"><CheckCircle2 className="w-4 h-4" /> PASS</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-red-600 text-white"><XCircle className="w-4 h-4" /> NR (Needs Remediation)</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {inScopeCriteria.filter((c) => criterionStates[c.id] === 'checked').length}/{inScopeCriteria.length} in-scope checked
                    {uncheckedCriticalCount > 0 ? ` • ${uncheckedCriticalCount} critical step(s) not checked` : ''}
                  </span>
                </div>

                {computedResult === 'NR' && (
                  <textarea placeholder="Remediation notes — which skills require remediation (required for NR)" rows={2}
                    value={remediationNotes} onChange={(e) => setRemediationNotes(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm mb-3" />
                )}

                <div className="grid grid-cols-2 gap-3 mb-3 sm:w-96">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Instructor initials</label>
                    <input type="text" value={instructorInitials} onChange={(e) => setInstructorInitials(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Instructor number</label>
                    <input type="text" value={instructorNumber} onChange={(e) => setInstructorNumber(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
                  </div>
                </div>

                <button type="button" onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-sm font-medium">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save result
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
