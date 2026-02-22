'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Shield,
  Check,
  X,
  Crown,
  UserCog,
  Users,
  GraduationCap,
  Eye
} from 'lucide-react';
import { canAccessAdmin, PROTECTED_SUPERADMINS } from '@/lib/permissions';
import type { CurrentUserMinimal, Role } from '@/types';

const ROLE_DEFINITIONS = [
  {
    role: 'superadmin' as Role,
    label: 'Super Admin',
    level: 5,
    icon: Crown,
    color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    description: 'Full system access with protected status',
    permissions: [
      'All permissions below',
      'Delete any user',
      'Manage system settings',
      'Assign superadmin role',
      'Cannot be deleted or demoted by others'
    ]
  },
  {
    role: 'admin' as Role,
    label: 'Admin',
    level: 4,
    icon: UserCog,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    description: 'Administrative access for managing users and content',
    permissions: [
      'All permissions below',
      'Approve/deny deletion requests',
      'View certification compliance',
      'Manage users (except superadmins)',
      'Manage guest access',
      'Assign admin role and below'
    ]
  },
  {
    role: 'lead_instructor' as Role,
    label: 'Lead Instructor',
    level: 3,
    icon: GraduationCap,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    description: 'Senior instructor with content management abilities',
    permissions: [
      'All permissions below',
      'Create/edit/delete scenarios',
      'Manage lab schedules',
      'Assign instructors to stations',
      'Manage cohorts and students'
    ]
  },
  {
    role: 'instructor' as Role,
    label: 'Instructor',
    level: 2,
    icon: Users,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    description: 'Standard instructor access',
    permissions: [
      'View lab schedules',
      'View scenarios',
      'Track personal certifications',
      'Log CE hours',
      'View assigned stations',
      'Request deletions (requires approval)'
    ]
  },
  {
    role: 'volunteer_instructor' as Role,
    label: 'Volunteer Instructor',
    level: 1.5,
    icon: Users,
    color: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30',
    description: 'Limited volunteer/guest instructor access',
    permissions: [
      'View lab schedules (read-only)',
      'View part-timer shift schedules',
      'Input availability for shifts',
      'View own assignments',
      'No access to student data',
      'No access to grading or clinical data'
    ]
  },
  {
    role: 'guest' as Role,
    label: 'Guest',
    level: 1,
    icon: Eye,
    color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
    description: 'Temporary view-only access',
    permissions: [
      'View assigned lab day only',
      'View station assignments',
      'No editing capabilities',
      'Access via name or code'
    ]
  }
];

const PERMISSION_MATRIX = [
  { permission: 'View own profile', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: true, guest: false },
  { permission: 'Track certifications', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: false, guest: false },
  { permission: 'Log CE hours', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: false, guest: false },
  { permission: 'View lab schedules', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: true, guest: true },
  { permission: 'Access scheduling/shifts', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: true, guest: false },
  { permission: 'View scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: false, guest: false },
  { permission: 'View student data', superadmin: true, admin: true, lead_instructor: true, instructor: true, volunteer_instructor: false, guest: false },
  { permission: 'Create scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Edit scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Delete scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Manage lab days', superadmin: true, admin: true, lead_instructor: true, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Manage students', superadmin: true, admin: true, lead_instructor: true, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Manage cohorts', superadmin: true, admin: true, lead_instructor: true, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Access admin panel', superadmin: true, admin: true, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Manage users', superadmin: true, admin: true, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Manage guest access', superadmin: true, admin: true, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Review deletion requests', superadmin: true, admin: true, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'View certification compliance', superadmin: true, admin: true, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Manage system settings', superadmin: true, admin: false, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
  { permission: 'Delete users', superadmin: true, admin: false, lead_instructor: false, instructor: false, volunteer_instructor: false, guest: false },
];

export default function RolesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
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
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Role Permissions</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Permissions</h1>
              <p className="text-gray-600 dark:text-gray-400">Reference guide for role capabilities</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Protected Accounts Notice */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <Shield className="w-5 h-5" />
            <span className="font-medium">Protected Superadmin Accounts</span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
            The following accounts have protected superadmin status and cannot be modified or deleted:
          </p>
          <div className="mt-2 flex gap-2">
            {PROTECTED_SUPERADMINS.map(email => (
              <span key={email} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 text-sm rounded">
                {email}
              </span>
            ))}
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLE_DEFINITIONS.map(role => {
            const Icon = role.icon;
            return (
              <div key={role.role} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${role.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{role.label}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Level {role.level}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{role.description}</p>
                <ul className="space-y-1">
                  {role.permissions.map((perm, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Permission Matrix */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Permission Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Permission</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-red-700 dark:text-red-400">Super Admin</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-orange-700 dark:text-orange-400">Admin</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-blue-700 dark:text-blue-400">Lead</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-green-700 dark:text-green-400">Instructor</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-teal-700 dark:text-teal-400">Volunteer</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-400">Guest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {PERMISSION_MATRIX.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/50'}>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{row.permission}</td>
                    <td className="px-3 py-2 text-center">
                      {row.superadmin ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.admin ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.lead_instructor ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.instructor ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.volunteer_instructor ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.guest ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
