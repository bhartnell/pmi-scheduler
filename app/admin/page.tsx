'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Users,
  Settings,
  Home,
  Shield,
  Trash2,
  Award,
  UserPlus,
  Key,
  Database,
  AlertCircle,
  FileText,
  Mail,
  Download,
  ClipboardList,
  Megaphone,
  UserCheck,
  Layout,
  Package,
  BadgeCheck,
  BookOpen,
  Activity,
  Bell,
  Wrench,
  ClipboardCheck,
  CalendarDays,
  Star,
  Clock,
  AlertTriangle,
  GraduationCap,
  Webhook,
  Search,
  X,
  Wand2,
  Upload,
  ShieldCheck,
  Layers,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  canAccessAdmin,
  isSuperadmin,
  getRoleLabel,
  getRoleBadgeClasses,
} from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import type { CurrentUser } from '@/types';

const STORAGE_KEY = 'pmi_admin_sections_expanded';

interface AdminLink {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  badge?: number;
}

interface AdminSection {
  id: string;
  title: string;
  icon: LucideIcon;
  defaultExpanded: boolean;
  superadminOnly?: boolean;
  links: AdminLink[];
}

function buildSections(pendingAccessRequests: number): AdminSection[] {
  return [
    {
      id: 'users-access',
      title: 'Users & Access',
      icon: Users,
      defaultExpanded: true,
      links: [
        {
          href: '/admin/users',
          icon: Shield,
          title: 'User Management',
          description: 'Manage users, approve accounts, and assign roles',
          color: 'bg-indigo-500',
        },
        {
          href: '/admin/guests',
          icon: UserPlus,
          title: 'Guest Access',
          description: 'Create and manage guest access for external instructors',
          color: 'bg-teal-500',
        },
        {
          href: '/admin/access-requests',
          icon: UserCheck,
          title: 'Access Requests',
          description: 'Review and approve volunteer instructor self-service signup requests',
          color: 'bg-violet-500',
          badge: pendingAccessRequests > 0 ? pendingAccessRequests : undefined,
        },
        {
          href: '/admin/deletion-requests',
          icon: Trash2,
          title: 'Deletion Requests',
          description: 'Review and approve deletion requests from instructors',
          color: 'bg-red-500',
        },
      ],
    },
    {
      id: 'scenarios',
      title: 'Scenarios',
      icon: FileText,
      defaultExpanded: false,
      links: [
        {
          href: '/admin/scenarios',
          icon: FileText,
          title: 'Scenario Hub',
          description: 'Overview of scenario management, audit, and transform tools',
          color: 'bg-blue-600',
        },
        {
          href: '/lab-management/scenarios',
          icon: Layers,
          title: 'Manage Scenarios',
          description: 'View, create, edit, and delete simulation scenarios',
          color: 'bg-blue-500',
        },
        {
          href: '/admin/scenarios/audit',
          icon: Search,
          title: 'Scenario Audit',
          description: 'Analyze scenario data structure, find missing fields and quality issues',
          color: 'bg-amber-600',
        },
        {
          href: '/admin/scenarios/transform',
          icon: Wand2,
          title: 'Scenario Transform',
          description: 'Bulk-convert old-format scenarios to the new phase-based structure',
          color: 'bg-purple-600',
        },
      ],
    },
    {
      id: 'content-templates',
      title: 'Content & Templates',
      icon: BookOpen,
      defaultExpanded: true,
      links: [
        {
          href: '/admin/lab-templates',
          icon: BookOpen,
          title: 'Lab Template Library',
          description: 'Create and manage reusable lab day templates organized by program, semester, and week',
          color: 'bg-blue-700',
        },
        {
          href: '/admin/lab-templates/import',
          icon: Upload,
          title: 'Import Templates',
          description: 'Import lab templates from JSON files with seed data for quick setup',
          color: 'bg-blue-600',
        },
        {
          href: '/admin/rubrics',
          icon: Star,
          title: 'Assessment Rubrics',
          description: 'Build and manage scenario grading rubrics with criteria and rating scales',
          color: 'bg-violet-600',
        },
        {
          href: '/admin/email-templates',
          icon: Mail,
          title: 'Email Templates',
          description: 'Customize notification email templates sent by the system',
          color: 'bg-blue-500',
        },
        {
          href: '/admin/program-requirements',
          icon: ClipboardList,
          title: 'Program Requirements',
          description: 'Configure required clinical hours, skills, and scenarios per program',
          color: 'bg-orange-500',
        },
        {
          href: '/admin/dashboard-defaults',
          icon: Layout,
          title: 'Dashboard Defaults',
          description: 'Configure which widgets appear by default on the dashboard for each role',
          color: 'bg-indigo-500',
        },
      ],
    },
    {
      id: 'lab-clinical',
      title: 'Lab & Clinical',
      icon: ClipboardCheck,
      defaultExpanded: false,
      links: [
        {
          href: '/admin/equipment',
          icon: Package,
          title: 'Equipment Inventory',
          description: 'Track lab equipment, availability, conditions, and check-out/check-in flow',
          color: 'bg-cyan-600',
        },
        {
          href: '/admin/time-clock',
          icon: Clock,
          title: 'Instructor Time Clock',
          description: 'Review, approve, and export instructor time entries for payroll',
          color: 'bg-blue-600',
        },
        {
          href: '/admin/attendance-appeals',
          icon: CalendarDays,
          title: 'Attendance Appeals',
          description: 'Review and action student attendance absence appeal requests',
          color: 'bg-amber-600',
        },
        {
          href: '/admin/equipment/maintenance',
          icon: Wrench,
          title: 'Equipment Maintenance',
          description: 'Schedule and track equipment maintenance, repairs, and calibration records',
          color: 'bg-slate-600',
        },
        {
          href: '/admin/incidents',
          icon: AlertTriangle,
          title: 'Incident Reports',
          description: 'Log and track safety incidents in lab and clinical settings for OSHA compliance',
          color: 'bg-red-600',
        },
      ],
    },
    {
      id: 'data-management',
      title: 'Data Management',
      icon: Database,
      defaultExpanded: false,
      links: [
        {
          href: '/admin/certifications',
          icon: Award,
          title: 'Certifications Import',
          description: 'Bulk import instructor certifications from CSV and monitor expiration dates',
          color: 'bg-purple-500',
        },
        {
          href: '/admin/certifications/compliance',
          icon: BadgeCheck,
          title: 'Certification Compliance',
          description: 'View compliance status for all instructor certifications and identify gaps',
          color: 'bg-green-600',
        },
        {
          href: '/admin/data-export',
          icon: Download,
          title: 'Data Export',
          description: 'Export cohort, student, lab, clinical, and assessment data as CSV or JSON',
          color: 'bg-emerald-600',
        },
        {
          href: '/admin/scheduled-exports',
          icon: Download,
          title: 'Scheduled Exports',
          description: 'Configure automatic weekly or monthly report exports by email',
          color: 'bg-emerald-500',
        },
        {
          href: '/admin/certifications/verification',
          icon: ShieldCheck,
          title: 'Certification Verification',
          description: 'Verify and review individual instructor certification credentials',
          color: 'bg-teal-600',
        },
        {
          href: '/admin/bulk-operations',
          icon: Layers,
          title: 'Bulk Operations',
          description: 'Execute bulk data operations with rollback support',
          color: 'bg-slate-600',
        },
      ],
    },
    {
      id: 'communication',
      title: 'Communication',
      icon: Megaphone,
      defaultExpanded: false,
      links: [
        {
          href: '/admin/announcements',
          icon: Megaphone,
          title: 'Announcements',
          description: 'Post system-wide announcements for instructors and students',
          color: 'bg-sky-500',
        },
        {
          href: '/admin/broadcast',
          icon: Bell,
          title: 'Broadcast Notifications',
          description: 'Send targeted in-app or email notifications to users, roles, cohorts, or individuals',
          color: 'bg-indigo-600',
        },
      ],
    },
    {
      id: 'student-management',
      title: 'Student Management',
      icon: GraduationCap,
      defaultExpanded: false,
      links: [
        {
          href: '/admin/alumni',
          icon: GraduationCap,
          title: 'Alumni Tracking',
          description: 'Track graduates: employment status, contact info, and continuing education',
          color: 'bg-blue-700',
        },
        {
          href: '/admin/qa-checklist',
          icon: ClipboardCheck,
          title: 'QA Checklist',
          description: 'Comprehensive quality assurance checklist for testing all major features across roles',
          color: 'bg-blue-600',
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: BarChart3,
      defaultExpanded: false,
      links: [
        {
          href: '/lab-management/reports',
          icon: BarChart3,
          title: 'Reports Hub',
          description: 'All lab, clinical, instructor, and student reports in one place',
          color: 'bg-indigo-600',
        },
        {
          href: '/reports/closeout-surveys',
          icon: ClipboardCheck,
          title: 'Closeout Surveys',
          description: 'View and analyze clinical internship closeout survey results',
          color: 'bg-teal-600',
        },
        {
          href: '/reports/builder',
          icon: Wrench,
          title: 'Custom Report Builder',
          description: 'Build custom reports with flexible queries and saved templates',
          color: 'bg-violet-600',
        },
        {
          href: '/reports/program-outcomes',
          icon: GraduationCap,
          title: 'Program Outcomes',
          description: 'Track program-level outcomes, pass rates, and accreditation metrics',
          color: 'bg-green-600',
        },
      ],
    },
    {
      id: 'monitoring',
      title: 'Monitoring & Activity',
      icon: Activity,
      defaultExpanded: false,
      links: [
        {
          href: '/admin/user-activity',
          icon: Activity,
          title: 'User Activity',
          description: 'View page views, active users, top pages, and usage patterns across the system',
          color: 'bg-teal-600',
        },
        {
          href: '/admin/system-alerts',
          icon: Bell,
          title: 'System Alerts',
          description: 'Monitor system health alerts for storage, errors, cron jobs, and performance',
          color: 'bg-rose-600',
        },
      ],
    },
    {
      id: 'system',
      title: 'System',
      icon: Settings,
      defaultExpanded: false,
      superadminOnly: true,
      links: [
        {
          href: '/admin/system-health',
          icon: Database,
          title: 'System Health',
          description: 'Database metrics, row counts, activity and scheduled job status',
          color: 'bg-blue-600',
        },
        {
          href: '/admin/audit-log',
          icon: FileText,
          title: 'FERPA Audit Log',
          description: 'View access logs for protected educational records',
          color: 'bg-purple-600',
        },
        {
          href: '/admin/roles',
          icon: Key,
          title: 'Role Permissions',
          description: 'View role hierarchy and permission matrix',
          color: 'bg-amber-500',
        },
        {
          href: '/admin/settings',
          icon: Database,
          title: 'System Settings',
          description: 'Configure system-wide settings and preferences',
          color: 'bg-gray-700',
        },
        {
          href: '/admin/config',
          icon: Settings,
          title: 'System Configuration',
          description: 'Centralized config panel: email, notifications, security, features, branding, and legal',
          color: 'bg-blue-800',
        },
        {
          href: '/admin/database-tools',
          icon: Wrench,
          title: 'Database Cleanup Utilities',
          description: 'Clear old audit logs, notifications, orphaned records, and view database statistics',
          color: 'bg-rose-700',
        },
        {
          href: '/admin/webhooks',
          icon: Webhook,
          title: 'Integration Webhooks',
          description: 'Configure outbound webhooks to notify external systems of events in real time',
          color: 'bg-indigo-700',
        },
        {
          href: '/admin/deep-links',
          icon: Key,
          title: 'Deep Links',
          description: 'Generate and manage deep links for direct access to specific pages and resources',
          color: 'bg-gray-600',
        },
      ],
    },
  ];
}

interface CollapsibleSectionProps {
  section: AdminSection;
  isExpanded: boolean;
  onToggle: () => void;
  filterQuery: string;
}

function CollapsibleSection({ section, isExpanded, onToggle, filterQuery }: CollapsibleSectionProps) {
  const SectionIcon = section.icon;

  const visibleLinks = useMemo(() => {
    if (!filterQuery.trim()) return section.links;
    const q = filterQuery.toLowerCase();
    return section.links.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q),
    );
  }, [section.links, filterQuery]);

  // When filtering, always show matching links regardless of expanded state
  const showLinks = filterQuery.trim() ? visibleLinks.length > 0 : isExpanded;

  if (filterQuery.trim() && visibleLinks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
        aria-expanded={showLinks}
      >
        <div className="flex items-center gap-3">
          <SectionIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-white">{section.title}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({filterQuery.trim() ? visibleLinks.length : section.links.length})
          </span>
          {section.superadminOnly && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
              Superadmin
            </span>
          )}
        </div>
        {showLinks ? (
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        )}
      </button>

      {/* Links Grid */}
      {showLinks && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-4">
            {(filterQuery.trim() ? visibleLinks : section.links).map((link) => {
              const LinkIcon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors p-4 flex items-start gap-3"
                >
                  <div className={`p-2.5 rounded-lg ${link.color} flex-shrink-0`}>
                    <LinkIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{link.title}</h3>
                      {link.badge !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white flex-shrink-0">
                          {link.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{link.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  // Load persisted expanded state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setExpandedSections(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

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
        // Fetch pending access request count in the background
        fetch('/api/access-requests?status=pending')
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              setPendingAccessRequests(d.requests?.length || 0);
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const sections = useMemo(
    () => buildSections(pendingAccessRequests),
    [pendingAccessRequests],
  );

  const isSuperAdmin = currentUser ? isSuperadmin(currentUser.role) : false;

  const visibleSections = useMemo(
    () => sections.filter((s) => !s.superadminOnly || isSuperAdmin),
    [sections, isSuperAdmin],
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = { ...prev, [sectionId]: !getSectionExpanded(sectionId, prev) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const getSectionExpanded = (sectionId: string, state: Record<string, boolean>) => {
    if (sectionId in state) return state[sectionId];
    const section = sections.find((s) => s.id === sectionId);
    return section?.defaultExpanded ?? false;
  };

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Admin</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
                <p className="text-gray-600 dark:text-gray-400">System administration and user management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeClasses(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Role Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h2 className="font-semibold text-blue-900 dark:text-blue-100">Admin Access</h2>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You are logged in as <strong>{currentUser.name}</strong> with{' '}
                <strong>{getRoleLabel(currentUser.role)}</strong> privileges.
                {isSuperAdmin && ' You have full system access.'}
              </p>
            </div>
          </div>
        </div>

        {/* Search Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search admin tools..."
            className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-3">
          {visibleSections.map((section) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              isExpanded={getSectionExpanded(section.id, expandedSections)}
              onToggle={() => toggleSection(section.id)}
              filterQuery={filterQuery}
            />
          ))}
        </div>

        {/* Quick Links back to other areas */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Related Areas</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/lab-management/admin/cohorts"
              className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Manage Cohorts
            </Link>
            <Link
              href="/lab-management/students"
              className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Student Roster
            </Link>
            <Link
              href="/lab-management/scenarios"
              className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Scenarios
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
