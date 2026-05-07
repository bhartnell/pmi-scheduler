'use client';

/**
 * /admin/scenarios/cleanup — bulk demographic + content cleanup
 * for the 56 Tier-3 scenarios (and 6 Tier-2 stragglers) flagged
 * by the audit.
 *
 * Two actions, each gated by a dry-run preview modal:
 *
 *   "Extract Demographics" → POST /api/admin/scenarios/extract-demographics
 *     Uses Claude to pull chief_complaint, patient_age, patient_name,
 *     patient_sex, patient_weight, medical_history, medications,
 *     allergies out of patient_presentation prose.
 *
 *   "Generate Content" → POST /api/admin/scenarios/generate-content
 *     Uses Claude to draft learning_objectives, critical_actions,
 *     and debrief_points for scenarios that lack them.
 *
 * Pattern mirrors the calendar-sync "Clean up duplicates" UI:
 * dry-run first, surface counts in a modal, operator hits Confirm
 * to actually write.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Home,
  ChevronRight,
  Sparkles,
  Wand2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X as XIcon,
  ArrowLeft,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

interface ChangelogEntry {
  scenario_id: string;
  title: string;
  fields_filled?: string[];
  errors?: string[];
}

interface ExtractResult {
  success: boolean;
  dry_run: boolean;
  total_checked?: number;
  total_eligible?: number;
  remaining_count?: number;
  total_with_changes?: number;
  total_applied?: number;
  total_errors?: number;
  changelog?: ChangelogEntry[];
  error?: string;
  fix?: string;
}

export default function ScenariosCleanupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [auditCounts, setAuditCounts] = useState<{
    total: number;
    tier1: number;
    tier2: number;
    tier3: number;
  } | null>(null);

  const [extractRunning, setExtractRunning] = useState(false);
  const [extractPreview, setExtractPreview] = useState<ExtractResult | null>(null);
  const [extractConfirming, setExtractConfirming] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(data => {
        const u = (data.user || data) as CurrentUser;
        setCurrentUser(u);
        if (!canAccessAdmin(u.role)) router.push('/');
      })
      .catch(() => {});
  }, [session, router]);

  const loadAudit = async () => {
    try {
      const res = await fetch('/api/admin/scenarios/audit');
      if (!res.ok) return;
      const data = await res.json();
      // The audit endpoint returns a per-scenario breakdown; we
      // bucket here for the dashboard counters. Falls back silently
      // if the shape is unexpected — this surface is informational.
      const scenarios = Array.isArray(data.scenarios) ? data.scenarios : Array.isArray(data) ? data : [];
      let t1 = 0, t2 = 0, t3 = 0;
      for (const s of scenarios) {
        const m = s.missing_count ?? 0;
        if (m <= 1) t1++;
        else if (m <= 3) t2++;
        else t3++;
      }
      setAuditCounts({ total: scenarios.length, tier1: t1, tier2: t2, tier3: t3 });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser && canAccessAdmin(currentUser.role)) loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleExtractPreview = async () => {
    setExtractRunning(true);
    setExtractPreview(null);
    try {
      const res = await fetch('/api/admin/scenarios/extract-demographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      });
      const data = (await res.json()) as ExtractResult;
      setExtractPreview(data);
      if (!data.success) toast.error(data.error || 'Preview failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview request failed');
    } finally {
      setExtractRunning(false);
    }
  };

  const handleExtractConfirm = async () => {
    setExtractConfirming(true);
    // The endpoint processes up to ~15 scenarios per call to stay
    // under Vercel's 60s function timeout. Loop here until
    // remaining_count is 0 so the operator sees one combined
    // result toast instead of having to click multiple times.
    let totalApplied = 0;
    let totalErrors = 0;
    let totalChanged = 0;
    let lastError: string | null = null;
    let safetyBatchCap = 10; // never more than 10 batches in one click
    try {
      while (safetyBatchCap-- > 0) {
        const res = await fetch('/api/admin/scenarios/extract-demographics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dry_run: false }),
        });
        const data = (await res.json()) as ExtractResult;
        if (!data.success) {
          lastError = data.error || 'Extraction failed';
          if (data.fix) lastError += ` — ${data.fix}`;
          break;
        }
        totalApplied += data.total_applied ?? 0;
        totalErrors += data.total_errors ?? 0;
        totalChanged += data.total_with_changes ?? 0;
        if ((data.remaining_count ?? 0) === 0) break;
      }
      if (lastError) {
        toast.error(lastError);
      } else {
        toast.success(
          `Updated ${totalApplied} scenarios (${totalChanged} with changes, ${totalErrors} errors)`
        );
      }
      setExtractPreview(null);
      loadAudit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction request failed');
    } finally {
      setExtractConfirming(false);
    }
  };

  if (status === 'loading' || (currentUser && !canAccessAdmin(currentUser.role))) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/admin/scenarios" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scenarios
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">Cleanup</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/scenarios"
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Scenario format cleanup
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Bulk-correct scenarios where the original import dumped demographic data into <code>patient_presentation</code> prose. The Extract action uses Claude to pull <code>chief_complaint</code>, <code>patient_age</code>, <code>patient_name</code>, <code>patient_sex</code>, <code>patient_weight</code>, <code>medical_history</code>, <code>medications</code>, <code>allergies</code> back into their proper columns. Idempotent — only fills empty fields.
        </p>

        {/* Audit counters */}
        {auditCounts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total scenarios</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{auditCounts.total}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 p-4 text-center">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Tier 1 (≤1 missing)</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{auditCounts.tier1}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 p-4 text-center">
              <p className="text-xs text-amber-700 dark:text-amber-300">Tier 2 (2-3 missing)</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{auditCounts.tier2}</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800 p-4 text-center">
              <p className="text-xs text-red-700 dark:text-red-300">Tier 3 (4+ missing)</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{auditCounts.tier3}</p>
            </div>
          </div>
        )}

        {/* Action 1 — Extract demographics */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Extract demographics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Targets every active scenario with <code>chief_complaint IS NULL</code> and a non-empty <code>patient_presentation</code> prose block. Runs Claude with a strict-JSON prompt and writes only currently-empty columns.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExtractPreview}
              disabled={extractRunning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {extractRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {extractRunning ? 'Scanning…' : 'Run dry-run preview'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Note: AI calls cost ~$0.01–0.02 per scenario. The full 56-scenario cleanup run is &lt;$1.
          </p>
        </section>

        {/* Action 2 — Generate content (uses existing endpoint) */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Generate learning content (per scenario)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            For Tier-2 scenarios still missing <code>learning_objectives</code> / <code>critical_actions</code> / <code>debrief_points</code> after the extraction pass, use the existing per-scenario AI generator at <code>POST /api/admin/scenarios/generate-content</code>. Per-scenario invocation lives on each scenario&apos;s edit page (look for the &quot;AI generate&quot; button).
          </p>
          <Link
            href="/labs/scenarios"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
          >
            Open scenarios library
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </main>

      {/* Extract preview / confirm modal */}
      {extractPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                Extract demographics — preview
              </h3>
              <button
                onClick={() => setExtractPreview(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Close"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Checked</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{extractPreview.total_checked ?? 0}</p>
                </div>
                <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-3 text-center">
                  <p className="text-xs text-purple-700 dark:text-purple-300">Will update</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{extractPreview.total_with_changes ?? 0}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Errors</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{extractPreview.total_errors ?? 0}</p>
                </div>
              </div>

              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Per scenario
              </h4>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
                {(extractPreview.changelog ?? []).length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No scenarios matched the filter.
                  </p>
                ) : (
                  (extractPreview.changelog ?? []).map(c => {
                    const filledCount = (c.fields_filled ?? []).length;
                    const hasErrors = (c.errors ?? []).length > 0;
                    return (
                      <div key={c.scenario_id} className="px-3 py-2 text-sm flex items-start gap-2">
                        {hasErrors ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-1" />
                        ) : filledCount > 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-1" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-gray-300 flex-shrink-0 mt-1" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{c.title}</p>
                          {filledCount > 0 && (
                            <p className="text-xs text-purple-700 dark:text-purple-300 truncate">
                              {(c.fields_filled ?? []).join(', ')}
                            </p>
                          )}
                          {hasErrors && (
                            <p className="text-xs text-red-600 dark:text-red-400" title={(c.errors ?? []).join(' · ')}>
                              {(c.errors ?? [])[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setExtractPreview(null)}
                disabled={extractConfirming}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExtractConfirm}
                disabled={extractConfirming || (extractPreview.total_with_changes ?? 0) === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {extractConfirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {extractConfirming
                  ? 'Applying…'
                  : `Confirm — update ${extractPreview.total_with_changes ?? 0} scenarios`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
