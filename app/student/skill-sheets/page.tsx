'use client';

/**
 * Student Skill Sheets Page
 *
 * Read-only view of all skills and their signoff status for the current student.
 *   - Browse skills grouped by category
 *   - View signoff history (date, signed-off-by, lab day)
 *   - Filter by: signed off / not yet signed off, category
 *   - Progress summary: "X of Y skills signed off"
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  CheckCircle,
  Clock,
  Search,
  Filter,
  X,
  TrendingUp,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { parseDateSafe } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  signedOff: boolean;
  signedOffAt: string | null;
  signedOffBy: string | null;
  labDayDate: string | null;
  labDayTitle: string | null;
  hasSkillSheet: boolean;
  skillSheetId: string | null;
  skillSheetSource: string | null;
  skillSheetOverview: string | null;
}

interface Summary {
  total: number;
  signedOff: number;
  remaining: number;
  percentage: number;
}

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  cohort: {
    id: string;
    cohortNumber: number;
    program: { name: string; abbreviation: string } | null;
  } | null;
}

interface SkillSheetsData {
  success: boolean;
  studentFound: boolean;
  message?: string;
  student?: StudentInfo;
  skills: SkillItem[];
  categories: string[];
  summary: Summary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return parseDateSafe(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  airway: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  vascular_access: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  medication: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  assessment: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cardiac: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  trauma: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  immobilization: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  obstetrics: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  pediatric: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  movement: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function categoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.other;
}

function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentSkillSheetsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<SkillSheetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'signed_off' | 'not_signed_off'>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session?.user?.email) {
      fetchSkillSheets();
    }
  }, [session]);

  const fetchSkillSheets = async () => {
    try {
      const res = await fetch('/api/student/skill-sheets');
      if (!res.ok) {
        if (res.status === 403) {
          setError('This page is only accessible to students.');
        } else {
          setError('Failed to load skill sheet data. Please try again.');
        }
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);

      // Auto-expand all categories on first load
      if (json.categories) {
        setExpandedCategories(new Set(json.categories));
      }
    } catch (err) {
      console.error('Error fetching skill sheets:', err);
      setError('Failed to load skill sheet data. Please try again.');
    }
    setLoading(false);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
  };

  const hasActiveFilters = search || statusFilter || categoryFilter;

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ─── Student not found ──────────────────────────────────────────────────
  if (!data.studentFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
              No Student Record Found
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {data.message || 'Your student record has not been set up yet. Please contact your instructor.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { skills, summary, categories } = data;

  // ─── Filter skills ──────────────────────────────────────────────────────
  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      search === '' ||
      skill.name.toLowerCase().includes(search.toLowerCase()) ||
      (skill.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === '' ||
      (statusFilter === 'signed_off' && skill.signedOff) ||
      (statusFilter === 'not_signed_off' && !skill.signedOff);
    const matchesCategory =
      categoryFilter === '' || (skill.category || 'other') === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // ─── Group filtered skills by category ──────────────────────────────────
  const skillsByCategory = filteredSkills.reduce<Record<string, SkillItem[]>>((acc, skill) => {
    const cat = skill.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});
  const sortedCategories = Object.keys(skillsByCategory).sort();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-400">
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/student" className="hover:text-cyan-600 dark:hover:text-cyan-400">
          Student
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">Skill Sheets</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Skill Sheets
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your skill signoff progress and evaluation history
        </p>
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.percentage}% Signed Off
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {summary.signedOff} of {summary.total} skills signed off
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${summary.percentage}%` }}
          />
        </div>

        {/* Status breakdown */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {summary.signedOff} Signed Off
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">
              {summary.remaining} Remaining
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
                hasActiveFilters
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as '' | 'signed_off' | 'not_signed_off')}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value="">All</option>
                    <option value="signed_off">Signed Off</option>
                    <option value="not_signed_off">Not Yet Signed Off</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value="">All Categories</option>
                    {(categories || []).map((cat) => (
                      <option key={cat} value={cat}>
                        {formatCategoryName(cat)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''} found
      </div>

      {/* Skills by Category */}
      {sortedCategories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No skills found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {hasActiveFilters
              ? 'Try adjusting your filters or search term'
              : 'No skill data available yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map((category) => {
            const catSkills = skillsByCategory[category];
            const catSignedOff = catSkills.filter((s) => s.signedOff).length;
            const catTotal = catSkills.length;
            const catPct = catTotal > 0 ? Math.round((catSignedOff / catTotal) * 100) : 0;
            const isExpanded = expandedCategories.has(category);

            return (
              <div
                key={category}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
              >
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${categoryColor(category)}`}>
                      {formatCategoryName(category)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {catSignedOff} / {catTotal} signed off
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Mini progress bar */}
                    <div className="hidden sm:block w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">
                      {catPct}%
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Skills list */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {catSkills.map((skill) => (
                        <div
                          key={skill.id}
                          className={`px-6 py-3 flex items-start gap-3 ${
                            skill.signedOff
                              ? 'bg-green-50/50 dark:bg-green-900/10'
                              : ''
                          }`}
                        >
                          {/* Status icon */}
                          <div className="pt-0.5 shrink-0">
                            {skill.signedOff ? (
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                            )}
                          </div>

                          {/* Skill info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-medium ${
                                    skill.signedOff
                                      ? 'text-green-800 dark:text-green-200'
                                      : 'text-gray-900 dark:text-white'
                                  }`}
                                >
                                  {skill.name}
                                </p>
                                {skill.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                    {skill.description}
                                  </p>
                                )}
                              </div>

                              {/* Skill sheet indicator */}
                              {skill.hasSkillSheet && (
                                <span
                                  className="shrink-0 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
                                  title={`Skill sheet available (${skill.skillSheetSource || 'internal'})`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>

                            {/* Signoff details */}
                            {skill.signedOff && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                  Signed off: {formatDate(skill.signedOffAt)}
                                </span>
                                {skill.signedOffBy && (
                                  <span>
                                    By: {skill.signedOffBy.split('@')[0]}
                                  </span>
                                )}
                                {skill.labDayTitle && (
                                  <span>
                                    Lab: {skill.labDayTitle}
                                    {skill.labDayDate ? ` (${formatDate(skill.labDayDate)})` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
