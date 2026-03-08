'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Loader2,
  Database,
  Sparkles,
  Play,
  PlayCircle,
  Plus,
  X,
  Check,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  FileText,
  Save,
  AlertTriangle,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaseBrief {
  id: string;
  category: string;
  subcategory: string;
  difficulty: string;
  programs: string[];
  scenario: string;
  special_instructions: string | null;
  batch_name: string | null;
  status: string;
  generated_case_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface CoverageRow {
  category: string;
  total: number;
  generated: number;
  reviewed: number;
  published: number;
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt_text: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface GenerationResult {
  id?: string;
  title?: string;
  status: string;
  error?: string;
  errors?: { field: string; message: string; severity: string }[];
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

const TARGETS: Record<string, number> = {
  cardiac: 18,
  respiratory: 18,
  trauma: 18,
  medical: 18,
  ob: 12,
  peds: 14,
  behavioral: 10,
  environmental: 10,
};

const CATEGORY_OPTIONS = [
  'Cardiac', 'Respiratory', 'Trauma', 'Medical',
  'OB', 'Peds', 'Behavioral', 'Environmental',
];

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  generating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  generated: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  skipped: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CaseGenerationPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // User state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Data state
  const [briefs, setBriefs] = useState<CaseBrief[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ batch: 'all', category: 'all', difficulty: 'all', status: 'all' });
  const [batches, setBatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    results: GenerationResult[];
  }>({ current: 0, total: 0, results: [] });

  // Coverage state
  const [coverageData, setCoverageData] = useState<CoverageRow[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  // Prompt template state
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplate | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editPromptText, setEditPromptText] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Add brief modal state
  const [showAddBrief, setShowAddBrief] = useState(false);
  const [newBrief, setNewBrief] = useState({
    category: 'Cardiac',
    subcategory: '',
    difficulty: 'intermediate',
    programs: ['Paramedic'] as string[],
    scenario: '',
    special_instructions: '',
    batch_name: 'Custom',
  });
  const [savingBrief, setSavingBrief] = useState(false);

  // Action feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Expanded brief row
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);

  // Seeding states
  const [seedingCatalog, setSeedingCatalog] = useState(false);
  const [seedingPrompt, setSeedingPrompt] = useState(false);

  // -------------------------------------------------------------------------
  // Auth check
  // -------------------------------------------------------------------------

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
          if (!canAccessAdmin(data.user.role)) {
            router.push('/');
            return;
          }
          setUserInfo(data.user);
        }
      })
      .catch(console.error);
  }, [session, sessionStatus, router]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchBriefs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.batch !== 'all') params.set('batch', filters.batch);
      if (filters.category !== 'all') params.set('category', filters.category);
      if (filters.difficulty !== 'all') params.set('difficulty', filters.difficulty);
      if (filters.status !== 'all') params.set('status', filters.status);

      const res = await fetch(`/api/admin/cases/briefs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setBriefs(data.briefs || []);
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('Error fetching briefs:', error);
    }
  }, [filters]);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cases/coverage');
      const data = await res.json();
      if (data.success) {
        setCoverageData(data.categories || []);
        setReviewCount(data.review_pending_count || 0);
      }
    } catch (error) {
      console.error('Error fetching coverage:', error);
    }
  }, []);

  const fetchPromptTemplate = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cases/prompt-template');
      const data = await res.json();
      if (data.success) {
        setPromptTemplate(data.template || null);
      }
    } catch (error) {
      console.error('Error fetching prompt template:', error);
    }
  }, []);

  useEffect(() => {
    if (!userInfo) return;

    setLoading(true);
    Promise.all([fetchBriefs(), fetchCoverage(), fetchPromptTemplate()])
      .finally(() => setLoading(false));
  }, [userInfo, fetchBriefs, fetchCoverage, fetchPromptTemplate]);

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  const showMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleSeedCatalog = async () => {
    setSeedingCatalog(true);
    try {
      const res = await fetch('/api/admin/cases/seed-briefs', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showMessage('success', data.message || 'Brief catalog seeded successfully');
        fetchBriefs();
      } else {
        showMessage('error', data.error || 'Failed to seed catalog');
      }
    } catch {
      showMessage('error', 'Failed to seed catalog');
    } finally {
      setSeedingCatalog(false);
    }
  };

  const handleSeedPrompt = async () => {
    setSeedingPrompt(true);
    try {
      const res = await fetch('/api/admin/cases/seed-prompt', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showMessage('success', data.message || 'Prompt template seeded successfully');
        fetchPromptTemplate();
      } else {
        showMessage('error', data.error || 'Failed to seed prompt');
      }
    } catch {
      showMessage('error', 'Failed to seed prompt');
    } finally {
      setSeedingPrompt(false);
    }
  };

  const handleGenerate = async (briefsToGenerate: CaseBrief[]) => {
    if (briefsToGenerate.length === 0) return;

    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: briefsToGenerate.length, results: [] });

    // Process in batches of 10 (API limit)
    const allResults: GenerationResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < briefsToGenerate.length; i += batchSize) {
      const batch = briefsToGenerate.slice(i, i + batchSize);
      const briefPayloads = batch.map((b) => ({
        category: b.category,
        subcategory: b.subcategory,
        difficulty: b.difficulty,
        programs: b.programs,
        scenario: b.scenario,
        special_instructions: b.special_instructions || undefined,
      }));

      try {
        const res = await fetch('/api/cases/generate/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefs: briefPayloads }),
        });

        const data = await res.json();

        if (data.success && data.cases) {
          allResults.push(...data.cases);
        } else {
          // If entire batch failed, add failure entries
          batch.forEach((b) => {
            allResults.push({
              title: b.scenario?.substring(0, 50),
              status: 'failed',
              error: data.error || 'Batch generation failed',
            });
          });
        }
      } catch {
        batch.forEach((b) => {
          allResults.push({
            title: b.scenario?.substring(0, 50),
            status: 'failed',
            error: 'Network error',
          });
        });
      }

      setGenerationProgress({
        current: Math.min(i + batchSize, briefsToGenerate.length),
        total: briefsToGenerate.length,
        results: [...allResults],
      });
    }

    setIsGenerating(false);
    setSelectedIds(new Set());
    showMessage(
      'success',
      `Generation complete: ${allResults.filter((r) => r.status === 'draft').length} succeeded, ${allResults.filter((r) => r.status === 'failed').length} failed`
    );

    // Refresh data
    fetchBriefs();
    fetchCoverage();
  };

  const handleGenerateSelected = () => {
    const selectedBriefs = briefs.filter((b) => selectedIds.has(b.id) && b.status === 'pending');
    if (selectedBriefs.length === 0) {
      showMessage('error', 'No pending briefs selected');
      return;
    }
    handleGenerate(selectedBriefs);
  };

  const handleGenerateAllPending = () => {
    const pendingBriefs = briefs.filter((b) => b.status === 'pending');
    if (pendingBriefs.length === 0) {
      showMessage('error', 'No pending briefs available');
      return;
    }
    handleGenerate(pendingBriefs);
  };

  const handleAddBrief = async () => {
    if (!newBrief.scenario.trim()) {
      showMessage('error', 'Scenario description is required');
      return;
    }
    setSavingBrief(true);
    try {
      const res = await fetch('/api/admin/cases/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrief),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('success', 'Brief added successfully');
        setShowAddBrief(false);
        setNewBrief({
          category: 'Cardiac',
          subcategory: '',
          difficulty: 'intermediate',
          programs: ['Paramedic'],
          scenario: '',
          special_instructions: '',
          batch_name: 'Custom',
        });
        fetchBriefs();
      } else {
        showMessage('error', data.error || 'Failed to add brief');
      }
    } catch {
      showMessage('error', 'Failed to add brief');
    } finally {
      setSavingBrief(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!editPromptText.trim()) {
      showMessage('error', 'Prompt text cannot be empty');
      return;
    }
    setSavingPrompt(true);
    try {
      const res = await fetch('/api/admin/cases/prompt-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_text: editPromptText }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('success', `Prompt template saved as v${data.template.version}`);
        setPromptTemplate(data.template);
        setShowPromptEditor(false);
      } else {
        showMessage('error', data.error || 'Failed to save prompt');
      }
    } catch {
      showMessage('error', 'Failed to save prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  const filteredBriefs = briefs; // Already filtered by API

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBriefs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBriefs.map((b) => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleProgram = (program: string) => {
    setNewBrief((prev) => ({
      ...prev,
      programs: prev.programs.includes(program)
        ? prev.programs.filter((p) => p !== program)
        : [...prev.programs, program],
    }));
  };

  // -------------------------------------------------------------------------
  // Coverage helpers
  // -------------------------------------------------------------------------

  function getCoverageColor(published: number, target: number): string {
    if (target === 0) return 'bg-gray-50 dark:bg-gray-800';
    const ratio = published / target;
    if (ratio >= 0.75) return 'bg-green-50 dark:bg-green-900/20';
    if (ratio >= 0.25) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return 'bg-red-50 dark:bg-red-900/20';
  }

  // -------------------------------------------------------------------------
  // Loading / auth guard
  // -------------------------------------------------------------------------

  if (sessionStatus === 'loading' || !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const pendingCount = filteredBriefs.filter((b) => b.status === 'pending').length;
  const selectedPendingCount = filteredBriefs.filter((b) => selectedIds.has(b.id) && b.status === 'pending').length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs className="mb-6" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-blue-600" />
            Case Generation Pipeline
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate, manage, and review AI-created case studies
          </p>
        </div>
      </div>

      {/* Action Message Toast */}
      {actionMessage && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {actionMessage.text}
          <button
            onClick={() => setActionMessage(null)}
            className="ml-auto p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* ─── Coverage Dashboard ─── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Coverage Dashboard</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Target</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Total</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Generated</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Reviewed</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Published</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(TARGETS).map(([cat, target]) => {
                    const row = coverageData.find((c) => c.category === cat);
                    const total = row?.total || 0;
                    const generated = row?.generated || 0;
                    const reviewed = row?.reviewed || 0;
                    const published = row?.published || 0;
                    const gap = Math.max(0, target - published);
                    const colorClass = getCoverageColor(published, target);

                    return (
                      <tr key={cat} className={`border-b border-gray-50 dark:border-gray-700/50 ${colorClass}`}>
                        <td className="px-5 py-2.5 font-medium text-gray-900 dark:text-white capitalize">
                          {cat}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{target}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{total}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{generated}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{reviewed}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{published}</td>
                        <td className="px-3 py-2.5 text-center">
                          {gap > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">-{gap}</span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              <Check className="h-4 w-4 inline" />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Actions Bar ─── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSeedCatalog}
                disabled={seedingCatalog || isGenerating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Seed Catalog
              </button>

              <button
                onClick={handleSeedPrompt}
                disabled={seedingPrompt || isGenerating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Seed Prompt
              </button>

              <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 hidden sm:block" />

              <button
                onClick={handleGenerateSelected}
                disabled={selectedPendingCount === 0 || isGenerating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Generate Selected ({selectedPendingCount})
              </button>

              <button
                onClick={handleGenerateAllPending}
                disabled={pendingCount === 0 || isGenerating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Generate All Pending ({pendingCount})
              </button>

              <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 hidden sm:block" />

              <button
                onClick={() => setShowAddBrief(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Add Custom Brief
              </button>
            </div>
          </div>

          {/* ─── Filters ─── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Batch</label>
                <select
                  value={filters.batch}
                  onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Batches</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Difficulty</label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Difficulties</option>
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="generating">Generating</option>
                  <option value="generated">Generated</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── Brief Catalog Table ─── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Brief Catalog ({filteredBriefs.length})
              </h2>
              {selectedIds.size > 0 && (
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {filteredBriefs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Database className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No briefs found. Click &quot;Seed Catalog&quot; to populate the brief catalog.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredBriefs.length && filteredBriefs.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Batch</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Subcategory</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Difficulty</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Programs</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400 min-w-[200px]">Scenario</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBriefs.map((brief) => (
                      <BriefRow
                        key={brief.id}
                        brief={brief}
                        isSelected={selectedIds.has(brief.id)}
                        isExpanded={expandedBriefId === brief.id}
                        onToggleSelect={() => toggleSelect(brief.id)}
                        onToggleExpand={() => setExpandedBriefId(expandedBriefId === brief.id ? null : brief.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── Generation Progress ─── */}
          {(isGenerating || generationProgress.results.length > 0) && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  Generation Progress
                </h2>
                {!isGenerating && generationProgress.results.length > 0 && (
                  <button
                    onClick={() => setGenerationProgress({ current: 0, total: 0, results: [] })}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="p-5">
                {isGenerating && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      Generating cases {generationProgress.current} of {generationProgress.total}...
                      <span className="text-gray-400 dark:text-gray-500 ml-2">
                        (approx. {Math.max(0, (generationProgress.total - generationProgress.current) * 7)}s remaining)
                      </span>
                    </p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </>
                )}

                {generationProgress.results.length > 0 && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {generationProgress.results.map((result, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm py-1"
                      >
                        {result.status === 'draft' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-gray-700 dark:text-gray-300 truncate">
                          {result.title || `Case ${idx + 1}`}
                        </span>
                        {result.status === 'draft' && result.id && (
                          <Link
                            href={`/cases/${result.id}/edit`}
                            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Edit <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {result.status === 'failed' && result.error && (
                          <span className="ml-auto text-xs text-red-500 dark:text-red-400 truncate max-w-[200px]" title={result.error}>
                            {result.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Review Queue ─── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Review Queue</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {reviewCount > 0
                      ? `${reviewCount} case${reviewCount !== 1 ? 's' : ''} pending clinical review`
                      : 'No cases pending review'}
                  </p>
                </div>
              </div>
              {reviewCount > 0 && (
                <Link
                  href="/cases?review=pending"
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors border border-amber-200 dark:border-amber-800"
                >
                  View Review Queue
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>

          {/* ─── Prompt Template ─── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-purple-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Prompt Template
                      {promptTemplate && (
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          (v{promptTemplate.version})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {promptTemplate
                        ? `Last updated: ${new Date(promptTemplate.updated_at).toLocaleDateString()}`
                        : 'No custom template configured — using default prompt'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (showPromptEditor) {
                      setShowPromptEditor(false);
                    } else {
                      setEditPromptText(promptTemplate?.prompt_text || '');
                      setShowPromptEditor(true);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {showPromptEditor ? (
                    <>
                      <X className="h-4 w-4" />
                      Close
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      View / Edit
                    </>
                  )}
                </button>
              </div>

              {showPromptEditor && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Changes will affect all future case generations
                  </div>
                  <textarea
                    value={editPromptText}
                    onChange={(e) => setEditPromptText(e.target.value)}
                    rows={16}
                    className="w-full px-4 py-3 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter the master prompt template for case generation..."
                  />
                  <div className="flex justify-end gap-3 mt-3">
                    <button
                      onClick={() => {
                        setEditPromptText(promptTemplate?.prompt_text || '');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </button>
                    <button
                      onClick={handleSavePrompt}
                      disabled={savingPrompt || !editPromptText.trim()}
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPrompt ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save New Version
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Add Custom Brief Modal ─── */}
      {showAddBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Custom Brief</h2>
              <button
                onClick={() => setShowAddBrief(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={newBrief.category}
                  onChange={(e) => setNewBrief((b) => ({ ...b, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategory</label>
                <input
                  type="text"
                  value={newBrief.subcategory}
                  onChange={(e) => setNewBrief((b) => ({ ...b, subcategory: e.target.value }))}
                  placeholder="e.g., ACS, Arrhythmia, Tension Pneumo..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
                <select
                  value={newBrief.difficulty}
                  onChange={(e) => setNewBrief((b) => ({ ...b, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Programs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Programs</label>
                <div className="flex flex-wrap gap-2">
                  {['EMT', 'AEMT', 'Paramedic'].map((prog) => (
                    <button
                      key={prog}
                      type="button"
                      onClick={() => toggleProgram(prog)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        newBrief.programs.includes(prog)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {prog}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scenario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scenario Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newBrief.scenario}
                  onChange={(e) => setNewBrief((b) => ({ ...b, scenario: e.target.value }))}
                  rows={3}
                  placeholder="Describe the scenario for case generation..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y"
                />
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={newBrief.special_instructions}
                  onChange={(e) => setNewBrief((b) => ({ ...b, special_instructions: e.target.value }))}
                  rows={2}
                  placeholder="Any special requirements for the AI..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y"
                />
              </div>

              {/* Batch Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Name</label>
                <input
                  type="text"
                  value={newBrief.batch_name}
                  onChange={(e) => setNewBrief((b) => ({ ...b, batch_name: e.target.value }))}
                  placeholder="Custom"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddBrief(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBrief}
                disabled={savingBrief || !newBrief.scenario.trim() || !newBrief.subcategory.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingBrief ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Brief
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BriefRow sub-component
// ---------------------------------------------------------------------------

function BriefRow({
  brief,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
}: {
  brief: CaseBrief;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}) {
  const statusClass = STATUS_COLORS[brief.status] || STATUS_COLORS.pending;
  const difficultyClass = DIFFICULTY_COLORS[brief.difficulty] || DIFFICULTY_COLORS.intermediate;

  return (
    <>
      <tr
        className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
        </td>
        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs">
          {brief.batch_name || '-'}
        </td>
        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-xs font-medium capitalize">
          {brief.category}
        </td>
        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs">
          {brief.subcategory}
        </td>
        <td className="px-3 py-2.5">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficultyClass}`}>
            {brief.difficulty.charAt(0).toUpperCase() + brief.difficulty.slice(1)}
          </span>
        </td>
        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs">
          {brief.programs?.join(', ') || '-'}
        </td>
        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs max-w-[200px] truncate" title={brief.scenario}>
          {brief.scenario.length > 80 ? `${brief.scenario.substring(0, 80)}...` : brief.scenario}
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
            {brief.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin" />}
            {brief.status === 'generated' && brief.generated_case_id && (
              <Link
                href={`/cases/${brief.generated_case_id}/edit`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {brief.status}
              </Link>
            )}
            {(brief.status !== 'generated' || !brief.generated_case_id) && brief.status}
          </span>
        </td>
      </tr>

      {/* Expanded details row */}
      {isExpanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Scenario</h4>
                <p className="text-gray-700 dark:text-gray-300">{brief.scenario}</p>
              </div>
              {brief.special_instructions && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Special Instructions</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.special_instructions}</p>
                </div>
              )}
              {brief.error_message && (
                <div className="md:col-span-2">
                  <h4 className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase mb-1">Error</h4>
                  <p className="text-red-600 dark:text-red-400 text-xs font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {brief.error_message}
                  </p>
                </div>
              )}
              {brief.generated_case_id && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Generated Case</h4>
                  <Link
                    href={`/cases/${brief.generated_case_id}/edit`}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs inline-flex items-center gap-1"
                  >
                    View/Edit Case <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Created</h4>
                <p className="text-gray-600 dark:text-gray-400 text-xs">
                  {new Date(brief.created_at).toLocaleDateString()} {new Date(brief.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
