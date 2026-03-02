'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Settings,
  FileText,
  Search,
  Wand2,
  ArrowLeft,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';

export default function ScenariosHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            if (!canAccessAdmin(data.user.role)) {
              router.push('/');
              return;
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session, router]);

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session) return null;

  const tools = [
    {
      href: '/lab-management/scenarios',
      icon: FileText,
      title: 'Manage Scenarios',
      description: 'View, create, edit, and delete simulation scenarios. This is the main scenario library used by instructors for lab days.',
      color: 'bg-blue-600',
      badge: null,
    },
    {
      href: '/admin/scenarios/audit',
      icon: Search,
      title: 'Scenario Audit Tool',
      description: 'Analyze scenario data structure and quality. Identifies missing fields, old-format data, incomplete vitals, and data integrity issues across all scenarios.',
      color: 'bg-amber-600',
      badge: null,
    },
    {
      href: '/admin/scenarios/transform',
      icon: Wand2,
      title: 'Scenario Transform Tool',
      description: 'Bulk-convert old-format scenarios to the new phase-based structure. Backs up original data before transforming vitals arrays into phases and fixing critical actions.',
      color: 'bg-purple-600',
      badge: null,
    },
  ];

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
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Scenarios</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scenario Management</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage, audit, and transform simulation scenarios</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Overview */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Use these tools to manage your scenario library. The <strong>Manage Scenarios</strong> page is where instructors create and edit scenarios.
            The <strong>Audit Tool</strong> checks data quality and identifies issues. The <strong>Transform Tool</strong> converts old-format scenarios to the new phase-based structure.
          </p>
        </div>

        {/* Tool Cards */}
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all p-6 flex flex-col gap-4 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700"
              >
                <div className={`p-3 rounded-lg ${tool.color} w-fit`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">{tool.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{tool.description}</p>
                </div>
                <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-auto">
                  Open tool
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
