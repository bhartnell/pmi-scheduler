'use client';

import { formatCohortNumber } from '@/lib/format-cohort';
import Link from 'next/link';
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
import Breadcrumbs from '@/components/Breadcrumbs';
import { ArrowLeft } from 'lucide-react';
import type { LabDay } from './types';

interface LabDayHeaderProps {
  labDay: LabDay;
  labDayId: string;
  showDuplicateDropdown: boolean;
  onSetShowDuplicateDropdown: (show: boolean | ((prev: boolean) => boolean)) => void;
  onOpenTimer: () => void;
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

export default function LabDayHeader({
  labDay,
  labDayId,
  showDuplicateDropdown,
  onSetShowDuplicateDropdown,
  onOpenTimer,
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
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Breadcrumbs
              entityTitle={labDay.title || `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`}
              className="mb-1"
            />
            <Link
              href="/labs/schedule"
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Schedule
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {formatDate(labDay.date)}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
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
              <span className="flex items-center gap-1">
                {labDay.num_rotations} rotations × {labDay.rotation_duration} min
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end print:hidden">
            {/* Inline timer widget */}
            <InlineTimerWidget
              labDayId={labDayId}
              onOpenFullTimer={onOpenTimer}
              paused={false}
            />
            <div className="flex gap-2">
              <button
                onClick={onOpenTimer}
                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Timer className="w-4 h-4" />
                Start Timer
              </button>
              <button
                onClick={() => window.open(`/timer-display/live/${labDayId}`, '_blank')}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 lg:px-3 lg:py-2 max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-medium"
                title="Open full-screen timer display in new tab"
              >
                <Monitor className="w-4 h-4 max-lg:w-5 max-lg:h-5" />
                <span className="hidden sm:inline">Timer Display</span>
                <span className="sm:hidden">Display</span>
              </button>
              <Link
                href={`/labs/schedule/${labDayId}/results`}
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                title="View skill evaluation results"
              >
                <ClipboardCheck className="w-4 h-4" />
                Results
              </Link>
              <button
                onClick={onPrint}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={onDownloadPDF}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={onExportCalendar}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Export to Calendar (.ics)"
              >
                <CalendarPlus className="w-4 h-4" />
                Calendar
              </button>
              <button
                onClick={onPrintRoster}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Print student roster"
              >
                <Users className="w-4 h-4" />
                Roster
              </button>
              <button
                onClick={onCSVExport}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Download roster as CSV"
              >
                <FileText className="w-4 h-4" />
                CSV
              </button>
              {/* Duplicate split button */}
              <div className="relative inline-flex">
                <button
                  onClick={onOpenDuplicateModal}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-l-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-r-0"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => onSetShowDuplicateDropdown((prev: boolean) => !prev)}
                  className="inline-flex items-center px-1.5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-r-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  title="More duplicate options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showDuplicateDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => onSetShowDuplicateDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                      <button
                        onClick={onOpenNextWeekConfirm}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Copy to Next Week
                      </button>
                      <button
                        onClick={onOpenBulkDuplicateModal}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4 text-purple-500" />
                        Copy to Multiple Dates...
                      </button>
                    </div>
                  </>
                )}
              </div>
              <Link
                href={`/labs/schedule/${labDayId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <Link
                href={`/labs/schedule/${labDayId}/stations/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Station
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
