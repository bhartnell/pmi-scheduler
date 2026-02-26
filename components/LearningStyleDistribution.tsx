'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Brain, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface StyleTotals {
  audio: number;
  visual: number;
  kinesthetic: number;
  unknown: number;
  [key: string]: number;
}

interface StationBreakdown {
  station_id: string;
  station_number: number;
  label: string;
  counts: Record<string, number>;
  diversityScore: number;
  isDiverse: boolean;
}

interface LearningStyleReportData {
  cohortId: string;
  totalStudents: number;
  assessedCount: number;
  totals: StyleTotals;
  diversityScore: number;
  byStation: StationBreakdown[];
}

const STYLE_CONFIG: Record<string, { label: string; letter: string; bg: string; bar: string; text: string }> = {
  audio:       { label: 'Auditory',    letter: 'A', bg: 'bg-blue-100 dark:bg-blue-900/30',   bar: 'bg-blue-500',   text: 'text-blue-700 dark:text-blue-300' },
  visual:      { label: 'Visual',      letter: 'V', bg: 'bg-purple-100 dark:bg-purple-900/30', bar: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  kinesthetic: { label: 'Kinesthetic', letter: 'K', bg: 'bg-orange-100 dark:bg-orange-900/30', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  unknown:     { label: 'Not assessed', letter: '?', bg: 'bg-gray-100 dark:bg-gray-700',      bar: 'bg-gray-300 dark:bg-gray-600',   text: 'text-gray-500 dark:text-gray-400' },
};

// Inline SVG donut chart (no external dependencies)
function DonutChart({ data }: { data: { value: number; color: string; label: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data
    .filter(d => d.value > 0)
    .map(d => {
      const pct = d.value / total;
      const len = pct * circumference;
      const segment = { ...d, offset, len };
      offset += len;
      return segment;
    });

  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28" style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="16"
          stroke={seg.color}
          strokeDasharray={`${seg.len} ${circumference - seg.len}`}
          strokeDashoffset={-seg.offset}
        >
          <title>{seg.label}: {seg.value}</title>
        </circle>
      ))}
      {/* center hole */}
      <circle cx="50" cy="50" r="32" fill="white" className="dark:fill-gray-800" />
    </svg>
  );
}

const DONUT_COLORS: Record<string, string> = {
  audio: '#3b82f6',
  visual: '#a855f7',
  kinesthetic: '#f97316',
  unknown: '#9ca3af',
};

interface LearningStyleDistributionProps {
  /** Pass either a lab_day_id or cohort_id */
  labDayId?: string;
  cohortId?: string;
  /** Link to learning styles management page */
  cohortLinkId?: string;
  /** If true, hide the by-station table (useful in contexts without station data) */
  hideStations?: boolean;
}

export default function LearningStyleDistribution({
  labDayId,
  cohortId,
  cohortLinkId,
  hideStations = false,
}: LearningStyleDistributionProps) {
  const [data, setData] = useState<LearningStyleReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (labDayId) params.set('lab_day_id', labDayId);
    else if (cohortId) params.set('cohort_id', cohortId);
    else return;

    setLoading(true);
    fetch(`/api/lab-management/learning-style-report?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d);
      })
      .catch(err => console.error('Learning style report error:', err))
      .finally(() => setLoading(false));
  }, [labDayId, cohortId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
          <span className="text-sm">Loading learning style data...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, totalStudents, assessedCount, diversityScore, byStation } = data;

  const donutData = Object.entries(STYLE_CONFIG).map(([key, cfg]) => ({
    value: totals[key] || 0,
    color: DONUT_COLORS[key],
    label: cfg.label,
  }));

  const knownCount = assessedCount;
  const diversityPct = Math.round(diversityScore * 100);

  const styleOrder = ['audio', 'visual', 'kinesthetic', 'unknown'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <button
          onClick={() => setCollapsed(p => !p)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <Brain className="w-5 h-5 text-purple-500 shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Learning Style Distribution</h3>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
            {assessedCount}/{totalStudents} assessed
          </span>
          <BarChart3 className={`w-4 h-4 shrink-0 ml-auto text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
        {cohortLinkId && (
          <Link
            href={`/lab-management/seating/learning-styles?cohortId=${cohortLinkId}`}
            className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            Manage
          </Link>
        )}
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {assessedCount === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              No learning styles assessed for this cohort yet.{' '}
              {cohortLinkId && (
                <Link href={`/lab-management/seating/learning-styles?cohortId=${cohortLinkId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                  Add assessments
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Overview row: donut + bars */}
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Donut */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <DonutChart data={donutData} />
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Diversity
                    </div>
                    <div className={`text-sm font-bold ${diversityPct >= 60 ? 'text-green-600 dark:text-green-400' : diversityPct >= 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {diversityPct}%
                    </div>
                  </div>
                </div>

                {/* Bar chart */}
                <div className="flex-1 space-y-2 w-full">
                  {styleOrder.map(key => {
                    const cfg = STYLE_CONFIG[key];
                    const count = totals[key] || 0;
                    const base = key === 'unknown' ? totalStudents : knownCount || 1;
                    const pct = count > 0 ? Math.round((count / base) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                          {cfg.letter}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-20 shrink-0">{cfg.label}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${cfg.bar} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right shrink-0">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 text-xs">
                {styleOrder.filter(k => k !== 'unknown').map(key => {
                  const cfg = STYLE_CONFIG[key];
                  return (
                    <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} font-medium`}>
                      <span className="font-bold">{cfg.letter}</span>
                      {cfg.label}
                    </span>
                  );
                })}
              </div>

              {/* Per-station breakdown */}
              {!hideStations && byStation.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Station Distribution
                  </h4>
                  <div className="space-y-2">
                    {byStation.map(station => {
                      const total = Object.values(station.counts).reduce((s, v) => s + v, 0);
                      const styleEntries = styleOrder.filter(k => k !== 'unknown' && (station.counts[k] || 0) > 0);

                      return (
                        <div key={station.station_id} className="flex items-start gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300 w-24 shrink-0 truncate">
                            {station.label.length > 16 ? `S${station.station_number}` : station.label}
                          </span>
                          <div className="flex flex-wrap gap-1 flex-1">
                            {total === 0 ? (
                              <span className="text-xs text-gray-400">No students assigned</span>
                            ) : (
                              <>
                                {styleOrder.map(key => {
                                  const cfg = STYLE_CONFIG[key];
                                  const cnt = station.counts[key] || 0;
                                  if (cnt === 0) return null;
                                  return (
                                    <span
                                      key={key}
                                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}
                                    >
                                      {cfg.letter}:{cnt}
                                    </span>
                                  );
                                })}
                                {station.isDiverse ? (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-3 h-3" />
                                    Mixed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    Single style
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
