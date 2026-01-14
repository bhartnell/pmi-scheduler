'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Plus,
  FileText,
  Users,
  Home
} from 'lucide-react';

interface DashboardStats {
  total_certs: number;
  expired_certs: number;
  expiring_soon: number;
  next_expiration: string | null;
  ce_hours_this_year: number;
  classes_this_year: number;
  teaching_hours_this_year: number;
}

interface Certification {
  id: string;
  cert_name: string;
  issuing_body: string | null;
  expiration_date: string;
  card_image_url: string | null;
}

interface UpcomingLab {
  lab_day_id: string;
  lab_date: string;
  week_number: number | null;
  day_number: number | null;
  station_id: string;
  station_number: number;
  station_type: string;
  custom_title: string | null;
  scenario_title: string | null;
  cohort_number: number;
  program: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Parse date as local date
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get days until expiration
function getDaysUntil(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseLocalDate(dateString);
  return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Get status color based on days until expiration
function getExpirationStatus(dateString: string): { color: string; bg: string; label: string } {
  const days = getDaysUntil(dateString);

  if (days < 0) {
    return { color: 'text-red-600', bg: 'bg-red-100', label: 'Expired' };
  } else if (days <= 30) {
    return { color: 'text-orange-600', bg: 'bg-orange-100', label: `${days} days` };
  } else if (days <= 90) {
    return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: `${days} days` };
  } else {
    return { color: 'text-green-600', bg: 'bg-green-100', label: 'Valid' };
  }
}

export default function InstructorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [upcomingLabs, setUpcomingLabs] = useState<UpcomingLab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadDashboardData();
    }
  }, [session]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Get current user info
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success) {
        setCurrentUser(userData.user);

        // Load certifications
        const certsRes = await fetch(`/api/lab-management/certifications?instructorId=${userData.user.id}`);
        const certsData = await certsRes.json();
        if (certsData.success) {
          setCertifications(certsData.certifications || []);

          // Calculate stats from certifications
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const certs = certsData.certifications || [];
          const expired = certs.filter((c: Certification) => getDaysUntil(c.expiration_date) < 0);
          const expiringSoon = certs.filter((c: Certification) => {
            const days = getDaysUntil(c.expiration_date);
            return days >= 0 && days <= 30;
          });

          const validCerts = certs.filter((c: Certification) => getDaysUntil(c.expiration_date) >= 0);
          const nextExp = validCerts.length > 0
            ? validCerts.reduce((min: Certification, c: Certification) =>
                c.expiration_date < min.expiration_date ? c : min
              ).expiration_date
            : null;

          setStats({
            total_certs: certs.length,
            expired_certs: expired.length,
            expiring_soon: expiringSoon.length,
            next_expiration: nextExp,
            ce_hours_this_year: 0, // Will load from CE records
            classes_this_year: 0, // Will load from teaching log
            teaching_hours_this_year: 0
          });
        }

        // Load upcoming labs
        const labsRes = await fetch(`/api/instructor/upcoming-labs`);
        const labsData = await labsRes.json();
        if (labsData.success) {
          setUpcomingLabs(labsData.labs || []);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <Home className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Instructor Portal</h1>
                <p className="text-sm text-gray-600">
                  Welcome, {currentUser?.name || session.user?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/lab-management"
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Lab Management
              </Link>
              {currentUser?.role === 'admin' && (
                <Link
                  href="/lab-management/admin"
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Certs */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.total_certs || 0}</p>
                <p className="text-sm text-gray-600">Certifications</p>
              </div>
            </div>
          </div>

          {/* Expiring Soon */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats?.expiring_soon ? 'bg-orange-100' : 'bg-green-100'}`}>
                {stats?.expiring_soon ? (
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.expiring_soon || 0}</p>
                <p className="text-sm text-gray-600">Expiring Soon</p>
              </div>
            </div>
          </div>

          {/* CE Hours */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.ce_hours_this_year || 0}</p>
                <p className="text-sm text-gray-600">CE Hours (Year)</p>
              </div>
            </div>
          </div>

          {/* Teaching Hours */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.classes_this_year || 0}</p>
                <p className="text-sm text-gray-600">Classes (Year)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Certifications */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                My Certifications
              </h2>
              <Link
                href="/instructor/certifications"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-4">
              {certifications.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No certifications added yet</p>
                  <Link
                    href="/instructor/certifications/new"
                    className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" /> Add Certification
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {certifications.slice(0, 5).map((cert) => {
                    const status = getExpirationStatus(cert.expiration_date);
                    return (
                      <div
                        key={cert.id}
                        className={`p-3 rounded-lg border-l-4 ${status.bg} border-l-current`}
                        style={{ borderLeftColor: status.color.replace('text-', '').includes('red') ? '#dc2626' :
                          status.color.includes('orange') ? '#ea580c' :
                          status.color.includes('yellow') ? '#ca8a04' : '#16a34a' }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{cert.cert_name}</p>
                            <p className="text-sm text-gray-600">{cert.issuing_body || 'No issuer'}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-medium ${status.color}`}>
                              {status.label}
                            </span>
                            <p className="text-xs text-gray-500">
                              {parseLocalDate(cert.expiration_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {certifications.length > 5 && (
                    <p className="text-center text-sm text-gray-500">
                      +{certifications.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Labs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Upcoming Labs
              </h2>
              <Link
                href="/lab-management/schedule"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Schedule <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-4">
              {upcomingLabs.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming lab assignments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingLabs.slice(0, 5).map((lab) => (
                    <Link
                      key={`${lab.lab_day_id}-${lab.station_id}`}
                      href={`/lab-management/schedule/${lab.lab_day_id}`}
                      className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {lab.week_number ? `Week ${lab.week_number}` : ''}{lab.day_number ? ` Day ${lab.day_number}` : ''}{!lab.week_number && !lab.day_number ? 'Lab Day' : ''}
                          </p>
                          <p className="text-sm text-gray-600">
                            Station {lab.station_number}: {lab.custom_title || lab.scenario_title || 'TBD'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {lab.program} Cohort {lab.cohort_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(lab.lab_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/instructor/certifications/new"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition"
            >
              <Plus className="w-8 h-8 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Add Certification</span>
            </Link>
            <Link
              href="/instructor/ce"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition"
            >
              <BookOpen className="w-8 h-8 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">Log CE Hours</span>
            </Link>
            <Link
              href="/instructor/teaching"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-amber-50 hover:bg-amber-100 transition"
            >
              <FileText className="w-8 h-8 text-amber-600" />
              <span className="text-sm font-medium text-gray-900">Teaching Log</span>
            </Link>
            <Link
              href="/lab-management/scenarios"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-green-50 hover:bg-green-100 transition"
            >
              <Users className="w-8 h-8 text-green-600" />
              <span className="text-sm font-medium text-gray-900">View Scenarios</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
