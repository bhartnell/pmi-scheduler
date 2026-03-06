'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Search,
  FileText,
  Filter,
  Loader2,
  GraduationCap,
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CanonicalSkillRef {
  id: string;
  canonical_name: string;
  skill_category: string | null;
}

interface SkillSheetRow {
  id: string;
  skill_name: string;
  program: string;
  source: string;
  source_priority: number;
  canonical_skill_id: string | null;
  equipment: string | null;
  overview: string | null;
  platinum_skill_type: string | null;
  canonical_skill: CanonicalSkillRef | null;
  step_count: number;
}

interface ProgramCounts {
  emt: number;
  aemt: number;
  paramedic: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRAM_OPTIONS = [
  { value: '', label: 'All Programs' },
  { value: 'emt', label: 'EMT' },
  { value: 'aemt', label: 'AEMT' },
  { value: 'paramedic', label: 'Paramedic' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'nremt', label: 'NREMT' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'publisher', label: 'Publisher' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Airway', label: 'Airway' },
  { value: 'Vascular Access', label: 'Vascular Access' },
  { value: 'Medication', label: 'Medication' },
  { value: 'Assessment', label: 'Assessment' },
  { value: 'Cardiac', label: 'Cardiac' },
  { value: 'Trauma', label: 'Trauma' },
  { value: 'Immobilization', label: 'Immobilization' },
  { value: 'Obstetrics', label: 'Obstetrics' },
  { value: 'Pediatric', label: 'Pediatric' },
  { value: 'Movement', label: 'Movement' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillSheetsBrowsePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [sheets, setSheets] = useState<SkillSheetRow[]>([]);
  const [counts, setCounts] = useState<ProgramCounts>({ emt: 0, aemt: 0, paramedic: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [program, setProgram] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ---------- Auth ----------
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!hasMinRole(data.user.role, 'instructor')) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // ---------- Debounce search ----------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ---------- Fetch sheets ----------
  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (program) params.set('program', program);
      if (source) params.set('source', source);
      if (category) params.set('category', category);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const qs = params.toString();
      const res = await fetch(`/api/skill-sheets${qs ? `?${qs}` : ''}`);
      const data = await res.json();

      if (data.success) {
        setSheets(data.sheets || []);
        setCounts(data.counts || { emt: 0, aemt: 0, paramedic: 0, total: 0 });
      }
    } catch (err) {
      console.error('Error fetching skill sheets:', err);
    } finally {
      setLoading(false);
    }
  }, [program, source, category, debouncedSearch]);

  useEffect(() => {
    if (currentUser) {
      fetchSheets();
    }
  }, [currentUser, fetchSheets]);

  // ---------- Render ----------
  if (status === 'loading' || !currentUser) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 dark:text-white font-medium">Skill Sheets</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Skill Sheets
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Clinical evaluation checklists for lab day stations
          </p>
        </div>

        {/* Program Level Segmented Control */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
              <GraduationCap className="w-4 h-4" />
              <span className="font-medium">Program Level</span>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 p-1 w-full sm:w-auto">
              {PROGRAM_OPTIONS.map((opt) => {
                const isActive = program === opt.value;
                const count =
                  opt.value === ''
                    ? counts.total
                    : opt.value === 'emt'
                      ? counts.emt
                      : opt.value === 'aemt'
                        ? counts.aemt
                        : counts.paramedic;

                // Color styling per program when active
                let activeClasses = 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm';
                if (isActive && opt.value === 'emt') {
                  activeClasses = 'bg-blue-600 text-white shadow-sm shadow-blue-600/25';
                } else if (isActive && opt.value === 'aemt') {
                  activeClasses = 'bg-green-600 text-white shadow-sm shadow-green-600/25';
                } else if (isActive && opt.value === 'paramedic') {
                  activeClasses = 'bg-purple-600 text-white shadow-sm shadow-purple-600/25';
                }

                return (
                  <button
                    key={opt.value}
                    onClick={() => setProgram(opt.value)}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? activeClasses
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-600/50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? opt.value === ''
                            ? 'bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-200'
                            : 'bg-white/25 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Source filter */}
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Category filter */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search skill sheets..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                Loading skill sheets...
              </span>
            </div>
          ) : sheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <FileText className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">No skill sheets match your filters</p>
              <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <div className="col-span-5">Skill Name</div>
                <div className="col-span-2">Program</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-1 text-right">Steps</div>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sheets.map((sheet) => (
                  <Link
                    key={sheet.id}
                    href={`/skill-sheets/${sheet.id}`}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                  >
                    {/* Skill name */}
                    <div className="sm:col-span-5 flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-blue-500 transition-colors" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {sheet.skill_name}
                      </span>
                    </div>

                    {/* Program badge */}
                    <div className="sm:col-span-2 flex items-center">
                      <ProgramBadge program={sheet.program} />
                    </div>

                    {/* Source badge */}
                    <div className="sm:col-span-2 flex items-center">
                      <SourceBadge source={sheet.source} />
                    </div>

                    {/* Category */}
                    <div className="sm:col-span-2 flex items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {sheet.canonical_skill?.skill_category || '--'}
                      </span>
                    </div>

                    {/* Step count */}
                    <div className="sm:col-span-1 flex items-center sm:justify-end">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {sheet.step_count}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Footer count */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {sheets.length} skill sheet{sheets.length !== 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgramBadge({ program }: { program: string }) {
  const p = program?.toLowerCase() || '';
  let classes = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

  if (p === 'emt') {
    classes = 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  } else if (p === 'aemt') {
    classes = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  } else if (p === 'paramedic') {
    classes = 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {program?.toUpperCase() || 'N/A'}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const s = source?.toLowerCase() || '';
  let classes = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

  if (s === 'nremt') {
    classes = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  } else if (s === 'platinum') {
    classes = 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
  } else if (s === 'publisher') {
    classes = 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
  }

  const label = s === 'nremt' ? 'NREMT' : source ? source.charAt(0).toUpperCase() + source.slice(1) : 'N/A';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
