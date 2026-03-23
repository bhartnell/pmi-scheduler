'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Download,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import ExportDropdown from '@/components/ExportDropdown';
import type { ExportConfig } from '@/lib/export-utils';

interface DebriefNote {
  id: string;
  author_name: string | null;
  category: string;
  content: string;
  created_at: string;
}

interface LabDayWithNotes {
  id: string;
  date: string;
  title: string | null;
  week_number: number | null;
  day_number: number | null;
  cohort_id: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string } | null;
  } | null;
  debrief_notes: DebriefNote[];
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string } | null;
}

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'timing', label: 'Timing', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'station_feedback', label: 'Station Feedback', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'student_performance', label: 'Student Performance', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'equipment', label: 'Equipment', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'improvement', label: 'Improvement Idea', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'positive', label: 'What Went Well', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
];

function getCategoryStyle(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.color || CATEGORIES[0].color;
}

function getCategoryLabel(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.label || 'General';
}

export default function DebriefReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [labDays, setLabDays] = useState<LabDayWithNotes[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filters
  const today = new Date();
  const semesterStart = new Date(today.getFullYear(), today.getMonth() >= 6 ? 6 : 0, 1);
  const [startDate, setStartDate] = useState(semesterStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch cohorts
  useEffect(() => {
    if (!session) return;
    fetch('/api/lab-management/cohorts')
      .then(res => res.json())
      .then(data => {
        if (data.success || data.cohorts) {
          setCohorts(data.cohorts || []);
        }
      })
      .catch(console.error);
  }, [session]);

  // Fetch debrief notes
  useEffect(() => {
    if (!session) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (selectedCohortId) params.set('cohortId', selectedCohortId);
    if (selectedCategory) params.set('category', selectedCategory);

    fetch(`/api/lab-management/debrief-notes?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLabDays(data.labDays || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session, startDate, endDate, selectedCohortId, selectedCategory]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalNotes = useMemo(() =>
    labDays.reduce((sum, ld) => sum + (ld.debrief_notes?.length || 0), 0),
    [labDays]
  );

  const exportConfig: ExportConfig = useMemo(() => {
    const rows = labDays.flatMap(ld =>
      (ld.debrief_notes || []).map(note => ({
        Date: ld.date,
        Cohort: ld.cohort
          ? `${ld.cohort.program?.abbreviation || 'PMI'} Cohort ${ld.cohort.cohort_number}`
          : '',
        'Week/Day': ld.week_number && ld.day_number
          ? `W${ld.week_number}D${ld.day_number}`
          : '',
        Category: getCategoryLabel(note.category),
        Author: note.author_name || 'Unknown',
        Content: note.content,
      }))
    );

    return {
      title: 'Debrief Notes Review',
      filename: 'debrief-notes-review',
      columns: [
        { key: 'Date', label: 'Date' },
        { key: 'Cohort', label: 'Cohort' },
        { key: 'Week/Day', label: 'Week/Day' },
        { key: 'Category', label: 'Category' },
        { key: 'Author', label: 'Author' },
        { key: 'Content', label: 'Content' },
      ],
      data: rows,
    };
  }, [labDays]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-7 h-7 text-blue-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Debrief Review</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Review instructor debrief notes across lab days
                </p>
              </div>
            </div>
            {totalNotes > 0 && (
              <ExportDropdown config={exportConfig} />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cohort</label>
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Cohorts</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || 'PMI'} Cohort {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {labDays.length} lab day{labDays.length !== 1 ? 's' : ''} with {totalNotes} note{totalNotes !== 1 ? 's' : ''}
          </span>
          {labDays.length > 0 && (
            <button
              onClick={() => {
                if (expandedIds.size === labDays.length) {
                  setExpandedIds(new Set());
                } else {
                  setExpandedIds(new Set(labDays.map(ld => ld.id)));
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {expandedIds.size === labDays.length ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        {/* Lab day list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            Loading debrief notes...
          </div>
        ) : labDays.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">No debrief notes found for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {labDays.map(ld => {
              const cohortLabel = ld.cohort
                ? `${ld.cohort.program?.abbreviation || 'PMI'} Cohort ${ld.cohort.cohort_number}`
                : '';
              const weekDay = ld.week_number && ld.day_number
                ? `W${ld.week_number}D${ld.day_number}`
                : '';
              const isExpanded = expandedIds.has(ld.id);

              return (
                <div
                  key={ld.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    onClick={() => toggleExpanded(ld.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(ld.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          {weekDay && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">({weekDay})</span>
                          )}
                          {cohortLabel && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                              {cohortLabel}
                            </span>
                          )}
                        </div>
                        {ld.title && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ld.title}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                        {ld.debrief_notes?.length || 0} note{(ld.debrief_notes?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                      {(ld.debrief_notes || []).map(note => (
                        <div
                          key={note.id}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.author_name || 'Unknown'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryStyle(note.category)}`}>
                              {getCategoryLabel(note.category)}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                              {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
