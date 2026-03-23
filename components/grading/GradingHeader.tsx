'use client';

import { formatCohortNumber } from '@/lib/format-cohort';
import Link from 'next/link';
import {
  ChevronRight,
  Save,
  XCircle,
  Loader2,
  Check
} from 'lucide-react';
import type { Station } from './types';

interface GradingHeaderProps {
  station: Station;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saving: boolean;
  isSkillsStation: boolean;
  allRated: boolean;
  selectedStudentId: string;
  selectedGroupId: string;
  teamLeaderId: string;
  onSave: () => void;
}

export default function GradingHeader({
  station,
  saveStatus,
  saving,
  isSkillsStation,
  allRated,
  selectedStudentId,
  selectedGroupId,
  teamLeaderId,
  onSave,
}: GradingHeaderProps) {
  const labDay = station.lab_day;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/labs" className="hover:text-blue-600 dark:hover:text-blue-400">Labs</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/labs/schedule/${labDay.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
            {new Date(labDay.date + 'T12:00:00').toLocaleDateString()}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>Grade</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Station {station.station_number} - Grade Rotation
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {labDay.cohort.program.abbreviation} Group {formatCohortNumber(labDay.cohort.cohort_number)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-save status indicator */}
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span>Save failed</span>
              </div>
            )}

            <button
              onClick={onSave}
              disabled={saving || (isSkillsStation ? !selectedStudentId : (!allRated || !selectedGroupId || !teamLeaderId))}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
