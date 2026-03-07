'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Upload,
  Copy,
  Clock,
  BarChart3,
  Star,
  Play,
  Pencil,
  Filter,
  X,
  Loader2,
  BookOpen,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Heart,
  AlertTriangle,
  Wind,
  Stethoscope,
  Baby,
  Brain,
  Thermometer,
  Shield,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaseStudy {
  id: string;
  title: string;
  description: string | null;
  chief_complaint: string | null;
  category: string | null;
  subcategory: string | null;
  difficulty: string;
  applicable_programs: string[];
  estimated_duration_minutes: number;
  usage_count: number;
  community_rating: number;
  visibility: string;
  is_published: boolean;
  created_by: string;
  author: string | null;
  created_at: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Cardiac',
  'Respiratory',
  'Trauma',
  'Medical',
  'OB',
  'Peds',
  'Behavioral',
  'Environmental',
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  Cardiac: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-300', icon: Heart },
  Respiratory: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', icon: Wind },
  Trauma: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-800 dark:text-orange-300', icon: AlertTriangle },
  Medical: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300', icon: Stethoscope },
  OB: { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-800 dark:text-pink-300', icon: Baby },
  Peds: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-300', icon: Baby },
  Behavioral: { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-800 dark:text-teal-300', icon: Brain },
  Environmental: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300', icon: Thermometer },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const PROGRAMS = ['Paramedic', 'EMT', 'AEMT'];

type InstructorTab = 'official' | 'community' | 'my-cases';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CasesLibraryPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // User state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isInstructor, setIsInstructor] = useState(false);

  // Data state
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [activeTab, setActiveTab] = useState<InstructorTab>('official');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const PAGE_SIZE = 24;

  // Fetch user info
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (!session?.user?.email) return;

    fetch('/api/instructor/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setUserInfo(data.user);
          const role = data.user.role;
          const instructorLevel = ['superadmin', 'admin', 'lead_instructor', 'instructor'].includes(role);
          setIsInstructor(instructorLevel);
        }
      })
      .catch(console.error);
  }, [session, sessionStatus, router]);

  // Fetch cases
  const fetchCases = useCallback(async () => {
    if (!userInfo) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();

      // Tab-based filtering for instructors
      if (isInstructor) {
        if (activeTab === 'official') {
          params.set('visibility', 'official');
        } else if (activeTab === 'community') {
          params.set('visibility', 'community');
        } else if (activeTab === 'my-cases') {
          params.set('created_by', 'me');
        }
      }

      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter);
      if (programFilters.length === 1) params.set('program', programFilters[0]);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('sort', sortField);
      params.set('order', sortOrder);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const res = await fetch(`/api/cases?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setCases(data.cases || []);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo, isInstructor, activeTab, categoryFilter, difficultyFilter, programFilters, searchQuery, sortField, sortOrder, page]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [activeTab, categoryFilter, difficultyFilter, programFilters, searchQuery, sortField, sortOrder]);

  // Handle duplicate
  const handleDuplicate = async (caseId: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Switch to "My Cases" tab and refresh
        setActiveTab('my-cases');
        fetchCases();
      }
    } catch (error) {
      console.error('Error duplicating case:', error);
    }
  };

  // Handle import
  const handleImport = async () => {
    setImportError('');
    setImporting(true);

    try {
      let parsed;
      try {
        parsed = JSON.parse(importJson);
      } catch {
        setImportError('Invalid JSON format. Please check your input.');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/cases/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();

      if (data.success) {
        setShowImportModal(false);
        setImportJson('');
        setActiveTab('my-cases');
        fetchCases();
      } else {
        setImportError(data.error || 'Import failed');
      }
    } catch (error) {
      setImportError('Import failed. Please try again.');
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  // Toggle program filter
  const toggleProgram = (program: string) => {
    setProgramFilters((prev) =>
      prev.includes(program)
        ? prev.filter((p) => p !== program)
        : [...prev, program]
    );
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters = categoryFilter !== 'all' || difficultyFilter !== 'all' || programFilters.length > 0;

  const clearFilters = () => {
    setCategoryFilter('all');
    setDifficultyFilter('all');
    setProgramFilters([]);
    setSearchQuery('');
  };

  // Loading state
  if (sessionStatus === 'loading' || !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-600" />
            Case Study Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isInstructor
              ? 'Browse, create, and manage case studies for your students'
              : 'Practice with case studies assigned by your instructors'}
          </p>
        </div>

        {isInstructor && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import JSON
            </button>
            <Link
              href="/cases/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create New Case
            </Link>
          </div>
        )}
      </div>

      {/* Student progress stats */}
      {!isInstructor && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 mb-6 border border-blue-100 dark:border-blue-800/50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {totalCount} cases available
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Instructors */}
      {isInstructor && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {([
            { key: 'official', label: 'Official Library', icon: Shield },
            { key: 'community', label: 'Community', icon: Users },
            { key: 'my-cases', label: 'My Cases', icon: User },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search cases by title, description, or chief complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-lg transition-colors ${
            hasActiveFilters
              ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {(categoryFilter !== 'all' ? 1 : 0) +
                (difficultyFilter !== 'all' ? 1 : 0) +
                programFilters.length}
            </span>
          )}
        </button>

        <select
          value={`${sortField}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-');
            setSortField(field);
            setSortOrder(order as 'asc' | 'desc');
          }}
          className="px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
          <option value="difficulty-asc">Difficulty (Easy first)</option>
          <option value="difficulty-desc">Difficulty (Hard first)</option>
          <option value="usage_count-desc">Most Used</option>
          <option value="community_rating-desc">Highest Rated</option>
        </select>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Difficulty
              </label>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Difficulties</option>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Programs */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Program
              </label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS.map((prog) => (
                  <button
                    key={prog}
                    onClick={() => toggleProgram(prog)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      programFilters.includes(prog)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {prog}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? 'Loading...' : `${totalCount} case${totalCount !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Cases Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
            No cases found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hasActiveFilters || searchQuery
              ? 'Try adjusting your filters or search query.'
              : isInstructor && activeTab === 'my-cases'
              ? 'Create your first case study to get started.'
              : 'No cases are available in this category yet.'}
          </p>
          {isInstructor && activeTab === 'my-cases' && (
            <Link
              href="/cases/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create New Case
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c) => (
            <CaseCard
              key={c.id}
              caseStudy={c}
              isInstructor={isInstructor}
              isOwner={c.created_by === userInfo?.id}
              onDuplicate={() => handleDuplicate(c.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 px-3">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Case from JSON
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson('');
                  setImportError('');
                }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Paste a case study JSON object below. Required fields: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">title</code>. The case will be imported as a private draft.
              </p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"title": "My Case", "category": "Cardiac", "difficulty": "intermediate", "phases": [...]}'
                className="w-full h-48 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
              />
              {importError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{importError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson('');
                  setImportError('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importJson.trim() || importing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CaseCard component
// ---------------------------------------------------------------------------

function CaseCard({
  caseStudy,
  isInstructor,
  isOwner,
  onDuplicate,
}: {
  caseStudy: CaseStudy;
  isInstructor: boolean;
  isOwner: boolean;
  onDuplicate: () => void;
}) {
  const categoryConfig = CATEGORY_COLORS[caseStudy.category || ''] || {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
    icon: BookOpen,
  };
  const CategoryIcon = categoryConfig.icon;

  const difficultyClass =
    DIFFICULTY_COLORS[caseStudy.difficulty] ||
    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Card Header */}
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {caseStudy.category && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${categoryConfig.bg} ${categoryConfig.text}`}
              >
                <CategoryIcon className="h-3 w-3" />
                {caseStudy.category}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficultyClass}`}>
              {caseStudy.difficulty.charAt(0).toUpperCase() + caseStudy.difficulty.slice(1)}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
          {caseStudy.title}
        </h3>

        {caseStudy.chief_complaint && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
            CC: {caseStudy.chief_complaint}
          </p>
        )}

        {caseStudy.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
            {caseStudy.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {caseStudy.estimated_duration_minutes}m
          </span>
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {caseStudy.usage_count} uses
          </span>
          {caseStudy.community_rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500" />
              {Number(caseStudy.community_rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
        <Link
          href={`/cases/${caseStudy.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Preview
        </Link>

        <Link
          href={`/cases/${caseStudy.id}/practice`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Play className="h-3 w-3" />
          Practice
        </Link>

        {isInstructor && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onDuplicate();
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}

        {isOwner && (
          <Link
            href={`/cases/${caseStudy.id}/edit`}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
