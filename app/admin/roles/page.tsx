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
import { canAccessAdmin, PROTECTED_SUPERADMINS, type Role } from '@/lib/permissions';

interface CurrentUser {
  id: string;
  role: Role;
}

const ROLE_DEFINITIONS = [
  {
    role: 'superadmin' as Role,
    label: 'Super Admin',
    level: 5,
    icon: Crown,
    color: 'text-red-600 bg-red-100',
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
    color: 'text-orange-600 bg-orange-100',
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
    color: 'text-blue-600 bg-blue-100',
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
    color: 'text-green-600 bg-green-100',
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
    role: 'guest' as Role,
    label: 'Guest',
    level: 1,
    icon: Eye,
    color: 'text-gray-600 bg-gray-100',
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
  { permission: 'View own profile', superadmin: true, admin: true, lead_instructor: true, instructor: true, guest: false },
  { permission: 'Track certifications', superadmin: true, admin: true, lead_instructor: true, instructor: true, guest: false },
  { permission: 'Log CE hours', superadmin: true, admin: true, lead_instructor: true, instructor: true, guest: false },
  { permission: 'View lab schedules', superadmin: true, admin: true, lead_instructor: true, instructor: true, guest: true },
  { permission: 'View scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: true, guest: false },
  { permission: 'Create scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: false, guest: false },
  { permission: 'Edit scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: false, guest: false },
  { permission: 'Delete scenarios', superadmin: true, admin: true, lead_instructor: true, instructor: false, guest: false },
  { permission: 'Manage lab days', superadmin: true, admin: true, lead_instructor: true, instructor: false, guest: false },
  { permission: 'Manage students', superadmin: true, admin: true, lead_instructor: true, instructor: false, guest: false },
  { permission: 'Manage cohorts', superadmin: true, admin: true, lead_instructor: true, instructor: false, guest: false },
  { permission: 'Access admin panel', superadmin: true, admin: true, lead_instructor: false, instructor: false, guest: false },
  { permission: 'Manage users', superadmin: true, admin: true, lead_instructor: false, instructor: false, guest: false },
  { permission: 'Manage guest access', superadmin: true, admin: true, lead_instructor: false, instructor: false, guest: false },
  { permission: 'Review deletion requests', superadmin: true, admin: true, lead_instructor: false, instructor: false, guest: false },
  { permission: 'View certification compliance', superadmin: true, admin: true, lead_instructor: false, instructor: false, guest: false },
  { permission: 'Manage system settings', superadmin: true, admin: false, lead_instructor: false, instructor: false, guest: false },
  { permission: 'Delete users', superadmin: true, admin: false, lead_instructor: false, instructor: false, guest: false },
];

export default function RolesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Role Permissions</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Role Permissions</h1>
              <p className="text-gray-600">Reference guide for role capabilities</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Protected Accounts Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Shield className="w-5 h-5" />
            <span className="font-medium">Protected Superadmin Accounts</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            The following accounts have protected superadmin status and cannot be modified or deleted:
          </p>
          <div className="mt-2 flex gap-2">
            {PROTECTED_SUPERADMINS.map(email => (
              <span key={email} className="px-2 py-1 bg-amber-100 text-amber-800 text-sm rounded">
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
              <div key={role.role} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${role.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{role.label}</h3>
                    <span className="text-xs text-gray-500">Level {role.level}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                <ul className="space-y-1">
                  {role.permissions.map((perm, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">Permission Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Permission</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-red-700">Super Admin</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-orange-700">Admin</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-blue-700">Lead</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-green-700">Instructor</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-gray-700">Guest</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {PERMISSION_MATRIX.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.permission}</td>
                    <td className="px-3 py-2 text-center">
                      {row.superadmin ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.admin ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.lead_instructor ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.instructor ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.guest ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 mx-auto" />
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
