'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Award,
  Home,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building,
  Hash,
  Download
} from 'lucide-react';

interface Certification {
  id: string;
  instructor_id: string;
  cert_name: string;
  cert_number: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string;
  card_image_url: string | null;
  ce_requirement_id: string | null;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface InstructorWithCerts extends Instructor {
  certifications: Certification[];
}

// Parse date string as local date (not UTC) to avoid timezone issues
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get status info based on days until expiration
function getStatus(expirationDate: string): { color: string; bgColor: string; label: string; priority: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseLocalDate(expirationDate);
  const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Expired', priority: 0 };
  } else if (daysUntil <= 30) {
    return { color: 'text-orange-600', bgColor: 'bg-orange-100', label: `${daysUntil}d`, priority: 1 };
  } else if (daysUntil <= 90) {
    return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: `${daysUntil}d`, priority: 2 };
  } else {
    return { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Valid', priority: 3 };
  }
}

// Get instructor's overall status (worst cert status)
function getInstructorStatus(certs: Certification[]): { color: string; icon: React.ReactNode; label: string } {
  if (certs.length === 0) {
    return { color: 'text-gray-400', icon: <Clock className="w-5 h-5" />, label: 'No certs' };
  }

  let worstPriority = 4;
  for (const cert of certs) {
    const status = getStatus(cert.expiration_date);
    if (status.priority < worstPriority) {
      worstPriority = status.priority;
    }
  }

  if (worstPriority === 0) {
    return { color: 'text-red-600', icon: <AlertTriangle className="w-5 h-5" />, label: 'Expired' };
  } else if (worstPriority <= 2) {
    return { color: 'text-yellow-600', icon: <Clock className="w-5 h-5" />, label: 'Expiring soon' };
  } else {
    return { color: 'text-green-600', icon: <CheckCircle className="w-5 h-5" />, label: 'All valid' };
  }
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'expired', label: 'Expired' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'valid', label: 'Valid' }
];

export default function AdminCertificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [instructors, setInstructors] = useState<InstructorWithCerts[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedInstructors, setExpandedInstructors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const usersRes = await fetch('/api/lab-management/users');
      const usersData = await usersRes.json();

      // Fetch all certifications
      const certsRes = await fetch('/api/lab-management/certifications');
      const certsData = await certsRes.json();

      if (usersData.success && certsData.success) {
        const users = usersData.users || [];
        const certs = certsData.certifications || [];

        // Combine users with their certs
        const instructorsWithCerts: InstructorWithCerts[] = users
          .filter((u: Instructor) => u.role === 'instructor' || u.role === 'admin')
          .map((user: Instructor) => ({
            ...user,
            certifications: certs
              .filter((c: Certification) => c.instructor_id === user.id)
              .sort((a: Certification, b: Certification) =>
                new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()
              )
          }));

        // Sort by status priority (expired first)
        instructorsWithCerts.sort((a, b) => {
          const aStatus = getInstructorStatus(a.certifications);
          const bStatus = getInstructorStatus(b.certifications);
          if (aStatus.label === 'Expired' && bStatus.label !== 'Expired') return -1;
          if (bStatus.label === 'Expired' && aStatus.label !== 'Expired') return 1;
          if (aStatus.label === 'Expiring soon' && bStatus.label === 'All valid') return -1;
          if (bStatus.label === 'Expiring soon' && aStatus.label === 'All valid') return 1;
          return 0;
        });

        setInstructors(instructorsWithCerts);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const toggleExpanded = (instructorId: string) => {
    const newExpanded = new Set(expandedInstructors);
    if (newExpanded.has(instructorId)) {
      newExpanded.delete(instructorId);
    } else {
      newExpanded.add(instructorId);
    }
    setExpandedInstructors(newExpanded);
  };

  // Filter instructors based on tab
  const filteredInstructors = instructors.filter(instructor => {
    if (activeTab === 'all') return true;
    const status = getInstructorStatus(instructor.certifications);
    if (activeTab === 'expired') return status.label === 'Expired';
    if (activeTab === 'expiring') return status.label === 'Expiring soon';
    if (activeTab === 'valid') return status.label === 'All valid' || status.label === 'No certs';
    return true;
  });

  // Count stats
  const expiredCount = instructors.filter(i => getInstructorStatus(i.certifications).label === 'Expired').length;
  const expiringCount = instructors.filter(i => getInstructorStatus(i.certifications).label === 'Expiring soon').length;

  // Download cert image
  const downloadImage = async (imageUrl: string, certName: string, instructorName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = imageUrl.split('.').pop() || 'jpg';
      a.download = `${instructorName.replace(/[^a-z0-9]/gi, '_')}_${certName.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading certifications...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin" className="hover:text-blue-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Certifications</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Instructor Certifications</h1>
              <p className="text-gray-600">Monitor all instructor certifications and expirations</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{instructors.length}</p>
                <p className="text-gray-600 text-sm">Instructors</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{expiredCount}</p>
                <p className="text-gray-600 text-sm">With Expired Certs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{expiringCount}</p>
                <p className="text-gray-600 text-sm">Expiring Within 90 Days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.value === 'expired' && expiredCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                  {expiredCount}
                </span>
              )}
              {tab.value === 'expiring' && expiringCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  {expiringCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Instructors List */}
        <div className="space-y-4">
          {filteredInstructors.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No instructors match the current filter.</p>
            </div>
          ) : (
            filteredInstructors.map(instructor => {
              const instructorStatus = getInstructorStatus(instructor.certifications);
              const isExpanded = expandedInstructors.has(instructor.id);

              return (
                <div key={instructor.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Instructor Header */}
                  <button
                    onClick={() => toggleExpanded(instructor.id)}
                    className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${instructorStatus.color === 'text-red-600' ? 'bg-red-100' : instructorStatus.color === 'text-yellow-600' ? 'bg-yellow-100' : instructorStatus.color === 'text-green-600' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {instructorStatus.icon}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{instructor.name}</h3>
                        <p className="text-sm text-gray-500">{instructor.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-sm font-medium ${instructorStatus.color}`}>
                          {instructorStatus.label}
                        </p>
                        <p className="text-sm text-gray-500">
                          {instructor.certifications.length} certification{instructor.certifications.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {/* Certifications List */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                      {instructor.certifications.length === 0 ? (
                        <p className="text-gray-500 text-sm py-2">No certifications on file.</p>
                      ) : (
                        <div className="space-y-2">
                          {instructor.certifications.map(cert => {
                            const certStatus = getStatus(cert.expiration_date);
                            return (
                              <div
                                key={cert.id}
                                className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">{cert.cert_name}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${certStatus.bgColor} ${certStatus.color}`}>
                                      {certStatus.label}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                                    {cert.issuing_body && (
                                      <span className="flex items-center gap-1">
                                        <Building className="w-3 h-3" />
                                        {cert.issuing_body}
                                      </span>
                                    )}
                                    {cert.cert_number && (
                                      <span className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        {cert.cert_number}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Exp: {parseLocalDate(cert.expiration_date).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                {cert.card_image_url && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadImage(cert.card_image_url!, cert.cert_name, instructor.name);
                                    }}
                                    className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium ml-4"
                                  >
                                    <Download className="w-4 h-4" />
                                    Card
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
