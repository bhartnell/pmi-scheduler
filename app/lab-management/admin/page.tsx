'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  Users,
  GraduationCap,
  UserCog,
  Settings,
  Database,
  Shield
} from 'lucide-react';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const adminSections = [
    {
      title: 'Cohort Management',
      description: 'Create and manage EMT, AEMT, and Paramedic cohorts',
      href: '/lab-management/admin/cohorts',
      icon: GraduationCap,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'User Management',
      description: 'Manage instructors and admin access',
      href: '/lab-management/admin/users',
      icon: UserCog,
      color: 'bg-green-100 text-green-600',
      coming: true,
    },
    {
      title: 'Student Management',
      description: 'Bulk operations, transfers, and status updates',
      href: '/lab-management/students',
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Data Management',
      description: 'Export data, backup, and maintenance',
      href: '/lab-management/admin/data',
      icon: Database,
      color: 'bg-orange-100 text-orange-600',
      coming: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
              <p className="text-gray-600">System settings and management</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Admin Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.coming ? '#' : section.href}
              className={`bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow ${section.coming ? 'opacity-60 cursor-not-allowed' : ''}`}
              onClick={section.coming ? (e) => e.preventDefault() : undefined}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${section.color}`}>
                  <section.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{section.title}</h2>
                    {section.coming && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Logged in as</div>
              <div className="font-medium text-gray-900">{session.user?.email}</div>
            </div>
            <div>
              <div className="text-gray-500">Role</div>
              <div className="font-medium text-gray-900">Administrator</div>
            </div>
            <div>
              <div className="text-gray-500">Version</div>
              <div className="font-medium text-gray-900">1.0.0</div>
            </div>
            <div>
              <div className="text-gray-500">Environment</div>
              <div className="font-medium text-gray-900">Production</div>
            </div>
          </div>
        </div>

        {/* Access Note */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Admin Access</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This area contains administrative functions. Changes made here affect all users of the system.
                Please use caution when modifying settings.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
