'use client';

/**
 * Cohort Progress (viewing page #2) — mid-semester stats for a cohort.
 * Read-only aggregator; reuses the proven /api/reports/lab-progress endpoint
 * (scenario performance, skill completion, team-lead coverage, at-risk flags).
 */

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

interface Report {
  cohort: { id: string; name: string; programAbbreviation: string; cohortNumber: number };
  summary: { totalLabDays: number; totalStations: number; scenarioStations: number; skillStations: number; totalStudents: number };
  scenarioScores: { averageOverall: number; averageAssessment: number; averageTreatment: number; averageCommunication: number };
  skillsProgress: { completed: number; total: number; completionRate: number };
  teamLeadStats: { totalRotations: number; averagePerStudent: number; studentsWithZero: number };
  flaggedStudents: { id: string; name: string; reason: string; details: string }[];
  studentBreakdown: { id: string; name: string; scenarioCount: number; averageScore: number; skillsCompleted: number; teamLeadCount: number; attendance: number }[];
}

export default function CohortProgressPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params?.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

  const load = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/reports/lab-progress?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) setReport(data.report);
      else setError(data.error || 'Failed to load');
    } catch { setError('Failed to load'); } finally { setLoading(false); }
  }, [cohortId]);

  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;

  const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}{sub ? ` · ${sub}` : ''}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-5">
        <Link href={`/academics/cohorts/${cohortId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" /> Cohort
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Cohort Progress{report ? ` — ${report.cohort.name}` : ''}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Mid-semester tracked stats (scenarios, skills, team-lead coverage).</p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-4">{error}</div>
        ) : report ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat label="Students" value={report.summary.totalStudents} />
              <Stat label="Lab days" value={report.summary.totalLabDays} />
              <Stat label="Avg scenario" value={report.scenarioScores.averageOverall.toFixed(1)} sub="of 4" />
              <Stat label="Skills" value={`${Math.round(report.skillsProgress.completionRate)}%`} sub={`${report.skillsProgress.completed}/${report.skillsProgress.total}`} />
              <Stat label="TL rotations" value={report.teamLeadStats.totalRotations} sub={`${report.teamLeadStats.averagePerStudent.toFixed(1)}/student`} />
              <Stat label="No TL yet" value={report.teamLeadStats.studentsWithZero} />
            </div>

            {report.flaggedStudents.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> Flagged for review ({report.flaggedStudents.length})</h2>
                <div className="space-y-1">
                  {report.flaggedStudents.map((f, i) => (
                    <div key={`${f.id}-${i}`} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-1.5 text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{f.name}</span>
                      <span className="text-amber-700 dark:text-amber-300"> — {f.reason}</span>
                      <span className="text-gray-500 dark:text-gray-400"> ({f.details})</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Per-student</h2>
              <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Student</th>
                      <th className="text-right font-medium px-3 py-2">Scenarios</th>
                      <th className="text-right font-medium px-3 py-2">Avg score</th>
                      <th className="text-right font-medium px-3 py-2">Skills</th>
                      <th className="text-right font-medium px-3 py-2">Team-lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.studentBreakdown.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                        <td className="px-3 py-1.5 text-gray-800 dark:text-gray-100">{s.name}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{s.scenarioCount}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{s.averageScore ? s.averageScore.toFixed(1) : '—'}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{s.skillsCompleted}</td>
                        <td className={`px-3 py-1.5 text-right ${s.teamLeadCount === 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>{s.teamLeadCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
