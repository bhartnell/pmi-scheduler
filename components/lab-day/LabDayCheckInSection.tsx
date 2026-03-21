'use client';

import { useState } from 'react';
import {
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import type { LabDay } from './types';

interface LabDayCheckInSectionProps {
  labDay: LabDay;
  labDayId: string;
  onLabDayUpdate: (updater: (prev: LabDay | null) => LabDay | null) => void;
}

export default function LabDayCheckInSection({ labDay, labDayId, onLabDayUpdate }: LabDayCheckInSectionProps) {
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  const handleEnableCheckIn = async () => {
    setCheckInLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, { method: 'POST' }); const data = await res.json(); if (data.success) onLabDayUpdate(prev => prev ? { ...prev, checkin_token: data.checkin_token, checkin_enabled: true } : prev); else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); }
    setCheckInLoading(false);
  };

  const handleDisableCheckIn = async () => {
    setCheckInLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, { method: 'DELETE' }); const data = await res.json(); if (data.success) onLabDayUpdate(prev => prev ? { ...prev, checkin_enabled: false } : prev); }
    catch (error) { console.error('Error:', error); }
    setCheckInLoading(false);
  };

  const handleCopyCheckInLink = async () => {
    if (!labDay?.checkin_token) return;
    const url = `${window.location.origin}/checkin/${labDay.checkin_token}`;
    try { await navigator.clipboard.writeText(url); setCopyLinkSuccess(true); setTimeout(() => setCopyLinkSuccess(false), 2500); }
    catch { alert('Check-in URL: ' + url); }
  };

  return (
    <div className="mt-6 print:hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${labDay.checkin_enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <UserCheck className={`w-5 h-5 ${labDay.checkin_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Student Self Check-In</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{labDay.checkin_enabled ? 'Check-in is active — students can tap their name to mark themselves present.' : 'Enable to give students a link to check themselves in.'}</p>
            </div>
          </div>
          <button onClick={labDay.checkin_enabled ? handleDisableCheckIn : handleEnableCheckIn} disabled={checkInLoading} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors disabled:opacity-50 ${labDay.checkin_enabled ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
            {checkInLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : labDay.checkin_enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {labDay.checkin_enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        {labDay.checkin_enabled && labDay.checkin_token && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Check-In Link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 min-w-0">
                <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-gray-300 font-mono truncate">{typeof window !== 'undefined' ? `${window.location.origin}/checkin/${labDay.checkin_token}` : `/checkin/${labDay.checkin_token}`}</span>
              </div>
              <button onClick={handleCopyCheckInLink} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors ${copyLinkSuccess ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                {copyLinkSuccess ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Share this link with students or display it on screen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
