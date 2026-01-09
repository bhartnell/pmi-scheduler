'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen,
  Users,
  Calendar,
  ClipboardList,
  Settings,
  TrendingUp,
  Plus,
  ChevronRight
} from 'lucide-react';
import LabHeader from '@/components/LabHeader';

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalScenarios: number;
  upcomingLabs: number;
}

export default function LabManagementDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeStudents: 0,
    totalScenarios: 0,
    upcomingLabs: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchStats();
    }
  }, [session]);

  const fetchStats = async () => {
    try {
      // Fetch students count
      const studentsRes = await fetch('/api/lab-management/students?status=active');
      const studentsData = await studentsRes.json();
      
      // Fetch scenarios count
      const scenariosRes = await fetch('/api/lab-management/scenarios');
      const scenariosData = await scenariosRes.json();
      
      // Fetch upcoming labs
      const today = new Date().toISOString().split('T')[0];
      const labsRes = await fetch(`/api/lab-management/lab-days?startDate=${today}`);
      const labsData = await labsRes.json();

      setStats({
        totalStudents: studentsData.students?.length || 0,
        activeStudents: studentsData.students?.filter((s: any) => s.status === 'active').length || 0,
        totalScenarios: scenariosData.scenarios?.length || 0,
        upcomingLabs: labsData.labDays?.length || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    setLoading(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const quickLinks = [
    { href: '/lab-management/scenarios', icon: BookOpen, label: 'Scenarios', color: 'bg-purple-500' },
    { href: '/lab-management/students', icon: Users, label: 'Students', color: 'bg-green-500' },
    { href: '/lab-management/schedule', icon: Calendar, label: 'Schedule', color: 'bg-blue-500' },
    { href: '/lab-management/reports', icon: TrendingUp, label: 'Reports', color: 'bg-orange-500' },
    { href: '/lab-management/admin', icon: Settings, label: 'Admin', color: 'bg-gray-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <LabHeader 
        title="Lab Management Dashboard"
        actions={
          <Link
            href="/lab-management/schedule/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Lab Day
          </Link>
        }
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.activeStudents}
                </div>
                <div className="text-sm text-gray-600">Active Students</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.totalScenarios}
                </div>
                <div className="text-sm text-gray-600">Scenarios</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.upcomingLabs}
                </div>
                <div className="text-sm text-gray-600">Upcoming Labs</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ClipboardList className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.totalStudents}
                </div>
                <div className="text-sm text-gray-600">Total Students</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex flex-col items-center text-center"
            >
              <div className={`p-3 rounded-full ${link.color} mb-3`}>
                <link.icon className="w-6 h-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">{link.label}</span>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/lab-management/students/new"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex items-center gap-3"
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Add Student</div>
              <div className="text-sm text-gray-600">Register a new student</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          
          <Link
            href="/lab-management/scenarios/new"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex items-center gap-3"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <Plus className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Create Scenario</div>
              <div className="text-sm text-gray-600">Add training scenario</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          
          <Link
            href="/lab-management/admin/cohorts"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex items-center gap-3"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Manage Cohorts</div>
              <div className="text-sm text-gray-600">Add or edit cohorts</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </main>
    </div>
  );
}
