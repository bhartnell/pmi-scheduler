'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Database,
  Upload,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportResult {
  success: boolean;
  source?: string;
  imported?: number;
  updated?: number;
  linked?: number;
  total?: number;
  unmatched?: number;
  inserted?: number;
  errors?: string[];
  error?: string;
}

interface DbCounts {
  canonical_skills: number;
  skill_sheets: number;
  skill_sheet_steps: number;
  skill_sheet_assignments: number;
  student_skill_evaluations: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillSheetsImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [dbCounts, setDbCounts] = useState<DbCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

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
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // ---------- Database counts ----------
  const fetchCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const res = await fetch('/api/admin/skill-sheets/counts');
      const data = await res.json();
      if (data.success) {
        setDbCounts(data.counts);
      }
    } catch (err) {
      console.error('Error fetching counts:', err);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchCounts();
    }
  }, [currentUser, fetchCounts]);

  // ---------- Actions ----------
  const seedCanonical = async () => {
    setLoading('canonical');
    try {
      const res = await fetch('/api/admin/skill-sheets/seed-canonical', {
        method: 'POST',
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, canonical: data }));
      fetchCounts();
    } catch (err) {
      setResults(prev => ({
        ...prev,
        canonical: { success: false, error: String(err) },
      }));
    } finally {
      setLoading(null);
    }
  };

  const importSource = async (source: 'nremt' | 'platinum' | 'publisher') => {
    setLoading(source);
    try {
      const res = await fetch('/api/admin/skill-sheets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, [source]: data }));
      fetchCounts();
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [source]: { success: false, error: String(err) },
      }));
    } finally {
      setLoading(null);
    }
  };

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
          <Link href="/admin" className="hover:text-gray-700 dark:hover:text-gray-200">
            Admin
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 dark:text-white font-medium">Skill Sheets Import</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Skill Sheets Import
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Seed canonical skills and import skill sheets from NREMT, Platinum, and Publisher sources.
            </p>
          </div>
          <Link
            href="/skill-sheets"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
          >
            <FileText className="w-4 h-4" />
            Browse Skill Sheets
          </Link>
        </div>

        {/* Database Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500 flex-shrink-0">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Database Status
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Current record counts across skill sheet tables
                </p>
              </div>
            </div>
            <button
              onClick={fetchCounts}
              disabled={countsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${countsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="p-5">
            {dbCounts ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <CountCard label="Canonical Skills" count={dbCounts.canonical_skills} />
                <CountCard label="Skill Sheets" count={dbCounts.skill_sheets} />
                <CountCard label="Steps" count={dbCounts.skill_sheet_steps} />
                <CountCard label="Assignments" count={dbCounts.skill_sheet_assignments} />
                <CountCard label="Evaluations" count={dbCounts.student_skill_evaluations} />
              </div>
            ) : countsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Tables may not exist yet. Run the migration first.
              </p>
            )}
          </div>
        </div>

        {/* Import Actions */}
        <div className="grid gap-4">
          {/* Seed Canonical */}
          <ActionCard
            icon={Database}
            iconColor="bg-purple-500"
            title="1. Seed Canonical Skills"
            description="Insert or update the 41 canonical skill definitions. This must be done before importing skill sheets so they can be linked."
            buttonLabel="Seed Canonical Skills"
            loading={loading === 'canonical'}
            disabled={loading !== null}
            onClick={seedCanonical}
            result={results.canonical}
          />

          {/* Import NREMT */}
          <ActionCard
            icon={FileText}
            iconColor="bg-green-500"
            title="2. Import EMT NREMT Sheets"
            description="Import 10 schema-ready EMT NREMT skill sheets (source priority 1). These are the gold-standard psychomotor exam sheets."
            buttonLabel="Import EMT NREMT"
            loading={loading === 'nremt'}
            disabled={loading !== null}
            onClick={() => importSource('nremt')}
            result={results.nremt}
          />

          {/* Import Publisher */}
          <ActionCard
            icon={Upload}
            iconColor="bg-orange-500"
            title="3. Import AEMT Publisher Sheets"
            description="Import and transform 87 AEMT Publisher skill sheets (source priority 3). Strips 'Skill Drill' prefixes and assigns phases by keyword heuristics."
            buttonLabel="Import AEMT Publisher"
            loading={loading === 'publisher'}
            disabled={loading !== null}
            onClick={() => importSource('publisher')}
            result={results.publisher}
          />

          {/* Import Platinum */}
          <ActionCard
            icon={Upload}
            iconColor="bg-indigo-500"
            title="4. Import Paramedic Platinum Sheets"
            description="Import and transform 41 Paramedic Platinum skill sheets (source priority 2). Maps section-based steps to phases and splits critical criteria from failures."
            buttonLabel="Import Paramedic Platinum"
            loading={loading === 'platinum'}
            disabled={loading !== null}
            onClick={() => importSource('platinum')}
            result={results.platinum}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountCard({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {count.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  buttonLabel,
  loading,
  disabled,
  onClick,
  result,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  buttonLabel: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  result?: ImportResult;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-5 flex items-start gap-4">
        <div className={`p-2 rounded-lg ${iconColor} flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={onClick}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                buttonLabel
              )}
            </button>
          </div>

          {/* Result display */}
          {result && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                result.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}
            >
              {result.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="font-medium text-green-800 dark:text-green-300">
                      Success
                    </span>
                  </div>
                  <div className="text-green-700 dark:text-green-400 ml-6">
                    {result.inserted !== undefined && (
                      <span>Inserted {result.inserted}, updated {result.updated ?? 0}. </span>
                    )}
                    {result.imported !== undefined && (
                      <span>
                        Imported {result.imported} sheets, updated {result.updated ?? 0}, linked {result.linked ?? 0} to canonical skills.{' '}
                        {(result.unmatched ?? 0) > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {result.unmatched} unmatched.
                          </span>
                        )}
                      </span>
                    )}
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      (Total: {result.total})
                    </span>
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 ml-6">
                      <p className="text-amber-700 dark:text-amber-400 font-medium text-xs">
                        {result.errors.length} error(s):
                      </p>
                      <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-500 mt-1 max-h-32 overflow-y-auto">
                        {result.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-red-800 dark:text-red-300">
                    Error: {result.error || 'Unknown error'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
