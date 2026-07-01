'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Home,
  Briefcase,
  Users,
  Building2,
  ClipboardList,
  Clock,
  LayoutDashboard,
  GraduationCap,
  Hospital,
  Ambulance,
  CalendarDays,
  BarChart3,
  BookOpen,
  Shuffle,
  ClipboardCheck,
} from 'lucide-react';
import { canAccessClinical, canAccessAffiliations, hasMinRole, type Role } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import Breadcrumbs from '@/components/Breadcrumbs';

interface DashboardStats {
  activePreceptors: number;
  totalClinicalSites: number;
  totalInternshipAgencies: number;
  inPhase1: number;
  inPhase2: number;
  atRisk: number;
  totalInternships: number;
}

interface PhaseCohort {
  cohort_id: string;
  cohort_number: number;
  current_semester: number | null;
  studentCount: number;
  ready: number | null;
  total: number | null;
  // S4 only — read-only rollup from /api/clinical/internships, grouped
  // client-side by cohort_id. Feeds the internship tracker; never writes.
  internPhase1: number | null;
  internPhase2: number | null;
  internAtRisk: number | null;
}

interface TrackerReadinessCohort {
  cohort_id: string;
  cohort_number: number;
  current_semester: number | null;
  total: number;
  ready: number;
}

interface CohortApiRow {
  id: string;
  cohort_number: number;
  current_semester: number | null;
  student_count: number;
  status?: 'active' | 'graduated';
  program?: { abbreviation: string | null } | null;
}

interface InternshipRow {
  cohort_id: string | null;
  current_phase: string | null;
  status: string | null;
}

// Phase labels for the readiness rollup. S1/S2 = clinical-prep (Complio/mCE
// tracker readiness), S3 = hospital clinicals, S4 = field internship.
const PHASE_LABELS: Record<number, { label: string; trackerLink: string; placeholder: string }> = {
  1: { label: 'S1 · Didactic', trackerLink: '/clinical/clinical-tracker', placeholder: 'No cohorts in the didactic phase' },
  2: { label: 'S2 · Compliance', trackerLink: '/clinical/clinical-tracker', placeholder: 'No cohorts in the compliance-prep phase' },
  3: { label: 'S3 · Clinicals', trackerLink: '/clinical/hours', placeholder: 'No cohorts in the clinical phase — hospital visits, hours, and rotation stats will show here' },
  4: { label: 'S4 · Internship', trackerLink: '/clinical/internships', placeholder: 'No cohorts in the internship phase' },
};

export default function ClinicalDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const effectiveRole = useEffectiveRole(userRole);
  const [stats, setStats] = useState<DashboardStats>({
    activePreceptors: 0,
    totalClinicalSites: 0,
    totalInternshipAgencies: 0,
    inPhase1: 0,
    inPhase2: 0,
    atRisk: 0,
    totalInternships: 0,
  });
  const [phaseCohorts, setPhaseCohorts] = useState<PhaseCohort[]>([]);
  const [graduatedCohorts, setGraduatedCohorts] = useState<PhaseCohort[]>([]);
  const [phaseLoading, setPhaseLoading] = useState(true);
  const [showGraduated, setShowGraduated] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Redirect when preview role lacks clinical/affiliations access
  useEffect(() => {
    if (effectiveRole && !canAccessClinical(effectiveRole) && !canAccessAffiliations(effectiveRole)) {
      router.push('/');
    }
  }, [effectiveRole, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);

        // Check permission
        if (!canAccessClinical(userData.user.role) && !canAccessAffiliations(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch stats — fetch clinical sites (hospitals) and internship agencies (EMS) separately
      const [preceptorsRes, clinicalSitesRes, internshipAgenciesRes, internshipsRes] = await Promise.all([
        fetch('/api/clinical/preceptors?activeOnly=true'),
        fetch('/api/clinical/agencies?type=hospital'),
        fetch('/api/clinical/agencies?type=ems'),
        fetch('/api/clinical/internships'),
      ]);

      const preceptorsData = await preceptorsRes.json();
      const clinicalSitesData = await clinicalSitesRes.json();
      const internshipAgenciesData = await internshipAgenciesRes.json();
      const internshipsData = await internshipsRes.json();

      const internships = internshipsData.internships || [];
      const inPhase1 = internships.filter((i: any) => i.current_phase === 'phase_1_mentorship').length;
      const inPhase2 = internships.filter((i: any) => i.current_phase === 'phase_2_evaluation').length;
      const atRisk = internships.filter((i: any) => i.status === 'at_risk').length;

      setStats({
        activePreceptors: preceptorsData.preceptors?.length || 0,
        totalClinicalSites: clinicalSitesData.agencies?.length || 0,
        totalInternshipAgencies: internshipAgenciesData.agencies?.length || 0,
        inPhase1,
        inPhase2,
        atRisk,
        totalInternships: internships.length,
      });

      // Read-only per-cohort internship rollup for the S4 phase card — the
      // internship page itself stays the write surface; this just groups
      // the same data client-side by cohort_id.
      const internshipsByCohort = new Map<string, { phase1: number; phase2: number; atRisk: number }>();
      (internships as InternshipRow[]).forEach((i) => {
        if (!i.cohort_id) return;
        const entry = internshipsByCohort.get(i.cohort_id) || { phase1: 0, phase2: 0, atRisk: 0 };
        if (i.current_phase === 'phase_1_mentorship') entry.phase1++;
        if (i.current_phase === 'phase_2_evaluation') entry.phase2++;
        if (i.status === 'at_risk') entry.atRisk++;
        internshipsByCohort.set(i.cohort_id, entry);
      });

      await fetchPhaseData(internshipsByCohort);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  // Phase-segmented readiness rollup — organized by cohorts.current_semester
  // (S1-S4), not program type. S1/S2 show Clinical Tracker Complio/mCE
  // readiness (ready/total); S3 shows cohort + student counts (clinical
  // markers land here once cohorts exist); S4 shows a read-only internship
  // rollup (phase1/phase2/at-risk) grouped from /api/clinical/internships.
  // Cohorts with status='graduated' are pulled out of the active phase view
  // entirely and surfaced separately in the collapsed Graduated section.
  // Replaces the old raw preceptor/site counts as the at-a-glance
  // "what's actionable" view Ben lands on.
  const fetchPhaseData = async (
    internshipsByCohort: Map<string, { phase1: number; phase2: number; atRisk: number }>
  ) => {
    setPhaseLoading(true);
    try {
      const [cohortsRes, readinessRes] = await Promise.all([
        fetch('/api/cohorts'),
        fetch('/api/clinical/tracker-readiness'),
      ]);
      const cohortsData = await cohortsRes.json();
      const readinessData = await readinessRes.json();

      const readinessByCohort = new Map<string, { ready: number; total: number }>();
      if (readinessData.success) {
        (readinessData.cohorts || []).forEach((r: TrackerReadinessCohort) => {
          readinessByCohort.set(r.cohort_id, { ready: r.ready, total: r.total });
        });
      }

      if (cohortsData.success) {
        const pmCohorts = (cohortsData.cohorts as CohortApiRow[] || []).filter(
          (c) => c.program?.abbreviation === 'PM' || c.program?.abbreviation === 'PMD'
        );
        const toPhaseCohort = (c: CohortApiRow): PhaseCohort => {
          const readiness = readinessByCohort.get(c.id);
          const intern = internshipsByCohort.get(c.id);
          return {
            cohort_id: c.id,
            cohort_number: c.cohort_number,
            current_semester: c.current_semester ?? null,
            studentCount: c.student_count || 0,
            ready: readiness?.ready ?? null,
            total: readiness?.total ?? null,
            internPhase1: intern?.phase1 ?? null,
            internPhase2: intern?.phase2 ?? null,
            internAtRisk: intern?.atRisk ?? null,
          };
        };
        setPhaseCohorts(pmCohorts.filter((c) => c.status !== 'graduated').map(toPhaseCohort));
        setGraduatedCohorts(pmCohorts.filter((c) => c.status === 'graduated').map(toPhaseCohort));
      }
    } catch (error) {
      console.error('Error fetching phase readiness data:', error);
    }
    setPhaseLoading(false);
  };

  const phasesBySemester = phaseCohorts.reduce((acc, c) => {
    const key = c.current_semester ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<number, PhaseCohort[]>);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Briefcase className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical & Internship</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage internships, preceptors, and field placements</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hospital Visit Log — fast, mobile-friendly quick access. Field
            exception to desktop-first (CLAUDE.md UI Layout Rule): this is
            the one action instructors realistically do FROM a phone while
            standing at a clinical site, so it gets a prominent, thumb-sized
            entry point right at the top rather than living inside "More
            clinical tools" like everything else. The full Site Visits page
            (filters/export/management) stays desktop-first as-is below. */}
        {effectiveRole && canAccessClinical(effectiveRole) && (
          <Link
            href="/clinical/site-visits"
            className="flex items-center justify-between gap-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg px-5 py-4 mb-6 transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <Hospital className="w-6 h-6 flex-shrink-0" />
              <div>
                <div className="font-semibold">Log a Hospital Visit</div>
                <div className="text-teal-100 text-xs">Fast entry — works well on your phone in the field</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 flex-shrink-0" />
          </Link>
        )}

        {/* Phase-segmented landing — organized by cohorts.current_semester
            (S1-S4), not program type. This is the "what's actionable now"
            view Ben lands on, replacing the old raw preceptor/site/internship
            counts. Every phase tile always renders (even with 0 cohorts) so
            the page reads as "here's the whole pipeline," not just whatever
            happens to be populated today. */}
        {effectiveRole && canAccessClinical(effectiveRole) && !phaseLoading && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Clinical readiness by phase
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((sem) => {
                const cohorts = phasesBySemester[sem] || [];
                const phase = PHASE_LABELS[sem];
                const isS4 = sem === 4;
                return (
                  <div key={sem} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{phase.label}</h3>
                      <Link href={phase.trackerLink} className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5">
                        Open <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                    {cohorts.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">{phase.placeholder}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {cohorts.map((c) => (
                          <Link
                            key={c.cohort_id}
                            href={isS4 ? `/clinical/internships/cohort/${c.cohort_id}` : `${phase.trackerLink}?cohortId=${c.cohort_id}`}
                            className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <span className="text-gray-700 dark:text-gray-300">Cohort {c.cohort_number}</span>
                            {isS4 && c.internPhase1 != null ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                {c.internAtRisk ? (
                                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                                    {c.internAtRisk} at risk
                                  </span>
                                ) : null}
                                <span>P1 {c.internPhase1} · P2 {c.internPhase2}</span>
                              </span>
                            ) : c.total != null ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.ready === c.total ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                {c.ready}/{c.total} ready
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">{c.studentCount} students</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Graduated cohorts — collapsed by default. Pulled out of the
            active S1-S4 phase view above (status='graduated' on cohorts,
            set via the "Graduate" toggle on the Cohort Manager), but still
            fully clickable/accessible here. Distinct from archiving
            (is_archived) — archive stays the separate final "put away"
            step; graduating just moves a finished cohort out of the active
            pipeline view. */}
        {effectiveRole && canAccessClinical(effectiveRole) && !phaseLoading && graduatedCohorts.length > 0 && (
          <div className="mb-10">
            <button
              type="button"
              onClick={() => setShowGraduated((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {showGraduated ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <GraduationCap className="w-4 h-4" />
              Graduated ({graduatedCohorts.length})
            </button>
            {showGraduated && (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {graduatedCohorts.map((c) => (
                  <div key={c.cohort_id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 opacity-90">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Cohort {c.cohort_number}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                        Graduated
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Link href={`/clinical/clinical-tracker?cohortId=${c.cohort_id}`} className="text-teal-600 dark:text-teal-400 hover:underline">Clinical Tracker</Link>
                      <Link href={`/clinical/internships/cohort/${c.cohort_id}`} className="text-teal-600 dark:text-teal-400 hover:underline">Internships</Link>
                      <Link href={`/clinical/hours?cohortId=${c.cohort_id}`} className="text-teal-600 dark:text-teal-400 hover:underline">Hours</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/*
          Primary workflow cards. The four tools Ryan and Rae reach for
          most often: Preceptor Directory, Internship Tracker, Clinical
          Hours, Site Visits. Kept as large visually-prominent cards in
          a 2x2 grid so they're impossible to miss at page load.
         */}
        {effectiveRole && canAccessClinical(effectiveRole) && (
          <div className="mb-10">
            <div className="grid md:grid-cols-2 gap-6">
              <PrimaryCard
                href="/clinical/preceptors"
                icon={Users}
                title="Preceptor Directory"
                description="View and manage field training officers"
                accent="teal"
                metric={`${stats.activePreceptors} active preceptors`}
              />
              <PrimaryCard
                href="/clinical/internships"
                icon={ClipboardList}
                title="Internship Tracker"
                description="Track student progress through internship phases"
                accent="purple"
                metric={`${stats.totalInternships} students tracked`}
              />
              <PrimaryCard
                href="/clinical/hours"
                icon={Clock}
                title="Clinical Hours"
                description="Track shifts and hours by department"
                accent="blue"
                metric="View tracker"
              />
              <PrimaryCard
                href="/clinical/site-visits"
                icon={Building2}
                title="Site Visits"
                description="Log and track instructor visits to clinical sites"
                accent="cyan"
                metric="Log visit"
              />
              <PrimaryCard
                href="/clinical/clinical-tracker"
                icon={ClipboardCheck}
                title="Clinical Tracker"
                description="Complio & mCE module documentation checklist"
                accent="orange"
                metric="Track compliance"
              />
            </div>
          </div>
        )}

        {/*
          Secondary section — everything else, below a visual divider.
          Uses compact 3/4-column cards with smaller text + subtle styling
          so the primary workflow above stays visually dominant.
         */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
            More clinical tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {effectiveRole && canAccessClinical(effectiveRole) && (
              <>
                <SecondaryCard
                  href="/clinical/overview"
                  icon={LayoutDashboard}
                  title="Overview Dashboard"
                  description="All priorities at a glance"
                />
                <SecondaryCard
                  href="/academics/cohorts"
                  icon={GraduationCap}
                  title="Cohort Manager"
                  description="Cohorts, semesters, dates"
                />
                <SecondaryCard
                  href="/clinical/agencies?type=hospital"
                  icon={Hospital}
                  title="Clinical Sites"
                  description="Hospitals & ERs"
                  badge={stats.totalClinicalSites}
                />
                <SecondaryCard
                  href="/clinical/agencies?type=ems"
                  icon={Ambulance}
                  title="Internship Agencies"
                  description="Fire & ambulance services"
                  badge={stats.totalInternshipAgencies}
                />
                {effectiveRole && hasMinRole(effectiveRole, 'admin') && (
                  <SecondaryCard
                    href="/admin/exam-sessions"
                    icon={CalendarDays}
                    title="Manage Exam Sessions"
                    description="Written exam sessions, approvals, results"
                  />
                )}
                <SecondaryCard
                  href="/clinical/emt-tracking"
                  icon={ClipboardList}
                  title="EMT Tracking"
                  description="mCE, vax, ride-alongs"
                />
                <SecondaryCard
                  href="/clinical/aemt-tracking"
                  icon={ClipboardList}
                  title="AEMT Tracking"
                  description="mCE, vax, ride-alongs"
                />
                <SecondaryCard
                  href="/clinical/mce"
                  icon={BookOpen}
                  title="MCE Tracker"
                  description="Continuing ed hours"
                />
                <SecondaryCard
                  href="/clinical/ride-alongs"
                  icon={Ambulance}
                  title="Ride-Alongs"
                  description="EMT ride-along shifts"
                />
                <SecondaryCard
                  href="/clinical/rotation-scheduler"
                  icon={Shuffle}
                  title="Rotation Scheduler"
                  description="Assign students to slots"
                />
                <SecondaryCard
                  href="/clinical/capacity"
                  icon={BarChart3}
                  title="Site Capacity"
                  description="Placement limits"
                />
                <SecondaryCard
                  href="/clinical/planning-calendar"
                  icon={CalendarDays}
                  title="Planning Calendar"
                  description="Site access days"
                />
                <SecondaryCard
                  href="/clinical/summative-evaluations"
                  icon={ClipboardList}
                  title="Summative Evaluations"
                  description="Semester 4 finals"
                />
                <SecondaryCard
                  href="/admin/osce-events"
                  icon={ClipboardCheck}
                  title="OSCE Events"
                  description="Evaluator signups"
                />
                <SecondaryCard
                  href="/admin/volunteer-events"
                  icon={Users}
                  title="Volunteer Recruitment"
                  description="NREMT & lab volunteers"
                />
              </>
            )}
            {/* Affiliation Tracker hidden per codebase-streamline
                spec. /clinical/affiliations page + API + DB intact —
                only the entry card is removed. Direct URL still
                works if anyone has a bookmark. */}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Card components — kept local so the parent component stays scannable
   and we avoid coupling to the shared ToolCard abstraction used on the
   cohort hub (different visual weight requirements).
   ────────────────────────────────────────────────────────────────── */

type CardIcon = ComponentType<{ className?: string }>;

type Accent = 'teal' | 'purple' | 'blue' | 'cyan' | 'orange';

const ACCENT_CLASSES: Record<
  Accent,
  { iconBg: string; iconBgHover: string; iconColor: string; text: string }
> = {
  teal: {
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconBgHover: 'group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50',
    iconColor: 'text-teal-600 dark:text-teal-400',
    text: 'text-teal-600 dark:text-teal-400',
  },
  purple: {
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconBgHover: 'group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
    text: 'text-purple-600 dark:text-purple-400',
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconBgHover: 'group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
  },
  cyan: {
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconBgHover: 'group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
  orange: {
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconBgHover: 'group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50',
    iconColor: 'text-orange-600 dark:text-orange-400',
    text: 'text-orange-600 dark:text-orange-400',
  },
};

function PrimaryCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
  metric,
}: {
  href: string;
  icon: CardIcon;
  title: string;
  description: string;
  accent: Accent;
  metric: string;
}) {
  const a = ACCENT_CLASSES[accent];
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-xl transition-colors ${a.iconBg} ${a.iconBgHover}`}
        >
          <Icon className={`w-6 h-6 ${a.iconColor}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {description}
          </p>
          <div className={`flex items-center text-sm font-medium ${a.text}`}>
            {metric}
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function SecondaryCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: CardIcon;
  title: string;
  description: string;
  badge?: number | null;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all p-3 group flex items-start gap-2.5"
    >
      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          {typeof badge === 'number' && (
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-medium rounded tabular-nums">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {description}
        </p>
      </div>
    </Link>
  );
}
