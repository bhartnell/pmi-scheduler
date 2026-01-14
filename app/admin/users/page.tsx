'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Users,
  Shield,
  Clock,
  CheckCircle,
  Home,
  Search,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import {
  canAccessAdmin,
  canModifyUser,
  getAssignableRoles,
  isProtectedSuperadmin,
  isSuperadmin,
  getRoleLabel,
  getRoleBadgeClasses,
  ROLE_LEVELS,
  type Role
} from '@/lib/permissions';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  last_login: string | null;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const TABS = [
  { value: 'all', label: 'All Users' },
  { value: 'pending', label: 'Pending' },
  { value: 'instructor', label: 'Instructors' },
  { value: 'lead_instructor', label: 'Lead Instructors' },
  { value: 'admin', label: 'Admins' },
  { value: 'guest', label: 'Guests' }
];

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
        fetchUsers();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/lab-management/users?activeOnly=false');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, targetUser: User, newRole: string) => {
    if (!currentUser) return;

    // Check if user can modify this target
    if (!canModifyUser(currentUser.role, targetUser.role)) {
      showToast('You cannot modify users at or above your role level', 'error');
      return;
    }

    // Protect superadmin accounts
    if (isProtectedSuperadmin(targetUser.email) && newRole !== 'superadmin') {
      showToast('This superadmin account is protected and cannot be demoted', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      });

      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? data.user : u));
        showToast(`Role updated to ${getRoleLabel(newRole as Role)}`, 'success');
      } else {
        showToast(data.error || 'Failed to update role', 'error');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showToast('Failed to update role', 'error');
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, is_active: !currentlyActive })
      });

      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? data.user : u));
        showToast(`User ${!currentlyActive ? 'activated' : 'deactivated'}`, 'success');
      } else {
        showToast(data.error || 'Failed to update user', 'error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Failed to update user', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter users based on tab and search
  const filteredUsers = users.filter(user => {
    // Tab filter
    if (activeTab !== 'all') {
      // Special handling for pending - users with role 'pending' OR not approved
      if (activeTab === 'pending') {
        if (user.role !== 'instructor' && user.role !== 'lead_instructor' &&
            user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'guest') {
          return true;
        }
        return false;
      }
      if (user.role !== activeTab) return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return user.name.toLowerCase().includes(search) ||
             user.email.toLowerCase().includes(search);
    }

    return true;
  });

  // Count for pending badge (users without a proper role)
  const pendingCount = users.filter(u =>
    u.role !== 'instructor' && u.role !== 'lead_instructor' &&
    u.role !== 'admin' && u.role !== 'superadmin' && u.role !== 'guest'
  ).length;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  const assignableRoles = getAssignableRoles(currentUser.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

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
            <span>Users</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600">Manage users and assign roles</p>
              </div>
            </div>
            <Link
              href="/admin/guests"
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <UserPlus className="w-5 h-5" />
              Add Guest
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Role Legend */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Role Hierarchy</h3>
          <div className="flex flex-wrap gap-3">
            {(['superadmin', 'admin', 'lead_instructor', 'instructor', 'guest'] as Role[]).map(role => (
              <div key={role} className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeClasses(role)}`}>
                  {getRoleLabel(role)}
                </span>
                <span className="text-xs text-gray-500">Level {ROLE_LEVELS[role]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.value === 'pending' && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const canModify = canModifyUser(currentUser.role, user.role);
                  const isProtected = isProtectedSuperadmin(user.email);

                  return (
                    <tr key={user.id} className={`hover:bg-gray-50 ${!user.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {user.name}
                            {isProtected && (
                              <span title="Protected superadmin">
                                <Shield className="w-4 h-4 text-purple-600" />
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {canModify && !isProtected ? (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, user, e.target.value)}
                            className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getRoleBadgeClasses(user.role)}`}
                          >
                            {assignableRoles.map(role => (
                              <option key={role} value={role}>
                                {getRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeClasses(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-sm">
                            <Clock className="w-4 h-4" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-6 py-4">
                        {canModify && !isProtected && (
                          <button
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            className={`text-sm px-3 py-1 rounded ${
                              user.is_active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Role Assignment Rules:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>You can only assign roles at a lower level than your own</li>
                <li>Protected superadmin accounts (Ben & Josh) cannot be demoted</li>
                <li>Deactivated users cannot log in but their data is preserved</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
