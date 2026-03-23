'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Check,
  X,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { LabDay } from './types';

interface DuplicateModalsProps {
  labDay: LabDay;
  labDayId: string;
  showDuplicateModal: boolean;
  showNextWeekConfirm: boolean;
  showBulkDuplicateModal: boolean;
  onCloseDuplicate: () => void;
  onCloseNextWeek: () => void;
  onCloseBulkDuplicate: () => void;
  onDuplicated: (newLabDayId: string) => void;
  formatDate: (dateString: string) => string;
}

export default function DuplicateModals({
  labDay,
  labDayId,
  showDuplicateModal,
  showNextWeekConfirm,
  showBulkDuplicateModal,
  onCloseDuplicate,
  onCloseNextWeek,
  onCloseBulkDuplicate,
  onDuplicated,
  formatDate,
}: DuplicateModalsProps) {
  const toast = useToast();

  // Single duplicate state
  const [duplicateDate, setDuplicateDate] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // Copy to next week state
  const [copyingNextWeek, setCopyingNextWeek] = useState(false);

  // Bulk duplicate state
  const [bulkSelectedDates, setBulkSelectedDates] = useState<string[]>([]);
  const [bulkCalendarMonth, setBulkCalendarMonth] = useState<Date>(() => {
    const baseDate = labDay?.date ? new Date(labDay.date + 'T12:00:00') : new Date();
    return new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  });
  const [bulkDuplicating, setBulkDuplicating] = useState(false);
  const [bulkDuplicateProgress, setBulkDuplicateProgress] = useState<{
    status: 'idle' | 'running' | 'done';
    total: number;
    current: number;
    createdIds: string[];
    failed: Array<{ date: string; error: string }>;
  }>({ status: 'idle', total: 0, current: 0, createdIds: [], failed: [] });

  const getNextWeekDate = (): string => {
    if (!labDay?.date) return '';
    const d = new Date(labDay.date + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const handleDuplicate = async () => {
    if (!duplicateDate) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: duplicateDate })
      });
      const data = await res.json();
      if (data.success && data.newLabDayId) {
        onCloseDuplicate();
        onDuplicated(data.newLabDayId);
      } else {
        alert('Failed to duplicate: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error duplicating lab day:', error);
      alert('An error occurred while duplicating the lab day.');
    }
    setDuplicating(false);
  };

  const handleCopyToNextWeek = async () => {
    const nextDate = getNextWeekDate();
    if (!nextDate) return;
    setCopyingNextWeek(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: nextDate })
      });
      const data = await res.json();
      if (data.success && data.newLabDayId) {
        onCloseNextWeek();
        onDuplicated(data.newLabDayId);
      } else {
        alert('Failed to copy: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error copying lab day to next week:', error);
      alert('An error occurred while copying the lab day.');
    }
    setCopyingNextWeek(false);
  };

  // Calendar helpers
  const getBulkCalendarDays = (): Array<{ date: Date | null; dateStr: string | null }> => {
    const year = bulkCalendarMonth.getFullYear();
    const month = bulkCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, dateStr });
    }
    return cells;
  };

  const isBulkDatePast = (date: Date): boolean => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return date < todayMidnight;
  };

  const isBulkDateToday = (date: Date): boolean => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };

  const formatBulkDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getWeekdayName = (): string => {
    if (!labDay?.date) return 'weekday';
    const d = new Date(labDay.date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const toggleBulkDate = (dateStr: string) => {
    setBulkSelectedDates(prev => {
      if (prev.includes(dateStr)) return prev.filter(d => d !== dateStr);
      if (prev.length >= 10) return prev;
      return [...prev, dateStr].sort();
    });
  };

  const bulkQuickSelectSameDayNextWeeks = () => {
    if (!labDay?.date) return;
    const base = new Date(labDay.date + 'T12:00:00');
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const dates: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 7);
      if (d >= todayMidnight) dates.push(d.toISOString().split('T')[0]);
    }
    setBulkSelectedDates(prev => [...new Set([...prev, ...dates])].sort().slice(0, 10));
  };

  const bulkQuickSelectEveryWeekdayInMonth = () => {
    if (!labDay?.date) return;
    const base = new Date(labDay.date + 'T12:00:00');
    const targetDay = base.getDay();
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const year = bulkCalendarMonth.getFullYear();
    const month = bulkCalendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === targetDay && d >= todayMidnight) dates.push(d.toISOString().split('T')[0]);
    }
    setBulkSelectedDates(prev => [...new Set([...prev, ...dates])].sort().slice(0, 10));
  };

  const handleBulkDuplicate = async () => {
    if (bulkSelectedDates.length === 0) return;
    setBulkDuplicating(true);
    setBulkDuplicateProgress({ status: 'running', total: bulkSelectedDates.length, current: 0, createdIds: [], failed: [] });

    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: bulkSelectedDates }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkDuplicateProgress({
          status: 'done',
          total: bulkSelectedDates.length,
          current: bulkSelectedDates.length,
          createdIds: data.created || [],
          failed: data.failed || [],
        });
        if ((data.created || []).length > 0) toast.success(`Created ${data.created.length} lab day${data.created.length === 1 ? '' : 's'} successfully`);
        if ((data.failed || []).length > 0) toast.error(`${data.failed.length} date(s) failed to create`);
      } else {
        setBulkDuplicateProgress(prev => ({ ...prev, status: 'done' }));
        toast.error('Failed to duplicate lab days: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error bulk duplicating lab days:', error);
      setBulkDuplicateProgress(prev => ({ ...prev, status: 'done' }));
      toast.error('An error occurred while duplicating lab days');
    }
    setBulkDuplicating(false);
  };

  return (
    <>
      {/* Bulk Duplicate Modal */}
      {showBulkDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Duplicate Lab Day to Multiple Dates
              </h2>
              <button onClick={() => { if (!bulkDuplicating) onCloseBulkDuplicate(); }} disabled={bulkDuplicating} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">Source: </span>
                {labDay?.title && <span>{labDay.title} — </span>}
                {labDay?.date ? formatDate(labDay.date) : 'this lab day'}
                <span className="ml-2 text-xs">({labDay.stations?.length ?? 0} stations)</span>
              </div>

              {bulkDuplicateProgress.status === 'done' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                    <Check className="w-5 h-5" />
                    Done! Created {bulkDuplicateProgress.createdIds.length} of {bulkDuplicateProgress.total} lab days
                  </div>
                  {bulkDuplicateProgress.createdIds.length > 0 && (
                    <div className="space-y-1">
                      {bulkDuplicateProgress.createdIds.map((newId, idx) => (
                        <Link key={newId} href={`/labs/schedule/${newId}`} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline" onClick={onCloseBulkDuplicate}>
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          View new lab day {idx + 1}
                        </Link>
                      ))}
                    </div>
                  )}
                  {bulkDuplicateProgress.failed.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed dates:</p>
                      {bulkDuplicateProgress.failed.map(f => (
                        <p key={f.date} className="text-xs text-red-600 dark:text-red-400">{formatBulkDate(f.date)}: {f.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : bulkDuplicateProgress.status === 'running' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    Creating lab days...
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${bulkDuplicateProgress.total > 0 ? (bulkDuplicateProgress.current / bulkDuplicateProgress.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Processing {bulkDuplicateProgress.total} date{bulkDuplicateProgress.total !== 1 ? 's' : ''}...</p>
                </div>
              ) : (
                <>
                  {/* Calendar picker */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select dates:</p>
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700">
                        <button onClick={() => setBulkCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {bulkCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => setBulkCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 text-center">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                          <div key={day} className="py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">{day}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 text-center p-1 gap-0.5">
                        {getBulkCalendarDays().map((cell, idx) => {
                          if (!cell.date || !cell.dateStr) return <div key={`empty-${idx}`} />;
                          const isPast = isBulkDatePast(cell.date);
                          const isToday = isBulkDateToday(cell.date);
                          const isSelected = bulkSelectedDates.includes(cell.dateStr);
                          const isMaxed = bulkSelectedDates.length >= 10 && !isSelected;
                          return (
                            <button
                              key={cell.dateStr}
                              onClick={() => !isPast && !isMaxed && toggleBulkDate(cell.dateStr!)}
                              disabled={isPast || isMaxed}
                              className={[
                                'w-full aspect-square flex items-center justify-center rounded text-sm transition-colors',
                                isPast ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : isSelected ? 'bg-blue-600 text-white font-semibold'
                                  : isToday ? 'ring-2 ring-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                  : isMaxed ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                              ].join(' ')}
                            >
                              {cell.date.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {bulkSelectedDates.length >= 10 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Maximum 10 dates selected</p>
                    )}
                  </div>

                  {/* Quick select */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quick select</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={bulkQuickSelectSameDayNextWeeks} className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40">
                        Same day next 4 weeks
                      </button>
                      <button onClick={bulkQuickSelectEveryWeekdayInMonth} className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40">
                        Every {getWeekdayName()} in {bulkCalendarMonth.toLocaleDateString('en-US', { month: 'long' })}
                      </button>
                    </div>
                  </div>

                  {/* Selected dates list */}
                  {bulkSelectedDates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected dates ({bulkSelectedDates.length}):</p>
                      <ul className="space-y-1">
                        {bulkSelectedDates.map(dateStr => (
                          <li key={dateStr} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{formatBulkDate(dateStr)}</span>
                            <button onClick={() => setBulkSelectedDates(prev => prev.filter(d => d !== dateStr))} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-2">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {bulkSelectedDates.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium">Preview: Will create {bulkSelectedDates.length} new lab day{bulkSelectedDates.length !== 1 ? 's' : ''}</p>
                      <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">Each with the same stations, skills, and configuration</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700 flex-shrink-0">
              {bulkDuplicateProgress.status === 'done' ? (
                <button onClick={onCloseBulkDuplicate} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">Close</button>
              ) : (
                <>
                  <button onClick={onCloseBulkDuplicate} disabled={bulkDuplicating} className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Cancel</button>
                  <button onClick={handleBulkDuplicate} disabled={bulkSelectedDates.length === 0 || bulkDuplicating} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
                    {bulkDuplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {bulkDuplicating ? 'Creating...' : `Create ${bulkSelectedDates.length} Lab Day${bulkSelectedDates.length !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Lab Day Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Duplicate Lab Day
              </h2>
              <button onClick={onCloseDuplicate} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will create a copy of <strong className="text-gray-900 dark:text-white">{labDay?.date ? formatDate(labDay.date) : 'this lab day'}</strong> with all its stations, skills, and configuration on a new date.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p><span className="font-medium">Stations:</span> {labDay.stations?.length ?? 0}</p>
                <p><span className="font-medium">Rotations:</span> {labDay.num_rotations} x {labDay.rotation_duration} min</p>
                {labDay.title && <p><span className="font-medium">Title:</span> {labDay.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Date</label>
                <input type="date" value={duplicateDate} onChange={e => setDuplicateDate(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button onClick={onCloseDuplicate} disabled={duplicating} className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Cancel</button>
              <button onClick={handleDuplicate} disabled={!duplicateDate || duplicating} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {duplicating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Copy className="w-4 h-4" />}
                {duplicating ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy to Next Week Confirm */}
      {showNextWeekConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Copy to Next Week
              </h2>
              <button onClick={onCloseNextWeek} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Copy this lab day to{' '}
                <strong className="text-gray-900 dark:text-white">
                  {getNextWeekDate() ? formatDate(getNextWeekDate()) : 'next week'}
                </strong>
                ? All stations, skills, and configuration will be copied.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button onClick={onCloseNextWeek} disabled={copyingNextWeek} className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Cancel</button>
              <button onClick={handleCopyToNextWeek} disabled={copyingNextWeek} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {copyingNextWeek ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Calendar className="w-4 h-4" />}
                {copyingNextWeek ? 'Copying...' : 'Copy to Next Week'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
