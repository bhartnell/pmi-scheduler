'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  X,
  Check,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import HelpTooltip from '@/components/HelpTooltip';
import { hasMinRole } from '@/lib/permissions';
import { useToast } from '@/components/Toast';
import type { Student, Skill } from './types';

interface LabDaySkillSignoffsProps {
  labDayId: string;
  cohortStudents: Student[];
  skills: Skill[];
  userRole: string | null;
}

export default function LabDaySkillSignoffs({
  labDayId,
  cohortStudents,
  skills,
  userRole,
}: LabDaySkillSignoffsProps) {
  const toast = useToast();

  const [signoffCollapsed, setSignoffCollapsed] = useState(false);
  const [signoffSkillId, setSignoffSkillId] = useState('');
  const [signoffs, setSignoffs] = useState<Record<string, { id: string; signed_off_by: string; signed_off_at: string; revoked: boolean }>>({});
  const [signoffLoading, setSignoffLoading] = useState(false);
  const [signoffSaving, setSignoffSaving] = useState<Record<string, boolean>>({});
  const [signoffConfirm, setSignoffConfirm] = useState<Record<string, boolean>>({});
  const [signoffBulkSelected, setSignoffBulkSelected] = useState<string[]>([]);
  const [signoffBulkConfirm, setSignoffBulkConfirm] = useState(false);
  const [signoffBulkSaving, setSignoffBulkSaving] = useState(false);
  const [signoffRevokeId, setSignoffRevokeId] = useState<string | null>(null);
  const [signoffRevokeReason, setSignoffRevokeReason] = useState('');
  const [signoffRevoking, setSignoffRevoking] = useState(false);

  useEffect(() => {
    fetchSignoffs();
  }, [labDayId]);

  const fetchSignoffs = async () => {
    if (!labDayId) return;
    setSignoffLoading(true);
    try {
      const res = await fetch(`/api/lab-management/skill-signoffs?lab_day_id=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        const map: Record<string, { id: string; signed_off_by: string; signed_off_at: string; revoked: boolean }> = {};
        for (const s of data.signoffs || []) {
          map[`${s.student_id}:${s.skill_id}`] = {
            id: s.id,
            signed_off_by: s.signed_off_by,
            signed_off_at: s.signed_off_at,
            revoked: s.revoked,
          };
        }
        setSignoffs(map);
      }
    } catch (error) {
      console.error('Error fetching signoffs:', error);
    }
    setSignoffLoading(false);
  };

  const handleSignoff = async (studentId: string) => {
    if (!signoffSkillId) return;
    const key = `${studentId}:${signoffSkillId}`;

    if (!signoffConfirm[key]) {
      setSignoffConfirm(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSignoffConfirm(prev => ({ ...prev, [key]: false })), 4000);
      return;
    }

    setSignoffSaving(prev => ({ ...prev, [studentId]: true }));
    setSignoffConfirm(prev => ({ ...prev, [key]: false }));
    try {
      const res = await fetch('/api/lab-management/skill-signoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          skill_id: signoffSkillId,
          lab_day_id: labDayId,
        }),
      });
      const data = await res.json();
      if (data.success && data.signoffs?.length > 0) {
        const s = data.signoffs[0];
        setSignoffs(prev => ({
          ...prev,
          [key]: { id: s.id, signed_off_by: s.signed_off_by, signed_off_at: s.signed_off_at, revoked: s.revoked },
        }));
        toast.success('Skill signed off');
      } else if (data.skipped_count > 0) {
        toast.info('Already signed off');
      } else {
        toast.error(data.error || 'Failed to sign off');
      }
    } catch (error) {
      console.error('Error signing off:', error);
      toast.error('Failed to sign off');
    }
    setSignoffSaving(prev => ({ ...prev, [studentId]: false }));
  };

  const handleBulkSignoff = async () => {
    if (!signoffSkillId || signoffBulkSelected.length === 0) return;

    if (!signoffBulkConfirm) {
      setSignoffBulkConfirm(true);
      setTimeout(() => setSignoffBulkConfirm(false), 4000);
      return;
    }

    setSignoffBulkSaving(true);
    setSignoffBulkConfirm(false);
    try {
      const res = await fetch('/api/lab-management/skill-signoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_ids: signoffBulkSelected,
          skill_id: signoffSkillId,
          lab_day_id: labDayId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const newSignoffs: Record<string, { id: string; signed_off_by: string; signed_off_at: string; revoked: boolean }> = {};
        for (const s of data.signoffs || []) {
          newSignoffs[`${s.student_id}:${s.skill_id}`] = {
            id: s.id,
            signed_off_by: s.signed_off_by,
            signed_off_at: s.signed_off_at,
            revoked: s.revoked,
          };
        }
        setSignoffs(prev => ({ ...prev, ...newSignoffs }));
        setSignoffBulkSelected([]);
        toast.success(`Signed off ${data.signoffs?.length || 0} student${data.signoffs?.length !== 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to bulk sign off');
      }
    } catch (error) {
      console.error('Error bulk signing off:', error);
      toast.error('Failed to bulk sign off');
    }
    setSignoffBulkSaving(false);
  };

  const handleRevokeSignoff = async () => {
    if (!signoffRevokeId) return;
    setSignoffRevoking(true);
    try {
      const res = await fetch('/api/lab-management/skill-signoffs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signoffRevokeId, revoke_reason: signoffRevokeReason || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        const key = Object.keys(signoffs).find(k => signoffs[k].id === signoffRevokeId);
        if (key) {
          setSignoffs(prev => ({ ...prev, [key]: { ...prev[key], revoked: true } }));
        }
        setSignoffRevokeId(null);
        setSignoffRevokeReason('');
        toast.success('Sign-off revoked');
      } else {
        toast.error(data.error || 'Failed to revoke');
      }
    } catch (error) {
      console.error('Error revoking signoff:', error);
      toast.error('Failed to revoke');
    }
    setSignoffRevoking(false);
  };

  if (!userRole || !hasMinRole(userRole, 'instructor') || cohortStudents.length === 0 || skills.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 print:hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        {/* Section header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <button
            onClick={() => setSignoffCollapsed(prev => !prev)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Skill Sign-offs</h3>
            {signoffSkillId && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0 truncate">
                {skills.find(s => s.id === signoffSkillId)?.name}
              </span>
            )}
            {signoffCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            )}
          </button>
          <div className="group relative inline-flex items-center shrink-0 ml-2">
            <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help" />
            <div className="invisible group-hover:visible absolute right-6 top-0 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg">
              <div className="absolute -right-1 top-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
              Confirm a student has demonstrated competency in this skill. Sign-offs are recorded with your name and timestamp and cannot be revoked.
            </div>
          </div>
        </div>

        {!signoffCollapsed && (
          <div className="p-4 space-y-4">
            {/* Skill selector + bulk action bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <select
                  value={signoffSkillId}
                  onChange={e => {
                    setSignoffSkillId(e.target.value);
                    setSignoffBulkSelected([]);
                    setSignoffConfirm({});
                    setSignoffBulkConfirm(false);
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a skill...</option>
                  {Array.from(new Set(skills.map(s => s.category))).sort().map(category => (
                    <optgroup key={category} label={category}>
                      {skills.filter(s => s.category === category).map(skill => (
                        <option key={skill.id} value={skill.id}>{skill.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {signoffSkillId && signoffBulkSelected.length > 0 && (
                <button
                  onClick={handleBulkSignoff}
                  disabled={signoffBulkSaving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    signoffBulkConfirm
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  } disabled:opacity-50`}
                >
                  {signoffBulkSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : signoffBulkConfirm ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {signoffBulkConfirm
                    ? `Confirm sign-off ${signoffBulkSelected.length}?`
                    : `Bulk Sign-off (${signoffBulkSelected.length})`}
                </button>
              )}

              {signoffSkillId && (
                <button
                  onClick={() => {
                    const unsigned = cohortStudents
                      .filter(s => {
                        const entry = signoffs[`${s.id}:${signoffSkillId}`];
                        return !entry || entry.revoked;
                      })
                      .map(s => s.id);
                    setSignoffBulkSelected(unsigned);
                  }}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Select unsigned
                </button>
              )}

              {signoffBulkSelected.length > 0 && (
                <button
                  onClick={() => setSignoffBulkSelected([])}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Student list */}
            {signoffLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : !signoffSkillId ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                Select a skill above to view and record sign-offs.
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700 border dark:border-gray-700 rounded-lg overflow-hidden">
                {cohortStudents.map(student => {
                  const key = `${student.id}:${signoffSkillId}`;
                  const signoff = signoffs[key];
                  const isSigned = signoff && !signoff.revoked;
                  const isSaving = signoffSaving[student.id];
                  const isConfirming = signoffConfirm[key];
                  const isSelected = signoffBulkSelected.includes(student.id);
                  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();

                  return (
                    <div
                      key={student.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSigned
                          ? 'bg-emerald-50 dark:bg-emerald-900/10'
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                      }`}
                    >
                      {/* Checkbox for bulk */}
                      {!isSigned && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setSignoffBulkSelected(prev => [...prev, student.id]);
                            } else {
                              setSignoffBulkSelected(prev => prev.filter(id => id !== student.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                      )}
                      {isSigned && <div className="w-4 shrink-0" />}

                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 overflow-hidden">
                        {(student as any).photo_url ? (
                          <img
                            src={(student as any).photo_url}
                            alt={`${student.first_name} ${student.last_name}`}
                            className="w-8 h-8 object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{initials}</span>
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        {isSigned && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                            Signed by {signoff.signed_off_by.split('@')[0]} on{' '}
                            {new Date(signoff.signed_off_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                        {signoff?.revoked && (
                          <p className="text-xs text-red-500 dark:text-red-400">Revoked</p>
                        )}
                      </div>

                      {/* Status / action */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isSigned ? (
                          <>
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                              <CheckCircle className="w-4 h-4" />
                              Signed
                            </span>
                            {userRole && hasMinRole(userRole, 'lead_instructor') && (
                              <button
                                onClick={() => {
                                  setSignoffRevokeId(signoff.id);
                                  setSignoffRevokeReason('');
                                }}
                                className="text-xs text-red-500 dark:text-red-400 hover:underline ml-1"
                                title="Revoke sign-off"
                              >
                                Revoke
                              </button>
                            )}
                          </>
                        ) : isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleSignoff(student.id)}
                              disabled={!signoffSkillId}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isConfirming
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
                              } disabled:opacity-50`}
                            >
                              {isConfirming ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Confirm?
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Sign Off
                                </>
                              )}
                            </button>
                            {!isConfirming && (
                              <HelpTooltip text="Once signed, this confirmation is permanent and cannot be reversed. It records your name and timestamp as the signing instructor." />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revoke Signoff Modal */}
      {signoffRevokeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Revoke Sign-off
              </h2>
              <button
                onClick={() => { setSignoffRevokeId(null); setSignoffRevokeReason(''); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will mark the sign-off as revoked. The record is preserved for audit purposes.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={signoffRevokeReason}
                  onChange={e => setSignoffRevokeReason(e.target.value)}
                  placeholder="e.g., Retraction due to error"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => { setSignoffRevokeId(null); setSignoffRevokeReason(''); }}
                disabled={signoffRevoking}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeSignoff}
                disabled={signoffRevoking}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                {signoffRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Revoke Sign-off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
