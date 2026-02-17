'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Search
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import type { CurrentUserMinimal } from '@/types';

interface CertificationStatus {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  certifications: {
    name: string;
    status: 'current' | 'expiring' | 'expired' | 'missing';
    expiresAt: string | null;
  }[];
}

export default function CertificationCompliancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [certStatuses, setCertStatuses] = useState<CertificationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'issues' | 'expiring'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
        fetchCertificationStatuses();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchCertificationStatuses = async () => {
    try {
      const res = await fetch('/api/admin/certification-compliance');
      const data = await res.json();
      if (data.success) {
        setCertStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error fetching certification statuses:', error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'expiring': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'expired': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'missing': return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current': return <CheckCircle className="w-4 h-4" />;
      case 'expiring': return <Clock className="w-4 h-4" />;
      case 'expired': return <AlertTriangle className="w-4 h-4" />;
      default: return null;
    }
  };

  const filteredStatuses = certStatuses.filter(user => {
    const matchesSearch = user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'issues') {
      return user.certifications.some(c => c.status === 'expired' || c.status === 'missing');
    }
    if (filter === 'expiring') {
      return user.certifications.some(c => c.status === 'expiring');
    }
    return true;
  });

  const issueCount = certStatuses.filter(u =>
    u.certifications.some(c => c.status === 'expired' || c.status === 'missing')
  ).length;

  const expiringCount = certStatuses.filter(u =>
    u.certifications.some(c => c.status === 'expiring')
  ).length;

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
            <span>Certification Compliance</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Certification Compliance</h1>
              <p className="text-gray-600 dark:text-gray-400">Monitor instructor certification status</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500 dark:text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{certStatuses.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Instructors</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{issueCount}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">With Issues</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{expiringCount}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Expiring Soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search instructors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('issues')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'issues' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Issues ({issueCount})
              </button>
              <button
                onClick={() => setFilter('expiring')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'expiring' ? 'bg-yellow-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Expiring ({expiringCount})
              </button>
            </div>
          </div>
        </div>

        {/* Instructor List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Instructor Certification Status ({filteredStatuses.length})
            </h2>
          </div>
          {filteredStatuses.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Award className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              {searchTerm || filter !== 'all' ? 'No matching instructors found' : 'No certification data available'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStatuses.map(user => (
                <div key={user.userId} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{user.userName}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{user.userEmail}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                        {user.userRole}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {user.certifications.map(cert => (
                        <div
                          key={cert.name}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(cert.status)}`}
                        >
                          {getStatusIcon(cert.status)}
                          <span>{cert.name}</span>
                          {cert.expiresAt && cert.status !== 'missing' && (
                            <span className="opacity-75">
                              {new Date(cert.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
