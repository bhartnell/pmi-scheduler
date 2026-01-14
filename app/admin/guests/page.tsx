'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  UserPlus,
  Calendar,
  Key,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Clock
} from 'lucide-react';
import { canManageGuestAccess, type Role } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';

interface GuestAccess {
  id: string;
  name: string;
  email: string | null;
  access_code: string | null;
  lab_day_id: string | null;
  assigned_role: string | null;
  expires_at: string | null;
  created_at: string;
  lab_day?: {
    id: string;
    date: string;
    cohort?: {
      cohort_number: number;
      program?: {
        abbreviation: string;
      };
    };
  };
}

interface LabDay {
  id: string;
  date: string;
  cohort?: {
    cohort_number: number;
    program?: {
      abbreviation: string;
    };
  };
}

interface CurrentUser {
  id: string;
  role: Role;
}

export default function GuestAccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [guests, setGuests] = useState<GuestAccess[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    lab_day_id: '',
    assigned_role: 'Observer',
    expires_at: ''
  });

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
        if (!canManageGuestAccess(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        fetchGuests();
        fetchLabDays();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchGuests = async () => {
    try {
      const res = await fetch('/api/admin/guests');
      const data = await res.json();
      if (data.success) {
        setGuests(data.guests || []);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
    }
    setLoading(false);
  };

  const fetchLabDays = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/lab-management/lab-days?startDate=${today}`);
      const data = await res.json();
      if (data.success) {
        setLabDays(data.labDays || []);
      }
    } catch (error) {
      console.error('Error fetching lab days:', error);
    }
  };

  const generateAccessCode = (name: string) => {
    const namePart = name.split(' ')[0].substring(0, 4).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${namePart}-${randomPart}`;
  };

  const handleCreateGuest = async () => {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    try {
      const accessCode = generateAccessCode(formData.name);
      const res = await fetch('/api/admin/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          access_code: accessCode,
          lab_day_id: formData.lab_day_id || null,
          expires_at: formData.expires_at || null
        })
      });

      const data = await res.json();
      if (data.success) {
        setGuests([data.guest, ...guests]);
        setShowModal(false);
        setFormData({ name: '', email: '', lab_day_id: '', assigned_role: 'Observer', expires_at: '' });
        showToast(`Guest access created! Code: ${accessCode}`, 'success');
      } else {
        showToast(data.error || 'Failed to create guest', 'error');
      }
    } catch (error) {
      console.error('Error creating guest:', error);
      showToast('Failed to create guest', 'error');
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (!confirm('Are you sure you want to delete this guest access?')) return;

    try {
      const res = await fetch(`/api/admin/guests?id=${guestId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        setGuests(guests.filter(g => g.id !== guestId));
        showToast('Guest access deleted', 'success');
      } else {
        showToast(data.error || 'Failed to delete guest', 'error');
      }
    } catch (error) {
      console.error('Error deleting guest:', error);
      showToast('Failed to delete guest', 'error');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Separate active and expired guests
  const activeGuests = guests.filter(g => !isExpired(g.expires_at));
  const expiredGuests = guests.filter(g => isExpired(g.expires_at));

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Guest Access</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <UserPlus className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guest Access</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage guest access for external instructors</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <UserPlus className="w-5 h-5" />
                Create Guest Access
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Guest Access Codes</p>
              <p>Guests can use their name or access code to view their assigned lab day schedule at <strong>/guest</strong>. They have view-only access.</p>
            </div>
          </div>
        </div>

        {/* Active Guests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Active Guests ({activeGuests.length})</h2>
          </div>
          {activeGuests.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No active guest access entries
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lab Day</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Access Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeGuests.map(guest => (
                  <tr key={guest.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{guest.name}</div>
                        {guest.email && <div className="text-sm text-gray-500 dark:text-gray-400">{guest.email}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {guest.lab_day ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(guest.lab_day.date).toLocaleDateString()}
                          {guest.lab_day.cohort && (
                            <span className="text-gray-500 dark:text-gray-400">
                              ({guest.lab_day.cohort.program?.abbreviation} {guest.lab_day.cohort.cohort_number})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {guest.access_code && (
                        <button
                          onClick={() => copyToClipboard(guest.access_code!)}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          <Key className="w-3 h-3" />
                          {guest.access_code}
                          {copiedCode === guest.access_code ? (
                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {guest.assigned_role || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {guest.expires_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {new Date(guest.expires_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteGuest(guest.id)}
                        className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Expired Guests */}
        {expiredGuests.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow opacity-75">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300">Expired ({expiredGuests.length})</h2>
            </div>
            <div className="p-4 space-y-2">
              {expiredGuests.map(guest => (
                <div key={guest.id} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">{guest.name}</span>
                    <span className="text-sm text-gray-400 dark:text-gray-500 ml-2">
                      Expired {new Date(guest.expires_at!).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteGuest(guest.id)}
                    className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Guest Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Guest Access</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Guest name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="guest@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to Lab Day
                </label>
                <select
                  value={formData.lab_day_id}
                  onChange={(e) => setFormData({ ...formData, lab_day_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select lab day...</option>
                  {labDays.map(ld => (
                    <option key={ld.id} value={ld.id}>
                      {new Date(ld.date).toLocaleDateString()} - {ld.cohort?.program?.abbreviation} {ld.cohort?.cohort_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role for the Day
                </label>
                <select
                  value={formData.assigned_role}
                  onChange={(e) => setFormData({ ...formData, assigned_role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Observer">Observer</option>
                  <option value="Assistant Instructor">Assistant Instructor</option>
                  <option value="Evaluator">Evaluator</option>
                  <option value="Preceptor">Preceptor</option>
                  <option value="Student Teacher">Student Teacher</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expires On
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank for no expiration</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGuest}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Create Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
