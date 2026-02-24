'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Filter,
  ChevronRight,
  Home,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import {
  type OpenShift,
  type ShiftSignup,
  DEPARTMENT_COLORS,
  SIGNUP_STATUS_COLORS,
  SIGNUP_STATUS_LABELS,
  formatTime,
  formatTimeRange,
  formatShiftDate,
  formatFullDate,
  isShiftFull,
  getAvailableSpots,
  type CurrentUser
} from '@/types';

function ShiftsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userIsDirector, setUserIsDirector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<OpenShift[]>([]);

  // Filter state
  const [filterMine, setFilterMine] = useState(searchParams.get('filter') === 'mine');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [includeFilled, setIncludeFilled] = useState(false);

  // Sign-up modal state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<OpenShift | null>(null);
  const [signupForm, setSignupForm] = useState({
    isPartial: false,
    start_time: '',
    end_time: '',
    notes: ''
  });
  const [signingUp, setSigningUp] = useState(false);

  // Shift detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailShift, setDetailShift] = useState<OpenShift | null>(null);

  // Edit shift modal state (directors only)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShift, setEditingShift] = useState<OpenShift | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    department: '',
    max_instructors: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);

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

  useEffect(() => {
    if (currentUser) {
      fetchShifts();
    }
  }, [currentUser, filterMine, filterDepartment, includeFilled]);

  // Auto-open shift detail modal when shiftId query param is present
  useEffect(() => {
    const shiftId = searchParams.get('shiftId');
    if (shiftId && shifts.length > 0) {
      const shift = shifts.find(s => s.id === shiftId);
      if (shift) {
        setDetailShift(shift);
        setShowDetailModal(true);
      }
    }
  }, [shifts, searchParams]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        const isAdmin = data.user.role === 'admin' || data.user.role === 'superadmin';
        setUserIsDirector(isAdmin);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const fetchShifts = async () => {
    try {
      // Get shifts from today onwards
      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        start_date: today,
        include_filled: includeFilled.toString()
      });
      if (filterDepartment) params.set('department', filterDepartment);

      const res = await fetch(`/api/scheduling/shifts?${params}`);
      const data = await res.json();
      if (data.success) {
        let filteredShifts = data.shifts || [];

        // Filter to user's shifts if requested
        if (filterMine) {
          filteredShifts = filteredShifts.filter((s: OpenShift) =>
            s.user_signup && s.user_signup.status === 'confirmed'
          );
        }

        setShifts(filteredShifts);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const handleSignUpClick = (shift: OpenShift) => {
    setSelectedShift(shift);
    setSignupForm({
      isPartial: false,
      start_time: shift.start_time,
      end_time: shift.end_time,
      notes: ''
    });
    setShowSignupModal(true);
  };

  const handleSignUp = async () => {
    if (!selectedShift) return;

    setSigningUp(true);
    try {
      const res = await fetch(`/api/scheduling/shifts/${selectedShift.id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: signupForm.isPartial ? signupForm.start_time : undefined,
          end_time: signupForm.isPartial ? signupForm.end_time : undefined,
          notes: signupForm.notes || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowSignupModal(false);
        fetchShifts();
      } else {
        alert(data.error || 'Failed to sign up');
      }
    } catch (error) {
      console.error('Error signing up:', error);
      alert('Failed to sign up');
    }
    setSigningUp(false);
  };

  const handleWithdraw = async (shiftId: string) => {
    if (!confirm('Are you sure you want to withdraw from this shift?')) return;

    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}/signup`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchShifts();
        if (showDetailModal) setShowDetailModal(false);
      } else {
        alert(data.error || 'Failed to withdraw');
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Failed to withdraw');
    }
  };

  const handleViewDetails = (shift: OpenShift) => {
    setDetailShift(shift);
    setShowDetailModal(true);
  };

  const handleEditClick = (shift: OpenShift) => {
    setEditingShift(shift);
    setEditForm({
      title: shift.title,
      description: shift.description || '',
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      location: shift.location || '',
      department: shift.department || '',
      max_instructors: shift.max_instructors?.toString() || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingShift) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/scheduling/shifts/${editingShift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          date: editForm.date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          location: editForm.location || null,
          department: editForm.department || null,
          max_instructors: editForm.max_instructors ? parseInt(editForm.max_instructors) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        setEditingShift(null);
        fetchShifts();
      } else {
        alert(data.error || 'Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving shift:', error);
      alert('Failed to save changes');
    }
    setSavingEdit(false);
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift? This will remove all signups and cannot be undone.')) {
      return;
    }

    setDeletingShift(true);
    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        setShowDetailModal(false);
        setEditingShift(null);
        fetchShifts();
      } else {
        alert(data.error || 'Failed to delete shift');
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('Failed to delete shift');
    }
    setDeletingShift(false);
  };

  const getShiftStatusColor = (shift: OpenShift) => {
    if (shift.user_signup) {
      if (shift.user_signup.status === 'confirmed') return 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/10';
      if (shift.user_signup.status === 'pending') return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
    }
    if (isShiftFull(shift)) return 'border-l-gray-400 bg-gray-50 dark:bg-gray-900/30';
    return 'border-l-blue-500';
  };

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
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">{filterMine ? 'My Shifts' : 'Open Shifts'}</span>
          </div>

          {/* Title and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {filterMine ? 'My Shifts' : 'Open Shifts'}
              </h1>
            </div>
            {userIsDirector && (
              <Link
                href="/scheduling/shifts/new"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Shift
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Tab toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterMine(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !filterMine
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Open Shifts
              </button>
              <button
                onClick={() => setFilterMine(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterMine
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                My Shifts
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">All Departments</option>
                <option value="EMT">EMT</option>
                <option value="AEMT">AEMT</option>
                <option value="Paramedic">Paramedic</option>
                <option value="General">General</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={includeFilled}
                  onChange={(e) => setIncludeFilled(e.target.checked)}
                  className="rounded"
                />
                Show filled
              </label>
            </div>
          </div>
        </div>

        {/* Shifts List */}
        {shifts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {filterMine ? 'You have no confirmed shifts' : 'No open shifts available'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {shifts.map((shift) => {
              const isFull = isShiftFull(shift);
              const hasSignedUp = !!shift.user_signup;
              const isConfirmed = shift.user_signup?.status === 'confirmed';
              const isPending = shift.user_signup?.status === 'pending';
              const deptColor = shift.department ? DEPARTMENT_COLORS[shift.department] : null;

              return (
                <div
                  key={shift.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border-l-4 ${getShiftStatusColor(shift)}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {shift.title}
                          </h3>
                          {shift.department && deptColor && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${deptColor.bg} ${deptColor.text}`}>
                              {shift.department}
                            </span>
                          )}
                          {hasSignedUp && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${SIGNUP_STATUS_COLORS[shift.user_signup!.status].bg} ${SIGNUP_STATUS_COLORS[shift.user_signup!.status].text}`}>
                              {SIGNUP_STATUS_LABELS[shift.user_signup!.status]}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatShiftDate(shift.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTimeRange(shift.start_time, shift.end_time)}
                          </span>
                          {shift.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {shift.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {shift.confirmed_count || 0}/{shift.max_instructors || '∞'} filled
                          </span>
                        </div>

                        {shift.description && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {shift.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Director actions: Edit/Delete */}
                        {userIsDirector && (
                          <>
                            <button
                              onClick={() => handleEditClick(shift)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Edit shift"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete shift"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleViewDetails(shift)}
                          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Details
                        </button>

                        {!hasSignedUp && !isFull && (
                          <button
                            onClick={() => handleSignUpClick(shift)}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Sign Up
                          </button>
                        )}

                        {hasSignedUp && !isConfirmed && (
                          <button
                            onClick={() => handleWithdraw(shift.id)}
                            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            Withdraw
                          </button>
                        )}

                        {isFull && !hasSignedUp && (
                          <span className="px-3 py-2 text-sm text-gray-500">Full</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-500 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-yellow-500 rounded"></div>
            <span>Pending Confirmation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-purple-500 rounded"></div>
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-gray-400 rounded"></div>
            <span>Full</span>
          </div>
        </div>
      </main>

      {/* Sign Up Modal */}
      {showSignupModal && selectedShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign Up for Shift</h2>
            </div>

            <div className="p-4">
              {/* Shift info */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white">{selectedShift.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatFullDate(selectedShift.date)} • {formatTimeRange(selectedShift.start_time, selectedShift.end_time)}
                </p>
                {selectedShift.location && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Location: {selectedShift.location}
                  </p>
                )}
              </div>

              {/* Full vs Partial */}
              <div className="space-y-3 mb-4">
                <label className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="shiftType"
                    checked={!signupForm.isPartial}
                    onChange={() => setSignupForm({ ...signupForm, isPartial: false })}
                    className="text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Full shift</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTimeRange(selectedShift.start_time, selectedShift.end_time)}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="shiftType"
                    checked={signupForm.isPartial}
                    onChange={() => setSignupForm({
                      ...signupForm,
                      isPartial: true,
                      start_time: selectedShift.start_time,
                      end_time: selectedShift.end_time
                    })}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">Partial shift</div>
                    {signupForm.isPartial && (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="time"
                          value={signupForm.start_time}
                          onChange={(e) => setSignupForm({ ...signupForm, start_time: e.target.value })}
                          className="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="time"
                          value={signupForm.end_time}
                          onChange={(e) => setSignupForm({ ...signupForm, end_time: e.target.value })}
                          className="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={signupForm.notes}
                  onChange={(e) => setSignupForm({ ...signupForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Any notes for the director..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowSignupModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignUp}
                disabled={signingUp}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {signingUp ? 'Signing up...' : 'Submit Sign Up'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Detail Modal */}
      {showDetailModal && detailShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shift Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {detailShift.title}
              </h3>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatFullDate(detailShift.date)}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {formatTimeRange(detailShift.start_time, detailShift.end_time)}
                </p>
                {detailShift.location && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {detailShift.location}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {detailShift.confirmed_count || 0} confirmed / {detailShift.max_instructors || '∞'} max
                </p>
              </div>

              {detailShift.description && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Description</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detailShift.description}</p>
                </div>
              )}

              {/* Signups */}
              {detailShift.signups && detailShift.signups.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Signed Up</h4>
                  <div className="space-y-2">
                    {detailShift.signups.map((signup: ShiftSignup) => (
                      <div
                        key={signup.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {signup.instructor?.name}
                          </span>
                          {signup.is_partial && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({formatTime(signup.signup_start_time!)} - {formatTime(signup.signup_end_time!)})
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${SIGNUP_STATUS_COLORS[signup.status].bg} ${SIGNUP_STATUS_COLORS[signup.status].text}`}>
                          {SIGNUP_STATUS_LABELS[signup.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User's signup status */}
              {detailShift.user_signup && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Your status: <strong>{SIGNUP_STATUS_LABELS[detailShift.user_signup.status]}</strong>
                    {detailShift.user_signup.is_partial && (
                      <span className="ml-2">
                        ({formatTime(detailShift.user_signup.signup_start_time!)} - {formatTime(detailShift.user_signup.signup_end_time!)})
                      </span>
                    )}
                  </p>
                  {detailShift.user_signup.status !== 'confirmed' && (
                    <button
                      onClick={() => handleWithdraw(detailShift.id)}
                      className="mt-2 text-sm text-red-600 hover:text-red-700"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
              {!detailShift.user_signup && !isShiftFull(detailShift) && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleSignUpClick(detailShift);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift Modal (Directors only) */}
      {showEditModal && editingShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Shift</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Department
                  </label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="EMT">EMT</option>
                    <option value="AEMT">AEMT</option>
                    <option value="Paramedic">Paramedic</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Room 101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Instructors
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.max_instructors}
                    onChange={(e) => setEditForm({ ...editForm, max_instructors: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
              <button
                onClick={() => handleDeleteShift(editingShift.id)}
                disabled={deletingShift}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingShift ? 'Deleting...' : 'Delete Shift'}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editForm.title || !editForm.date || !editForm.start_time || !editForm.end_time}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShiftsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ShiftsPageContent />
    </Suspense>
  );
}
