'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { hasMinRole, type Role } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapacityCheckResult {
  allowed: boolean;
  would_exceed: boolean;
  current: number;
  additional_requested: number;
  projected: number;
  max: number;
  utilization_percentage: number;
  message: string;
  site_name: string;
}

interface CapacityWarningProps {
  /** The ID of the site/agency to check */
  siteId: string;
  /** Whether siteId refers to an 'agency' or 'clinical_site' */
  source?: 'agency' | 'clinical_site';
  /** Optional: specific date to check (YYYY-MM-DD) */
  date?: string;
  /** How many additional students would be placed (default: 1) */
  studentCount?: number;
  /** Role of the current user, used to show the override button */
  userRole?: Role | string | null;
  /** Called when admin confirms override of capacity */
  onOverride?: () => void;
  /** Extra CSS classes on the wrapper */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CapacityWarning({
  siteId,
  source = 'agency',
  date,
  studentCount = 1,
  userRole,
  onOverride,
  className = '',
}: CapacityWarningProps) {
  const [result, setResult] = useState<CapacityCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideConfirm, setOverrideConfirm] = useState(false);

  const canOverride = userRole ? hasMinRole(userRole, 'admin') : false;

  useEffect(() => {
    if (!siteId) return;

    let cancelled = false;
    const check = async () => {
      setLoading(true);
      setError(null);
      setOverrideConfirm(false);
      try {
        const params = new URLSearchParams({
          site_id: siteId,
          source,
          student_count: String(studentCount),
        });
        if (date) params.set('date', date);

        const res = await fetch(`/api/clinical/capacity/check?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.success) {
          setResult(data);
        } else {
          setError(data.error || 'Failed to check capacity');
        }
      } catch {
        if (!cancelled) setError('Failed to check capacity');
      }
      if (!cancelled) setLoading(false);
    };

    check();
    return () => { cancelled = true; };
  }, [siteId, source, date, studentCount]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking capacity...
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 ${className}`}>
        <AlertCircle className="w-4 h-4" />
        Could not check capacity
      </div>
    );
  }

  if (!result) return null;

  // ── Within capacity ──────────────────────────────────────────────────────
  if (result.allowed) {
    const pct = result.utilization_percentage;
    const isHigh = pct >= 70;

    return (
      <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
        isHigh
          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
          : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
      } ${className}`}>
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>{result.message}</span>
      </div>
    );
  }

  // ── Over or at capacity ──────────────────────────────────────────────────
  return (
    <div className={`rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 space-y-2 ${className}`}>
      <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Capacity Warning: </span>
          {result.message}
        </div>
      </div>

      {/* Capacity bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-red-600 dark:text-red-400">
          <span>{result.projected} of {result.max} students</span>
          <span>{result.utilization_percentage}%</span>
        </div>
        <div className="h-2 bg-red-200 dark:bg-red-900/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 rounded-full"
            style={{ width: `${Math.min((result.projected / result.max) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Override button (admin+) */}
      {canOverride && onOverride && !overrideConfirm && (
        <button
          onClick={() => setOverrideConfirm(true)}
          className="text-xs text-red-700 dark:text-red-300 underline hover:no-underline"
        >
          Override capacity limit
        </button>
      )}

      {overrideConfirm && (
        <div className="p-2 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded text-xs space-y-2">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Confirm override — this will exceed the capacity limit for {result.site_name}.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setOverrideConfirm(false); onOverride?.(); }}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Yes, override
            </button>
            <button
              onClick={() => setOverrideConfirm(false)}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
