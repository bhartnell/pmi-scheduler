'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Users,
  GraduationCap,
  Settings,
  UserCog,
  FolderKanban,
  Home,
  Shield,
  Trash2,
  Award
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

  const adminLinks = [
    {
      href: '/lab-management/admin/users',
      icon: Shield,
      title: 'Manage Users',
      description: 'Approve users and assign roles (admin, instructor, user)',
      color: 'bg-indigo-500'
    },
    {
      href: '/lab-management/admin/deletion-requests',
      icon: Trash2,
      title: 'Deletion Requests',
      description: 'Review and approve deletion requests from instructors',
      color: 'bg-red-500'
    },
    {
      href: '/lab-management/admin/certifications',
      icon: Award,
      title: 'Certifications',
      description: 'Monitor instructor certifications and expiration dates',
      color: 'bg-purple-500'
    },
    {
      href: '/lab-management/admin/cohorts',
      icon: GraduationCap,
      title: 'Manage Cohorts',
      description: 'Create and manage program cohorts (EMT Group 4, PM Group 14, etc.)',
      color: 'bg-blue-500'
    },
    {
      href: '/lab-management/admin/lab-groups',
      icon: Users,
      title: 'Lab Groups',
      description: 'Organize students into lab groups (Group A, B, C, D) for grading',
      color: 'bg-green-500'
    },
    {
      href: '/lab-management/students',
      icon: UserCog,
      title: 'Student Roster',
      description: 'View all students, add new students, import from CSV',
      color: 'bg-purple-500'
    },
    {
      href: '/lab-management/scenarios',
      icon: FolderKanban,
      title: 'Scenario Library',
      description: 'Create and manage training scenarios',
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
              <p className="text-gray-600">Manage cohorts, groups, and system settings</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Quick Setup Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">📋 Setup Order</h2>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. <strong>Create a Cohort</strong> (e.g., "Paramedic Group 14")</li>
            <li>2. <strong>Add Students</strong> to the cohort</li>
            <li>3. <strong>Create Lab Groups</strong> within the cohort (Group A, B, C, D)</li>
            <li>4. <strong>Assign Students</strong> to lab groups</li>
            <li>5. <strong>Create Scenarios</strong> for training</li>
            <li>6. <strong>Schedule Lab Days</strong> with stations and scenarios</li>
          </ol>
        </div>

        {/* Admin Links */}
        <div className="grid gap-4 md:grid-cols-2">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-5 flex items-start gap-4"
            >
              <div className={`p-3 rounded-lg ${link.color}`}>
                <link.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{link.title}</h3>
                <p className="text-sm text-gray-600">{link.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
