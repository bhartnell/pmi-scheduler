'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  MapPin,
  Calendar,
  ChevronRight,
  Clock,
  RefreshCw
} from 'lucide-react';

interface SiteCoverage {
  siteId: string;
  siteName: string;
  abbreviation: string;
  lastVisitDate: string | null;
  daysSinceVisit: number | null;
  visitsThisMonth: number;
  isKeysite: boolean;
  needsAttention: boolean;
}

interface CoverageResponse {
  success: boolean;
  sitesNeedingAttention: SiteCoverage[];
  hasSemester3Cohorts: boolean;
  keySites: string[];
  daysThreshold: number;
  summary: {
    totalSites: number;
    keySiteCount: number;
    sitesNeedingAttention: number;
    averageVisitsThisMonth: string | number;
  };
}

interface SiteVisitAlertsProps {
  showOnlyWhenNeeded?: boolean;
  compact?: boolean;
  onLogVisit?: () => void;
}

export default function SiteVisitAlerts({
  showOnlyWhenNeeded = true,
  compact = false,
  onLogVisit,
}: SiteVisitAlertsProps) {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCoverage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clinical/site-visits/coverage?keySitesOnly=true');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to load');
      }
    } catch (err) {
      setError('Failed to load coverage data');
    }
    setLoading(false);
  };

  // Send notification to directors about overdue sites (once per day)
  const sendOverdueNotification = async (sites: SiteCoverage[]) => {
    const storageKey = 'site-visit-reminder-sent';
    const lastSent = localStorage.getItem(storageKey);
    const today = new Date().toISOString().split('T')[0];

    if (lastSent === today) return; // Already sent today

    try {
      await fetch('/api/clinical/site-visits/coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify_overdue',
          sites: sites.map(s => ({ name: s.siteName, abbreviation: s.abbreviation, daysSinceVisit: s.daysSinceVisit }))
        })
      });
      localStorage.setItem(storageKey, today);
    } catch {
      // Silently fail - notification is best-effort
    }
  };

  useEffect(() => {
    fetchCoverage();
  }, []);

  useEffect(() => {
    if (data?.sitesNeedingAttention && data.sitesNeedingAttention.length > 0 && data.hasSemester3Cohorts) {
      sendOverdueNotification(data.sitesNeedingAttention);
    }
  }, [data]);

  // Don't show if there are no Semester 3 cohorts
  if (!loading && data && !data.hasSemester3Cohorts) {
    return null;
  }

  // Don't show if no alerts and showOnlyWhenNeeded is true
  if (showOnlyWhenNeeded && !loading && data && data.sitesNeedingAttention.length === 0) {
    return null;
  }

  if (loading) {
    return compact ? null : (
      <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4 h-24" />
    );
  }

  if (error) {
    return null; // Silently fail in production
  }

  if (!data) return null;

  const { sitesNeedingAttention, daysThreshold } = data;

  if (sitesNeedingAttention.length === 0) {
    // Show a positive message when all key sites are covered
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-medium text-green-800 dark:text-green-300">
              Clinical Site Visits Up to Date
            </h3>
            <p className="text-sm text-green-600 dark:text-green-400">
              All key sites have been visited within the last {daysThreshold} days
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <Link
        href="/clinical/site-visits"
        className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {sitesNeedingAttention.length} site{sitesNeedingAttention.length > 1 ? 's' : ''} need{sitesNeedingAttention.length === 1 ? 's' : ''} a visit
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
            ({sitesNeedingAttention.map(s => s.abbreviation).join(', ')})
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-amber-500" />
      </Link>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            Clinical Site Visit Alerts
          </h3>
        </div>
        <button
          onClick={fetchCoverage}
          className="p-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-900/50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alert message */}
      <div className="px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          The following key clinical sites haven&apos;t been visited in over {daysThreshold} days:
        </p>
      </div>

      {/* Sites list */}
      <div className="px-4 pb-4">
        <div className="space-y-2">
          {sitesNeedingAttention.map((site) => (
            <div
              key={site.siteId}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  site.daysSinceVisit === null || site.daysSinceVisit >= 21
                    ? 'bg-red-100 dark:bg-red-900/40'
                    : 'bg-amber-100 dark:bg-amber-900/40'
                }`}>
                  <MapPin className={`w-5 h-5 ${
                    site.daysSinceVisit === null || site.daysSinceVisit >= 21
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {site.siteName}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {site.abbreviation}
                    </span>
                    {site.lastVisitDate ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Last: {new Date(site.lastVisitDate + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    ) : (
                      <span className="text-red-500 dark:text-red-400">No visits recorded</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {site.daysSinceVisit !== null ? (
                  <div className={`flex items-center gap-1 font-medium ${
                    site.daysSinceVisit >= 21
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span>{site.daysSinceVisit}d ago</span>
                    {site.daysSinceVisit >= 21 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">
                        Overdue
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-500 dark:text-red-400 font-medium text-sm">
                    <span>Never visited</span>
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">
                      Overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action button */}
        {onLogVisit ? (
          <button
            type="button"
            onClick={onLogVisit}
            className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors w-full"
          >
            <Calendar className="w-4 h-4" />
            Log a Visit
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href="/clinical/site-visits"
            className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Log a Visit
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
