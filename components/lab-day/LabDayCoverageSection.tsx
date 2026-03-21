'use client';

import { formatInstructorName } from '@/lib/format-name';
import {
  ChevronRight,
  ChevronDown,
  Check,
  X,
  UserCheck,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

interface ShiftCoverage {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  signups: {
    id: string;
    status: string;
    instructor: { id: string; name: string; email: string } | null;
  }[];
}

interface LabDayCoverageSectionProps {
  coverageShifts: ShiftCoverage[];
  coverageCollapsed: boolean;
  userRole: string | null;
  onToggleCollapse: () => void;
  onRefresh: () => void;
}

export default function LabDayCoverageSection({
  coverageShifts,
  coverageCollapsed,
  userRole,
  onToggleCollapse,
  onRefresh,
}: LabDayCoverageSectionProps) {
  const toast = useToast();

  if (coverageShifts.length === 0) return null;

  const handleAcceptSignup = async (shiftId: string, signupId: string) => {
    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}/signup/${signupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      const data = await res.json();
      if (data.success) {
        toast?.addToast('success', 'Signup confirmed');
        onRefresh();
      } else {
        toast?.addToast('error', data.error || 'Failed to confirm signup');
      }
    } catch (error) {
      console.error('Error confirming signup:', error);
      toast?.addToast('error', 'Failed to confirm signup');
    }
  };

  const handleDeclineSignup = async (shiftId: string, signupId: string) => {
    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}/signup/${signupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', reason: 'Declined by admin' }),
      });
      const data = await res.json();
      if (data.success) {
        toast?.addToast('success', 'Signup declined');
        onRefresh();
      } else {
        toast?.addToast('error', data.error || 'Failed to decline signup');
      }
    } catch (error) {
      console.error('Error declining signup:', error);
      toast?.addToast('error', 'Failed to decline signup');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:shadow-none print:border print:border-gray-300">
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-between w-full mb-3"
      >
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          Coverage &mdash; Shift Signups
        </h3>
        {coverageCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {!coverageCollapsed && (
        <div className="space-y-3">
          {coverageShifts.map(shift => {
            const confirmed = shift.signups.filter(s => s.status === 'confirmed');
            const pending = shift.signups.filter(s => s.status === 'pending');
            return (
              <div key={shift.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{shift.title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)}
                    </span>
                  </div>
                </div>
                {/* Confirmed signups */}
                {confirmed.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {confirmed.map(signup => (
                      <span
                        key={signup.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {formatInstructorName(signup.instructor?.name || '') || signup.instructor?.email?.split('@')[0] || 'Unknown'}
                      </span>
                    ))}
                  </div>
                )}
                {/* Pending signups with accept/decline */}
                {pending.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending ({pending.length})</p>
                    {pending.map(signup => (
                      <div key={signup.id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {formatInstructorName(signup.instructor?.name || '') || signup.instructor?.email?.split('@')[0] || 'Unknown'}
                        </span>
                        {userRole && (userRole === 'admin' || userRole === 'superadmin' || userRole === 'lead_instructor') && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleAcceptSignup(shift.id, signup.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/60"
                              title="Accept signup"
                            >
                              <Check className="w-3 h-3" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineSignup(shift.id, signup.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/60"
                              title="Decline signup"
                            >
                              <X className="w-3 h-3" />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {confirmed.length === 0 && pending.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">No signups yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
