'use client';

/**
 * Station Pool Management Page
 *
 * Allows instructors and admins to manage the station pool
 * for student completion tracking (Semester 3 clinical prep).
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Filter,
  ChevronRight,
  CheckSquare,
  Edit2,
  Archive,
  X,
  Heart,
  AlertTriangle,
  Activity,
  Baby,
  Pill,
  Stethoscope,
  Users,
  BarChart3,
  Star
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';

interface Station {
  id: string;
  station_code: string;
  station_name: string;
  category: string;
  description: string | null;
  semester: number;
  is_active: boolean;
  display_order: number;
  cohort: {
    id: string;
    cohort_number: string;
    program: { abbreviation: string } | null;
  } | null;
  completion_stats?: {
    pass: number;
    needs_review: number;
    incomplete: number;
    total: number;
  };
}

interface Cohort {
  id: string;
  cohort_number: string;
  program: { id: string; name: string; abbreviation: string } | null;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const CATEGORIES = [
  { value: 'cardiology', label: 'Cardiology', icon: Heart },
  { value: 'trauma', label: 'Trauma', icon: AlertTriangle },
  { value: 'airway', label: 'Airway', icon: Activity },
  { value: 'pediatrics', label: 'Pediatrics', icon: Baby },
  { value: 'pharmacology', label: 'Pharmacology', icon: Pill },
  { value: 'medical', label: 'Medical', icon: Stethoscope },
  { value: 'obstetrics', label: 'Obstetrics', icon: Users },
  { value: 'other', label: 'Other', icon: CheckSquare },
];

const CATEGORY_COLORS: Record<string, string> = {
  cardiology: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  trauma: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  airway: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  pediatrics: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  pharmacology: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  medical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  obstetrics: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function StationPoolPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    station_code: '',
    station_name: '',
    category: 'other',
    description: '',
    semester: 3,
    cohort_id: '',
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUser();
      fetchCohorts();
      fetchFavorites();
    }
  }, [session]);

  useEffect(() => {
    if (user) {
      fetchStations();
    }
  }, [user, categoryFilter, showInactive]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?active=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchStations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('withStats', 'true');
      if (categoryFilter) params.append('category', categoryFilter);
      if (!showInactive) params.append('active', 'true');

      const res = await fetch(`/api/stations/pool?${params}`);
      const data = await res.json();
      if (data.success) {
        setStations(data.stations || []);
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
    setLoading(false);
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/stations/pool/favorites');
      const data = await res.json();
      if (data.success) {
        setFavorites(new Set(data.favorites || []));
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (stationId: string) => {
    const isFavorited = favorites.has(stationId);

    // Optimistic update
    const newFavorites = new Set(favorites);
    if (isFavorited) {
      newFavorites.delete(stationId);
    } else {
      newFavorites.add(stationId);
    }
    setFavorites(newFavorites);

    try {
      setFavoritesLoading(true);
      if (isFavorited) {
        await fetch(`/api/stations/pool/favorites?station_id=${stationId}`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/stations/pool/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: stationId }),
        });
      }
    } catch (error) {
      // Revert on error
      console.error('Error toggling favorite:', error);
      setFavorites(favorites);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingStation(null);
    setFormData({
      station_code: '',
      station_name: '',
      category: 'other',
      description: '',
      semester: 3,
      cohort_id: '',
      display_order: stations.length,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (station: Station) => {
    setEditingStation(station);
    setFormData({
      station_code: station.station_code,
      station_name: station.station_name,
      category: station.category,
      description: station.description || '',
      semester: station.semester,
      cohort_id: station.cohort?.id || '',
      display_order: station.display_order,
      is_active: station.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingStation
        ? `/api/stations/pool/${editingStation.id}`
        : '/api/stations/pool';
      const method = editingStation ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cohort_id: formData.cohort_id || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchStations();
      } else {
        alert(data.error || 'Failed to save station');
      }
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSaving(false);
  };

  const handleArchive = async (station: Station) => {
    if (!confirm(`Archive "${station.station_name}"? This will hide it from active stations.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/stations/pool/${station.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchStations();
      } else {
        alert(data.error || 'Failed to archive station');
      }
    } catch (error) {
      console.error('Error archiving station:', error);
      alert('Failed to archive station');
    }
  };

  // Sort: favorites first, then by display_order/name
  const sortedStations = [...stations].sort((a, b) => {
    const aFav = favorites.has(a.id) ? 0 : 1;
    const bFav = favorites.has(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return 0; // preserve original API ordering within each group
  });

  const filteredStations = sortedStations.filter(s => {
    if (showFavoritesOnly && !favorites.has(s.id)) return false;
    return (
      search === '' ||
      s.station_name.toLowerCase().includes(search.toLowerCase()) ||
      s.station_code.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const clearFilters = () => {
    setCategoryFilter('');
    setShowInactive(false);
    setSearch('');
    setShowFavoritesOnly(false);
  };

  const hasActiveFilters = categoryFilter || showInactive || search || showFavoritesOnly;

  const canEdit = user && hasMinRole(user.role, 'instructor');
  const canArchive = user && hasMinRole(user.role, 'admin');

  if (status === 'loading' || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Station Pool</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Station Pool</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage stations for Semester 3 clinical preparation tracking
              </p>
            </div>
            {canEdit && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Station
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow mb-6 dark:bg-gray-800">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search stations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>
              {/* Favorites toggle button */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                title={showFavoritesOnly ? 'Show all stations' : 'Show favorites only'}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-colors ${
                  showFavoritesOnly
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                <Star className={`w-5 h-5 ${showFavoritesOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                My Favorites
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
                  categoryFilter || showInactive
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-5 h-5" />
                Filters
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Show archived stations</span>
                    </label>
                  </div>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''} found
            {showFavoritesOnly && ` (${favorites.size} favorited total)`}
          </span>
          {favorites.size > 0 && !showFavoritesOnly && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <Star className="w-4 h-4 fill-yellow-400" />
              {favorites.size} favorited
            </span>
          )}
        </div>

        {/* Stations Grid */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-800">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading stations...</p>
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-800">
            <CheckSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No stations found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {showFavoritesOnly
                ? 'You have no favorited stations yet. Click the star on any station to add it to your favorites.'
                : hasActiveFilters
                ? 'Try adjusting your filters or search term'
                : 'Get started by adding your first station'}
            </p>
            {showFavoritesOnly && (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Show all stations
              </button>
            )}
            {canEdit && !hasActiveFilters && !showFavoritesOnly && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <Plus className="w-5 h-5" />
                Add Station
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredStations.map((station) => {
              const CategoryIcon = CATEGORIES.find(c => c.value === station.category)?.icon || CheckSquare;
              const stats = station.completion_stats;
              const isFavorited = favorites.has(station.id);

              return (
                <div
                  key={station.id}
                  className={`bg-white rounded-lg shadow p-4 dark:bg-gray-800 ${
                    !station.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg shrink-0 ${CATEGORY_COLORS[station.category]}`}>
                      <CategoryIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {station.station_name}
                        </h3>
                        {isFavorited && (
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {station.station_code}
                        </span>
                        {!station.is_active && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Archived
                          </span>
                        )}
                      </div>
                      {station.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {station.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[station.category]}`}>
                          {CATEGORIES.find(c => c.value === station.category)?.label || station.category}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded dark:bg-gray-700 dark:text-gray-300">
                          Semester {station.semester}
                        </span>
                        {station.cohort && (
                          <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded dark:bg-blue-900/30 dark:text-blue-300">
                            {station.cohort.program?.abbreviation || ''} {station.cohort.cohort_number}
                          </span>
                        )}
                      </div>

                      {/* Completion Stats */}
                      {stats && stats.total > 0 && (
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">{stats.total} logged</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">{stats.pass} pass</span>
                            <span className="text-yellow-600 dark:text-yellow-400">{stats.needs_review} review</span>
                            <span className="text-red-600 dark:text-red-400">{stats.incomplete} incomplete</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Favorite toggle */}
                      <button
                        onClick={() => toggleFavorite(station.id)}
                        disabled={favoritesLoading}
                        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                        className={`p-2 rounded-lg transition-colors ${
                          isFavorited
                            ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/30'
                            : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:text-gray-500 dark:hover:text-yellow-400 dark:hover:bg-yellow-900/30'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${isFavorited ? 'fill-yellow-400' : ''}`} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(station)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30"
                          title="Edit station"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}
                      {canArchive && station.is_active && (
                        <button
                          onClick={() => handleArchive(station)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30"
                          title="Archive station"
                        >
                          <Archive className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingStation ? 'Edit Station' : 'Add Station'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Station Code *
                </label>
                <input
                  type="text"
                  value={formData.station_code}
                  onChange={(e) => setFormData({ ...formData, station_code: e.target.value })}
                  placeholder="e.g., dyn-cardio-rhythm"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Unique identifier (lowercase, use hyphens)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Station Name *
                </label>
                <input
                  type="text"
                  value={formData.station_name}
                  onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                  placeholder="e.g., Dynamic Cardiology - Rhythm Recognition"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Optional description of what this station covers"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Semester
                  </label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                    <option value={3}>Semester 3</option>
                    <option value={4}>Semester 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort (Optional)
                </label>
                <select
                  value={formData.cohort_id}
                  onChange={(e) => setFormData({ ...formData, cohort_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                >
                  <option value="">All Cohorts</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program?.abbreviation || ''} {cohort.cohort_number}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to apply to all cohorts
                </p>
              </div>

              {editingStation && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                    Active (visible to students)
                  </label>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.station_code || !formData.station_name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingStation ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
