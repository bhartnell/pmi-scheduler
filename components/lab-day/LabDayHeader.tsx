'use client';

import { useState } from 'react';
import { formatCohortNumber } from '@/lib/format-cohort';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  Calendar,
  Plus,
  Edit2,
  FileText,
  Users,
  Clock,
  Printer,
  Download,
  Timer,
  Copy,
  CalendarPlus,
  Monitor,
  ClipboardCheck,
} from 'lucide-react';
import InlineTimerWidget from '@/components/InlineTimerWidget';
import BreadcrumbNames from '@/components/layout/BreadcrumbNames';
import type { LabDay } from './types';

interface LabDayHeaderProps {
  labDay: LabDay;
  labDayId: string;
  showDuplicateDropdown: boolean;
  onSetShowDuplicateDropdown: (show: boolean | ((prev: boolean) => boolean)) => void;
  onOpenTimer: () => void;
  /** Called after rotation minutes / count are saved so the page re-fetches the lab day. */
  onRotationSaved?: () => void;
  onPrint: () => void;
  onDownloadPDF: () => void;
  onExportCalendar: () => void;
  onPrintRoster: () => void;
  onCSVExport: () => void;
  onOpenDuplicateModal: () => void;
  onOpenNextWeekConfirm: () => void;
  onOpenBulkDuplicateModal: () => void;
  formatDate: (dateString: string) => string;
  formatTime: (timeString: string | null) => string | null;
}

const MENU_ITEM_CLASS =
  'w-full text-left px-4 min-h-[44px] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2';

export default function LabDayHeader({
  labDay,
  labDayId,
  showDuplicateDropdown,
  onSetShowDuplicateDropdown,
  onOpenTimer,
  onRotationSaved,
  onPrint,
  onDownloadPDF,
  onExportCalendar,
  onPrintRoster,
  onCSVExport,
  onOpenDuplicateModal,
  onOpenNextWeekConfirm,
  onOpenBulkDuplicateModal,
  formatDate,
  formatTime,
}: LabDayHeaderProps) {
  // Rotation minutes / count editor (feedback 460eb62f). lab_days.rotation_duration is the
  // authoritative value; the PATCH also mirrors it into a STOPPED timer row.
  const [editingRotation, setEditingRotation] = useState(false);
  const [rotMinutes, setRotMinutes] = useState('');
  const [rotCount, setRotCount] = useState('');
  const [rotSaving, setRotSaving] = useState(false);
  const [rotError, setRotError] = useState<string | null>(null);
  const openRotationEditor = () => {
    setRotMinutes(String(labDay.rotation_duration ?? ''));
    setRotCount(String(labDay.num_rotations ?? ''));
    setRotError(null);
    setEditingRotation(true);
  };
  const saveRotation = async () => {
    const minutes = Number(rotMinutes);
    const count = Number(rotCount);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180 || !Number.isInteger(count) || count < 1 || count > 30) {
      setRotError('Minutes 1-180 and rotations 1-30, whole numbers.');
      return;
    }
    setRotSaving(true);
    setRotError(null);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotation_duration: minutes, num_rotations: count }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setRotError(data.error || 'Could not save');
      } else {
        setEditingRotation(false);
        onRotationSaved?.();
      }
    } catch {
      setRotError('Network error');
    } finally {
      setRotSaving(false);
    }
  };

  const menuItem = (Icon: LucideIcon, label: string, onClick: () => void) => (
    <button
      role="menuitem"
      onClick={() => { onSetShowDuplicateDropdown(false); onClick(); }}
      className={MENU_ITEM_CLASS}
    >
      <Icon className="w-4 h-4 text-gray-500" />
      {label}
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
      <div className="w-full px-4 md:px-6 2xl:px-8 py-6">
        <BreadcrumbNames
          entityTitle={labDay.title || `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`}
        />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0 lg:basis-2/5 lg:grow">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
              {formatDate(labDay.date)}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
              {(labDay.start_time || labDay.end_time) ? (
                <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="w-4 h-4" />
                  {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                  Time not set
                </span>
              )}
              {labDay.week_number && labDay.day_number && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Week {labDay.week_number}, Day {labDay.day_number}
                </span>
              )}
              {editingRotation ? (
                <span className="flex flex-wrap items-center gap-2 print:hidden">
                  <input
                    type="number" min={1} max={30} value={rotCount}
                    onChange={e => setRotCount(e.target.value)}
                    aria-label="Number of rotations"
                    className="w-16 min-h-[44px] px-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span>rotations ×</span>
                  <input
                    type="number" min={1} max={180} value={rotMinutes}
                    onChange={e => setRotMinutes(e.target.value)}
                    aria-label="Rotation minutes"
                    className="w-20 min-h-[44px] px-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span>min</span>
                  <button onClick={saveRotation} disabled={rotSaving} className="px-3 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {rotSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingRotation(false)} className="px-3 min-h-[44px] border rounded-lg dark:border-gray-600">Cancel</button>
                  {rotError && <span className="text-red-600 dark:text-red-400">{rotError}</span>}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={openRotationEditor}
                  title="Set rotation minutes and number of rotations"
                  className="flex items-center gap-1 min-h-[44px] hover:underline print:no-underline"
                >
                  {labDay.num_rotations} rotations × {labDay.rotation_duration} min
                  <Edit2 className="w-3 h-3 print:hidden" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end print:hidden shrink-0">
            {/* Inline timer widget */}
            <InlineTimerWidget
              labDayId={labDayId}
              onOpenFullTimer={onOpenTimer}
              paused={false}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={onOpenTimer}
                className="inline-flex items-center gap-2 px-3 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Timer className="w-4 h-4" />
                Start Timer
              </button>
              <button
                onClick={() => window.open(`/timer-display/live/${labDayId}`, '_blank')}
                className="inline-flex items-center gap-2 px-3 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                title="Open full-screen timer display in new tab"
              >
                <Monitor className="w-4 h-4" />
                Timer Display
              </button>
              <Link
                href={`/labs/schedule/${labDayId}/results`}
                className="inline-flex items-center gap-2 px-3 min-h-[44px] bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                title="View skill evaluation results"
              >
                <ClipboardCheck className="w-4 h-4" />
                Results
              </Link>
              {/* More menu: everything else (open state reuses the page's dropdown state) */}
              <div className="relative inline-flex">
                <button
                  onClick={() => onSetShowDuplicateDropdown((prev: boolean) => !prev)}
                  className="inline-flex items-center gap-2 px-3 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  aria-haspopup="menu"
                  aria-expanded={showDuplicateDropdown}
                >
                  More
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showDuplicateDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => onSetShowDuplicateDropdown(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1"
                    >
                      {menuItem(Printer, 'Print', onPrint)}
                      {menuItem(Download, 'PDF', onDownloadPDF)}
                      {menuItem(CalendarPlus, 'Export to Calendar (.ics)', onExportCalendar)}
                      {menuItem(Users, 'Print roster', onPrintRoster)}
                      {menuItem(FileText, 'Roster CSV', onCSVExport)}
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                      {menuItem(Copy, 'Duplicate', onOpenDuplicateModal)}
                      {menuItem(Calendar, 'Copy to Next Week', onOpenNextWeekConfirm)}
                      {menuItem(Copy, 'Copy to Multiple Dates...', onOpenBulkDuplicateModal)}
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                      <Link
                        href={`/labs/schedule/${labDayId}/edit`}
                        role="menuitem"
                        className={MENU_ITEM_CLASS}
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                        Edit
                      </Link>
                      <Link
                        href={`/labs/schedule/${labDayId}/stations/new`}
                        role="menuitem"
                        className={MENU_ITEM_CLASS}
                      >
                        <Plus className="w-4 h-4 text-gray-500" />
                        Add Station
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
