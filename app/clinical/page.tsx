'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Briefcase,
  Users,
  Building2,
  ClipboardList,
  TrendingUp,
  Clock,
  FileCheck,
  LayoutDashboard,
  GraduationCap,
  Hospital,
  Ambulance,
  CalendarDays,
  BarChart3,
  Shield,
  BookOpen,
  Shuffle,
  ScrollText,
  ClipboardCheck,
} from 'lucide-react';
import { canAccessClinical, canAccessAffiliations, type Role } from '@/lib/permissions';
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
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

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
        {/* Quick Stats — lead_instructor+ only */}
        {effectiveRole && canAccessClinical(effectiveRole) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activePreceptors}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Preceptors</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Hospital className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalClinicalSites}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Clinical Sites</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Ambulance className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalInternshipAgencies}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Field Agencies</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inPhase1 + stats.inPhase2}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">In Internship</div>
              </div>
            </div>
          </div>
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
                <SecondaryCard
                  href="/clinical/compliance"
                  icon={FileCheck}
                  title="Compliance Docs"
                  description="Immunizations, clearances"
                />
                <SecondaryCard
                  href="/clinical/compliance-tracker"
                  icon={Shield}
                  title="Compliance Tracker"
                  description="Per-student status overview"
                />
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
            {effectiveRole && canAccessAffiliations(effectiveRole) && (
              <SecondaryCard
                href="/clinical/affiliations"
                icon={ScrollText}
                title="Affiliations"
                description="Site agreements & expirations"
              />
            )}
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

type Accent = 'teal' | 'purple' | 'blue' | 'cyan';

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
