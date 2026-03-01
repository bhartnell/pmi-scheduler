'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  X,
  Home,
  ChevronRight,
  Calendar,
  Clock,
  Download,
  Save,
  Trash2,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

// ─── Types ─────────────────────────────────────────────────────────────────

interface InstructorOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface OverlapWindow {
  date: string;
  day_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface IndividualAvailability {
  name: string;
  email: string;
  slots: Array<{
    date: string;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
  }>;
}

interface SavedView {
  id: string;
  name: string;
  instructor_emails: string[];
  created_by: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Color palette for per-instructor display (index-based)
const INSTRUCTOR_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700', dot: 'bg-orange-500' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-500' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700', dot: 'bg-teal-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500' },
];

function getInstructorColor(index: number) {
  return INSTRUCTOR_COLORS[index % INSTRUCTOR_COLORS.length];
}

// ─── Export helpers ─────────────────────────────────────────────────────────

function buildCsvContent(overlaps: OverlapWindow[], selectedInstructors: InstructorOption[]): string {
  const names = selectedInstructors.map(i => i.name).join(', ');
  const header = `Team Availability Export\nInstructors: ${names}\n\nDate,Day,Start Time,End Time,Duration\n`;
  const rows = overlaps.map(o =>
    `"${o.date}","${o.day_name}","${formatTime(o.start_time)}","${formatTime(o.end_time)}","${formatDuration(o.duration_minutes)}"`
  ).join('\n');
  return header + rows;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TeamAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Instructor data
  const [allInstructors, setAllInstructors] = useState<InstructorOption[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Date range
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeksOut);

  // Results
  const [overlaps, setOverlaps] = useState<OverlapWindow[]>([]);
  const [individual, setIndividual] = useState<IndividualAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // Page loading
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchInstructors();
      fetchSavedViews();
    }
  }, [session]);

  const fetchInstructors = async () => {
    try {
      // Fetch instructors and above — all roles that post availability
      const res = await fetch('/api/admin/users?activeOnly=true&limit=100');
      const data = await res.json();
      if (data.success) {
        // Filter to instructor-level roles
        const instructorRoles = ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'];
        const instructors = (data.users || []).filter(
          (u: InstructorOption) => instructorRoles.includes(u.role)
        );
        setAllInstructors(instructors);
      }
    } catch (err) {
      console.error('Error fetching instructors:', err);
    } finally {
      setPageLoading(false);
    }
  };

  const fetchSavedViews = async () => {
    try {
      const res = await fetch('/api/scheduling/team-availability/saved');
      const data = await res.json();
      if (data.success) {
        setSavedViews(data.views || []);
      }
    } catch (err) {
      console.error('Error fetching saved views:', err);
    }
  };

  const handleSearch = useCallback(async () => {
    if (selectedEmails.size < 2) {
      setError('Please select at least 2 instructors.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select a date range.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date.');
      return;
    }

    setError(null);
    setLoading(true);
    setSearched(false);

    try {
      const params = new URLSearchParams({
        emails: Array.from(selectedEmails).join(','),
        start_date: startDate,
        end_date: endDate,
      });

      const res = await fetch(`/api/scheduling/team-availability?${params}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch availability');
        return;
      }

      setOverlaps(data.overlaps || []);
      setIndividual(data.individual || []);
      setSearched(true);
    } catch (err) {
      console.error('Error fetching team availability:', err);
      setError('Failed to fetch team availability. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedEmails, startDate, endDate]);

  const toggleInstructor = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
    // Clear results when selection changes
    setSearched(false);
    setOverlaps([]);
    setIndividual([]);
  };

  const handleLoadView = (view: SavedView) => {
    setSelectedEmails(new Set(view.instructor_emails));
    setSearched(false);
    setOverlaps([]);
    setIndividual([]);
  };

  const handleDeleteView = async (viewId: string) => {
    if (!confirm('Delete this saved view?')) return;
    try {
      const res = await fetch(`/api/scheduling/team-availability/saved?id=${viewId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSavedViews(prev => prev.filter(v => v.id !== viewId));
      }
    } catch (err) {
      console.error('Error deleting view:', err);
    }
  };

  const handleSaveView = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scheduling/team-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          instructor_emails: Array.from(selectedEmails),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedViews(prev => [data.view, ...prev]);
        setShowSaveModal(false);
        setSaveName('');
      } else {
        alert(data.error || 'Failed to save view');
      }
    } catch (err) {
      console.error('Error saving view:', err);
      alert('Failed to save view');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const selectedInstructors = allInstructors.filter(i => selectedEmails.has(i.email));
    const csv = buildCsvContent(overlaps, selectedInstructors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-availability-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredInstructors = allInstructors.filter(
    i =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedInstructors = allInstructors.filter(i => selectedEmails.has(i.email));

  if (status === 'loading' || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Team Availability</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session?.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">Scheduling</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">Team Availability</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Availability</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left Panel: Instructor Selector + Date Range ── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Saved Views */}
            {savedViews.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saved Views</h2>
                </div>
                <div className="space-y-2">
                  {savedViews.map(view => (
                    <div key={view.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <button
                        onClick={() => handleLoadView(view)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{view.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{view.instructor_emails.length} instructors</div>
                      </button>
                      <button
                        onClick={() => handleDeleteView(view.id)}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Delete saved view"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructor Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Instructors</h2>
                {selectedEmails.size > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">
                    {selectedEmails.size} selected
                  </span>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search instructors..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Selected chips */}
              {selectedEmails.size > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedInstructors.map((inst, idx) => {
                    const color = getInstructorColor(idx);
                    return (
                      <span
                        key={inst.email}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}
                      >
                        {inst.name.split(' ')[0]}
                        <button
                          onClick={() => toggleInstructor(inst.email)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Instructor list */}
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {filteredInstructors.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">No instructors found</p>
                ) : (
                  filteredInstructors.map(inst => {
                    const isSelected = selectedEmails.has(inst.email);
                    const colorIdx = selectedInstructors.findIndex(s => s.email === inst.email);
                    const color = colorIdx >= 0 ? getInstructorColor(colorIdx) : null;

                    return (
                      <button
                        key={inst.id}
                        onClick={() => toggleInstructor(inst.email)}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{inst.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{inst.email}</div>
                        </div>
                        {isSelected && color && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date Range
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setSearched(false); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); setSearched(false); }}
                    min={startDate}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick range buttons */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {[
                  { label: '1 Week', days: 7 },
                  { label: '2 Weeks', days: 14 },
                  { label: '1 Month', days: 30 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setStartDate(today);
                      setEndDate(end);
                      setSearched(false);
                    }}
                    className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Find Overlaps Button */}
            <button
              onClick={handleSearch}
              disabled={loading || selectedEmails.size < 2}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Finding Overlaps...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Find Overlapping Availability
                </>
              )}
            </button>

            {selectedEmails.size < 2 && (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Select at least 2 instructors to find overlaps
              </p>
            )}
          </div>

          {/* ── Right Panel: Results ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Error state */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Pre-search state */}
            {!searched && !loading && !error && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Find Team Availability</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Select two or more instructors and a date range, then click &ldquo;Find Overlapping Availability&rdquo; to see when everyone is free.
                </p>
              </div>
            )}

            {/* Results */}
            {searched && (
              <>
                {/* Overlap Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Overlapping Windows
                      </h2>
                      <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        overlaps.length > 0
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {overlaps.length} {overlaps.length === 1 ? 'window' : 'windows'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {overlaps.length > 0 && (
                        <>
                          <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export CSV
                          </button>
                          <button
                            onClick={() => setShowSaveModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save View
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {overlaps.length === 0 ? (
                    <div className="p-8 text-center">
                      <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No overlapping availability found</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        The selected instructors don&apos;t share any open time in this date range.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-gray-700">
                      {overlaps.map((window, idx) => (
                        <div key={idx} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                                {window.day_name}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{formatTime(window.start_time)} - {formatTime(window.end_time)}</span>
                                <span className="text-gray-400 dark:text-gray-500">
                                  ({formatDuration(window.duration_minutes)})
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Link
                                href={`/scheduling/shifts/new?date=${window.date}&start_time=${window.start_time}&end_time=${window.end_time}`}
                                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                              >
                                Create Lab Day
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Availability Grid */}
                {individual.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="px-5 py-4 border-b dark:border-gray-700">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        Individual Availability
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Each instructor&apos;s available times in the selected range
                      </p>
                    </div>

                    {/* Color legend */}
                    <div className="px-5 pt-3 pb-1 flex flex-wrap gap-3">
                      {individual.map((inst, idx) => {
                        const color = getInstructorColor(idx);
                        return (
                          <div key={inst.email} className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{inst.name}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">All Available (Overlap)</span>
                      </div>
                    </div>

                    {/* Date rows */}
                    <div className="px-5 py-3 space-y-3">
                      {(() => {
                        // Collect all dates that appear in any individual slot
                        const allDates = new Set<string>();
                        individual.forEach(inst => inst.slots.forEach(s => allDates.add(s.date)));
                        const sortedDates = Array.from(allDates).sort();

                        return sortedDates.map(date => {
                          const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric'
                          });
                          const dayOverlaps = overlaps.filter(o => o.date === date);

                          return (
                            <div key={date} className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50">
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{dayName}</span>
                                {dayOverlaps.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                                    {dayOverlaps.length} overlap{dayOverlaps.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="px-3 py-2 space-y-1.5">
                                {individual.map((inst, idx) => {
                                  const color = getInstructorColor(idx);
                                  const daySlots = inst.slots.filter(s => s.date === date);

                                  return (
                                    <div key={inst.email} className="flex items-start gap-2">
                                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color.dot}`} />
                                      <span className="text-xs text-gray-600 dark:text-gray-400 w-24 truncate flex-shrink-0">{inst.name.split(' ')[0]}</span>
                                      {daySlots.length === 0 ? (
                                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">No availability</span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {daySlots.map((slot, si) => (
                                            <span
                                              key={si}
                                              className={`text-xs px-2 py-0.5 rounded border ${color.bg} ${color.text} ${color.border}`}
                                            >
                                              {slot.is_all_day ? 'All day' : `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Overlap highlight */}
                                {dayOverlaps.length > 0 && (
                                  <div className="flex items-start gap-2 mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                                    <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-green-500" />
                                    <span className="text-xs text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Overlap</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {dayOverlaps.map((ow, oi) => (
                                        <span
                                          key={oi}
                                          className="text-xs px-2 py-0.5 rounded border bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 font-medium"
                                        >
                                          {formatTime(ow.start_time)} - {formatTime(ow.end_time)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Save View Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Save Team View</h2>
              <button
                onClick={() => { setShowSaveModal(false); setSaveName(''); }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  View Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveView(); }}
                  placeholder="e.g. Core Instructors, Weekend Team..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Instructors in this view:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedInstructors.map((inst, idx) => {
                    const color = getInstructorColor(idx);
                    return (
                      <span
                        key={inst.email}
                        className={`text-xs px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}
                      >
                        {inst.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => { setShowSaveModal(false); setSaveName(''); }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveView}
                disabled={saving || !saveName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
