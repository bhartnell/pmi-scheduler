'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Database,
  Activity,
  Heart,
  Shield,
  Search,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FieldStat {
  field: string;
  populated: number;
  empty: number;
  percent: number;
}

interface ScenarioIssue {
  id: string;
  title: string;
  issues: string[];
  category: string | null;
  difficulty: string | null;
  has_phases: boolean;
  phase_count: number;
  has_vitals: boolean;
  has_chief_complaint: boolean;
  created_at: string;
}

interface IssueFrequency {
  issue: string;
  count: number;
  percent: number;
}

interface AuditData {
  total: number;
  active: number;
  inactive: number;
  message?: string;

  field_stats: FieldStat[];
  category_breakdown: Record<string, number>;
  difficulty_breakdown: Record<string, number>;
  program_breakdown: Record<string, number>;

  phases: {
    has_phases: number;
    no_phases: number;
    avg_phase_count: number;
    phases_as_array: number;
    phases_as_other: number;
    phases_with_vitals: number;
    phases_with_expected_actions: number;
    phases_with_presentation_notes: number;
    sample_phase_structures: unknown[];
  };

  critical_actions: {
    has_critical_actions: number;
    as_object_array: number;
    as_string_array: number;
    as_other: number;
    sample_structures: unknown[];
  };

  vitals: {
    has_initial_vitals: number;
    vitals_as_object: number;
    vitals_with_bp: number;
    vitals_with_hr: number;
    vitals_with_full_xabcde: number;
    sample_structures: unknown[];
  };

  issue_frequency: IssueFrequency[];
  problematic_scenarios: number;
  clean_scenarios: number;
  issues: ScenarioIssue[];

  raw_samples: unknown[];
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------
function StatCard({ label, value, subValue, color }: { label: string; value: number | string; subValue?: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</div>
      {subValue && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

function FieldBar({ stat, total }: { stat: FieldStat; total: number }) {
  const pct = stat.percent;
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 25 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = pct === 100 ? 'text-green-600 dark:text-green-400' : pct >= 75 ? 'text-blue-600 dark:text-blue-400' : pct >= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 text-sm font-mono text-gray-700 dark:text-gray-300 truncate" title={stat.field}>
        {stat.field}
      </div>
      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`w-20 text-right text-sm font-medium ${textColor}`}>
        {stat.populated}/{total} ({pct}%)
      </div>
    </div>
  );
}

function SeverityBadge({ count }: { count: number }) {
  if (count >= 8) return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Critical</span>;
  if (count >= 5) return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">High</span>;
  if (count >= 3) return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Medium</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Low</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScenarioAuditPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'issues']));
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState('');

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (session) {
      fetch('/api/admin/scenarios/audit')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAudit(data.audit);
          } else {
            setError(data.error || 'Failed to load audit');
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [session]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-500" />
            Scenario Data Audit
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Comprehensive analysis of scenario data structure and quality
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="animate-spin h-10 w-10 text-indigo-500 mx-auto" />
            <p className="mt-3 text-gray-500 dark:text-gray-400">Auditing all scenarios...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-800 dark:text-red-300">{error}</span>
        </div>
      )}

      {audit && (
        <>
          {/* Overview Stats */}
          <section>
            <button
              onClick={() => toggleSection('overview')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('overview') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Database className="h-5 w-5 text-gray-500" />
              Overview
            </button>
            {expandedSections.has('overview') && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total Scenarios" value={audit.total} color="text-gray-900 dark:text-white" />
                <StatCard label="Active" value={audit.active} color="text-green-600 dark:text-green-400" />
                <StatCard label="Inactive" value={audit.inactive} color="text-gray-500" />
                <StatCard label="Clean" value={audit.clean_scenarios} subValue="No issues" color="text-green-600 dark:text-green-400" />
                <StatCard label="With Issues" value={audit.problematic_scenarios} color="text-red-600 dark:text-red-400" />
                <StatCard label="Avg Phases" value={audit.phases.avg_phase_count} color="text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </section>

          {/* Category & Difficulty Breakdown */}
          <section>
            <button
              onClick={() => toggleSection('breakdown')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('breakdown') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Category & Difficulty Breakdown
            </button>
            {expandedSections.has('breakdown') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Categories */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Categories</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.category_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => (
                        <div key={cat} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{cat}</span>
                          <span className="font-mono text-gray-500">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Difficulty</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.difficulty_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([diff, count]) => (
                        <div key={diff} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">{diff}</span>
                          <span className="font-mono text-gray-500">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Programs */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Programs</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.program_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([prog, count]) => (
                        <div key={prog} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{prog}</span>
                          <span className="font-mono text-gray-500">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Field Population */}
          <section>
            <button
              onClick={() => toggleSection('fields')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('fields') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <FileText className="h-5 w-5 text-gray-500" />
              Field Population ({audit.field_stats.filter(f => f.percent === 100).length}/{audit.field_stats.length} fully populated)
            </button>
            {expandedSections.has('fields') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                <div className="space-y-0.5">
                  {[...audit.field_stats].sort((a, b) => a.percent - b.percent).map(stat => (
                    <FieldBar key={stat.field} stat={stat} total={audit.total} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Structure Analysis */}
          <section>
            <button
              onClick={() => toggleSection('structure')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('structure') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Activity className="h-5 w-5 text-gray-500" />
              Data Structure Analysis
            </button>
            {expandedSections.has('structure') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Phases */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Phases
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has phases</span>
                      <span className="font-mono text-green-600 dark:text-green-400">{audit.phases.has_phases}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">No phases</span>
                      <span className="font-mono text-red-600 dark:text-red-400">{audit.phases.no_phases}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Avg phase count</span>
                      <span className="font-mono">{audit.phases.avg_phase_count}</span>
                    </div>
                    <hr className="dark:border-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">With vitals</span>
                      <span className="font-mono">{audit.phases.phases_with_vitals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">With actions</span>
                      <span className="font-mono">{audit.phases.phases_with_expected_actions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">With notes</span>
                      <span className="font-mono">{audit.phases.phases_with_presentation_notes}</span>
                    </div>
                  </div>
                </div>

                {/* Critical Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    Critical Actions
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has actions</span>
                      <span className="font-mono">{audit.critical_actions.has_critical_actions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">As {'{id, desc}'} objects</span>
                      <span className="font-mono text-green-600 dark:text-green-400">{audit.critical_actions.as_object_array}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">As plain strings</span>
                      <span className="font-mono text-yellow-600 dark:text-yellow-400">{audit.critical_actions.as_string_array}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Other format</span>
                      <span className="font-mono text-red-600 dark:text-red-400">{audit.critical_actions.as_other}</span>
                    </div>
                  </div>
                </div>

                {/* Vitals */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Initial Vitals
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has vitals</span>
                      <span className="font-mono">{audit.vitals.has_initial_vitals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">As objects</span>
                      <span className="font-mono">{audit.vitals.vitals_as_object}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has BP</span>
                      <span className="font-mono">{audit.vitals.vitals_with_bp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has HR</span>
                      <span className="font-mono">{audit.vitals.vitals_with_hr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Full XABCDE format</span>
                      <span className="font-mono">{audit.vitals.vitals_with_full_xabcde}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Issue Frequency */}
          <section>
            <button
              onClick={() => toggleSection('frequency')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('frequency') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Issue Frequency
            </button>
            {expandedSections.has('frequency') && audit.issue_frequency.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left py-2 px-4 font-medium text-gray-600 dark:text-gray-400">Issue</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-600 dark:text-gray-400">Count</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-600 dark:text-gray-400">% of All</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {audit.issue_frequency.map((iss, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2 px-4 text-gray-800 dark:text-gray-200">{iss.issue}</td>
                        <td className="py-2 px-4 text-right font-mono text-gray-600 dark:text-gray-400">{iss.count}</td>
                        <td className="py-2 px-4 text-right">
                          <span className={`font-mono ${iss.percent >= 75 ? 'text-red-600 dark:text-red-400' : iss.percent >= 50 ? 'text-orange-600 dark:text-orange-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            {iss.percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {expandedSections.has('frequency') && audit.issue_frequency.length === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-green-800 dark:text-green-300">All scenarios pass audit checks!</span>
              </div>
            )}
          </section>

          {/* Problematic Scenarios */}
          <section>
            <button
              onClick={() => toggleSection('issues')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('issues') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <XCircle className="h-5 w-5 text-red-500" />
              Problematic Scenarios ({audit.problematic_scenarios})
            </button>
            {expandedSections.has('issues') && audit.issues.length > 0 && (
              <div className="space-y-3">
                {/* Filter */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={issueFilter}
                    onChange={(e) => setIssueFilter(e.target.value)}
                    placeholder="Filter scenarios by title or issue..."
                    className="w-full pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  {audit.issues
                    .filter(s => {
                      if (!issueFilter) return true;
                      const q = issueFilter.toLowerCase();
                      return s.title.toLowerCase().includes(q) || s.issues.some(i => i.toLowerCase().includes(q));
                    })
                    .map((s) => (
                      <div key={s.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <button
                          onClick={() => setExpandedScenario(expandedScenario === s.id ? null : s.id)}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          {expandedScenario === s.id ? (
                            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {s.title}
                              </span>
                              <SeverityBadge count={s.issues.length} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              <span>{s.category || 'No category'}</span>
                              <span>{s.difficulty || 'No difficulty'}</span>
                              <span>{s.phase_count} phases</span>
                              <span>{s.issues.length} issues</span>
                            </div>
                          </div>
                          <Link
                            href={`/lab-management/scenarios/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex-shrink-0"
                            title="Open in editor"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </button>

                        {expandedScenario === s.id && (
                          <div className="px-4 pb-3 border-t dark:border-gray-700 pt-2">
                            <div className="space-y-1">
                              {s.issues.map((issue, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-gray-700 dark:text-gray-300">{issue}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 font-mono">
                              ID: {s.id}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* Raw Samples */}
          <section>
            <button
              onClick={() => toggleSection('samples')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('samples') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Database className="h-5 w-5 text-gray-500" />
              Raw Data Samples ({audit.raw_samples.length})
            </button>
            {expandedSections.has('samples') && (
              <div className="space-y-4">
                {audit.raw_samples.map((sample, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Sample {i + 1}
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(sample, null, 2)}
                    </pre>
                  </div>
                ))}

                {/* Phase structure samples */}
                {audit.phases.sample_phase_structures.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Phase Structure Samples
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(audit.phases.sample_phase_structures, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Vitals structure samples */}
                {audit.vitals.sample_structures.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Vitals Structure Samples
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(audit.vitals.sample_structures, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Critical actions structure samples */}
                {audit.critical_actions.sample_structures.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Critical Actions Structure Samples
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(audit.critical_actions.sample_structures, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
