'use client';

/**
 * Student Completions Page
 *
 * Full list of station completions for the current student.
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  CheckSquare,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  X,
  TrendingUp
} from 'lucide-react';

interface StationStatus {
  id: string;
  station_code: string;
  station_name: string;
  category: string;
  description?: string;
  status: 'pass' | 'needs_review' | 'incomplete' | 'not_started';
  completed_at: string | null;
}

interface CompletionSummary {
  total_stations: number;
  completed: number;
  needs_review: number;
  not_started: number;
  completion_rate: number;
}

const STATUS_CONFIG = {
  pass: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Passed',
  },
  needs_review: {
    icon: AlertCircle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Needs Review',
  },
  incomplete: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Incomplete',
  },
  not_started: {
    icon: Clock,
    color: 'text-gray-400 dark:text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-700',
    label: 'Not Started',
  },
};

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

export default function StudentCompletionsPage() {
  const { data: session } = useSession();
  const [stations, setStations] = useState<StationStatus[]>([]);
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCompletions();
    }
  }, [session]);

  const fetchCompletions = async () => {
    try {
      const res = await fetch('/api/student/completions');
      const data = await res.json();
      if (data.success) {
        setStations(data.stations || []);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching completions:', error);
    }
    setLoading(false);
  };

  // Get unique categories
  const categories = [...new Set(stations.map(s => s.category))].sort();

  // Filter stations
  const filteredStations = stations.filter(station => {
    const matchesSearch =
      search === '' ||
      station.station_name.toLowerCase().includes(search.toLowerCase()) ||
      station.station_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' || station.status === statusFilter;
    const matchesCategory = categoryFilter === '' || station.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
  };

  const hasActiveFilters = search || statusFilter || categoryFilter;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Station Completions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your progress through required stations
        </p>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.completion_rate}% Complete
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {summary.completed} of {summary.total_stations} stations passed
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${summary.completion_rate}%` }}
            />
          </div>

          {/* Status breakdown */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-600 dark:text-gray-400">
                {summary.completed} Passed
              </span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-gray-600 dark:text-gray-400">
                {summary.needs_review} Needs Review
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">
                {summary.not_started} Not Started
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search stations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
                hasActiveFilters
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value="">All Statuses</option>
                    <option value="pass">Passed</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="incomplete">Incomplete</option>
                    <option value="not_started">Not Started</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 flex items-center gap-1"
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
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''} found
      </div>

      {/* Stations List */}
      {filteredStations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <CheckSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No stations found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {hasActiveFilters
              ? 'Try adjusting your filters or search term'
              : 'No station data available yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStations.map(station => {
            const config = STATUS_CONFIG[station.status];
            const StatusIcon = config.icon;

            return (
              <div
                key={station.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg shrink-0 ${config.bg}`}>
                    <StatusIcon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {station.station_name}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        CATEGORY_COLORS[station.category] || CATEGORY_COLORS.other
                      }`}>
                        {station.category.charAt(0).toUpperCase() + station.category.slice(1)}
                      </span>
                    </div>
                    {station.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {station.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className={`font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      {station.completed_at && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {new Date(station.completed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
