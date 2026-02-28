'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
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
} from 'lucide-react';
import {
  canAccessAdmin,
  isSuperadmin,
  getRoleLabel,
  getRoleBadgeClasses,
} from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import type { CurrentUser } from '@/types';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);

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

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  const adminLinks = [
    {
      href: '/admin/users',
      icon: Shield,
      title: 'User Management',
      description: 'Manage users, approve accounts, and assign roles',
      color: 'bg-indigo-500'
    },
    {
      href: '/admin/guests',
      icon: UserPlus,
      title: 'Guest Access',
      description: 'Create and manage guest access for external instructors',
      color: 'bg-teal-500'
    },
    {
      href: '/admin/deletion-requests',
      icon: Trash2,
      title: 'Deletion Requests',
      description: 'Review and approve deletion requests from instructors',
      color: 'bg-red-500'
    },
    {
      href: '/admin/certifications',
      icon: Award,
      title: 'Certifications Import',
      description: 'Bulk import instructor certifications from CSV and monitor expiration dates',
      color: 'bg-purple-500'
    },
    {
      href: '/admin/email-templates',
      icon: Mail,
      title: 'Email Templates',
      description: 'Customize notification email templates sent by the system',
      color: 'bg-blue-500'
    },
    {
      href: '/admin/scheduled-exports',
      icon: Download,
      title: 'Scheduled Exports',
      description: 'Configure automatic weekly or monthly report exports by email',
      color: 'bg-emerald-500'
    },
    {
      href: '/admin/program-requirements',
      icon: ClipboardList,
      title: 'Program Requirements',
      description: 'Configure required clinical hours, skills, and scenarios per program',
      color: 'bg-orange-500'
    },
    {
      href: '/admin/announcements',
      icon: Megaphone,
      title: 'Announcements',
      description: 'Post system-wide announcements for instructors and students',
      color: 'bg-sky-500'
    },
    {
      href: '/admin/broadcast',
      icon: Megaphone,
      title: 'Broadcast Notifications',
      description: 'Send targeted in-app or email notifications to users, roles, cohorts, or individuals',
      color: 'bg-indigo-600',
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
      href: '/admin/dashboard-defaults',
      icon: Layout,
      title: 'Dashboard Defaults',
      description: 'Configure which widgets appear by default on the dashboard for each role',
      color: 'bg-indigo-500',
    },
    {
      href: '/admin/equipment',
      icon: Package,
      title: 'Equipment Inventory',
      description: 'Track lab equipment, availability, conditions, and check-out/check-in flow',
      color: 'bg-cyan-600',
    },
    {
      href: '/admin/certifications/compliance',
      icon: BadgeCheck,
      title: 'Certification Compliance',
      description: 'View compliance status for all instructor certifications and identify gaps',
      color: 'bg-green-600',
    },
    {
      href: '/admin/lab-templates',
      icon: BookOpen,
      title: 'Lab Template Library',
      description: 'Create and manage reusable lab day templates organized by program, semester, and week',
      color: 'bg-blue-700',
    },
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
    {
      href: '/admin/data-export',
      icon: Download,
      title: 'Data Export',
      description: 'Export cohort, student, lab, clinical, and assessment data as CSV or JSON',
      color: 'bg-emerald-600',
    },
    {
      href: '/admin/qa-checklist',
      icon: ClipboardCheck,
      title: 'QA Checklist',
      description: 'Comprehensive quality assurance checklist for testing all major features across roles',
      color: 'bg-blue-600',
    },
  ];

  const superadminLinks = [
    {
      href: '/admin/system-health',
      icon: Database,
      title: 'System Health',
      description: 'Database metrics, row counts, activity and scheduled job status',
      color: 'bg-blue-600'
    },
    {
      href: '/admin/audit-log',
      icon: FileText,
      title: 'FERPA Audit Log',
      description: 'View access logs for protected educational records',
      color: 'bg-purple-600'
    },
    {
      href: '/admin/roles',
      icon: Key,
      title: 'Role Permissions',
      description: 'View role hierarchy and permission matrix',
      color: 'bg-amber-500'
    },
    {
      href: '/admin/settings',
      icon: Database,
      title: 'System Settings',
      description: 'Configure system-wide settings and preferences',
      color: 'bg-gray-700'
    },
    {
      href: '/admin/database-tools',
      icon: Wrench,
      title: 'Database Cleanup Utilities',
      description: 'Clear old audit logs, notifications, orphaned records, and view database statistics',
      color: 'bg-rose-700'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
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

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Role Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h2 className="font-semibold text-blue-900 dark:text-blue-100">Admin Access</h2>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You are logged in as <strong>{currentUser.name}</strong> with{' '}
                <strong>{getRoleLabel(currentUser.role)}</strong> privileges.
                {isSuperadmin(currentUser.role) && ' You have full system access.'}
              </p>
            </div>
          </div>
        </div>

        {/* Admin Links */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Administration</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-5 flex items-start gap-4"
              >
                <div className={`p-3 rounded-lg ${link.color}`}>
                  <link.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{link.title}</h3>
                    {'badge' in link && link.badge !== undefined && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                        {link.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-1" />
              </Link>
            ))}
          </div>
        </div>

        {/* Superadmin Only Links */}
        {isSuperadmin(currentUser.role) && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Superadmin Only
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {superadminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-5 flex items-start gap-4 border-2 border-purple-200 dark:border-purple-800"
                >
                  <div className={`p-3 rounded-lg ${link.color}`}>
                    <link.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{link.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-1" />
                </Link>
              ))}
            </div>
          </div>
        )}

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
