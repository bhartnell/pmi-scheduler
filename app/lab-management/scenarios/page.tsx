'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Filter,
  FileText,
  ChevronRight,
  Activity,
  Heart,
  Brain,
  Baby,
  AlertTriangle,
  Thermometer,
  X,
  Star,
  Keyboard
} from 'lucide-react';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';

interface Scenario {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  difficulty: string;
  chief_complaint: string | null;
  applicable_programs: string[];
  estimated_duration: number | null;
  documentation_required: boolean;
  platinum_required: boolean;
}

const CATEGORIES = [
  'Medical',
  'Trauma',
  'Cardiac',
  'Respiratory',
  'Pediatric',
  'OB/GYN',
  'Behavioral',
  'Neurological',
  'Environmental',
  'Toxicology',
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const CATEGORY_ICONS: Record<string, any> = {
  Medical: Activity,
  Trauma: AlertTriangle,
  Cardiac: Heart,
  Respiratory: Activity,
  Pediatric: Baby,
  'OB/GYN': Baby,
  Behavioral: Brain,
  Neurological: Brain,
  Environmental: Thermometer,
  Toxicology: AlertTriangle,
};

export default function ScenariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchScenarios();
      fetchFavorites();
    }
  }, [session, categoryFilter, difficultyFilter, programFilter]);

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/lab-management/scenarios/favorites');
      if (res.ok) {
        const data = await res.json();
        setFavorites(new Set(data.map((f: { scenario_id: string }) => f.scenario_id)));
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const isFav = favorites.has(scenarioId);
    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });

    try {
      await fetch('/api/lab-management/scenarios/favorites', {
        method: isFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
    } catch {
      // Revert on error
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(scenarioId);
        else next.delete(scenarioId);
        return next;
      });
    }
  };

  const fetchScenarios = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (difficultyFilter) params.append('difficulty', difficultyFilter);
      if (programFilter) params.append('program', programFilter);

      const res = await fetch(`/api/lab-management/scenarios?${params}`);
      const data = await res.json();
      if (data.success) {
        setScenarios(data.scenarios);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    }
    setLoading(false);
  };

  const filteredScenarios = scenarios.filter(s => {
    const matchesSearch =
      search === '' ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.chief_complaint?.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    const matchesFavorites = !showFavoritesOnly || favorites.has(s.id);
    return matchesSearch && matchesFavorites;
  });

  const sortedScenarios = [...filteredScenarios].sort((a, b) => {
    const aFav = favorites.has(a.id) ? -1 : 0;
    const bFav = favorites.has(b.id) ? -1 : 0;
    return aFav - bFav;
  });

  const clearFilters = () => {
    setCategoryFilter('');
    setDifficultyFilter('');
    setProgramFilter('');
    setSearch('');
    setShowFavoritesOnly(false);
  };

  const hasActiveFilters = categoryFilter || difficultyFilter || programFilter || search || showFavoritesOnly;

  // Keep ref in sync so shortcut handlers always see latest index
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Reset selection when list changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [scenarios, search, categoryFilter, difficultyFilter, programFilter, showFavoritesOnly]);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '?',
      shift: true,
      handler: () => setShowShortcutsHelp(prev => !prev),
      description: 'Show keyboard shortcuts',
      category: 'Global',
    },
    {
      key: 'j',
      handler: () => {
        setSelectedIndex(prev => Math.min(prev + 1, sortedScenarios.length - 1));
      },
      description: 'Move selection down',
      category: 'Navigation',
    },
    {
      key: 'k',
      handler: () => {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      },
      description: 'Move selection up',
      category: 'Navigation',
    },
    {
      key: 'enter',
      handler: () => {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < sortedScenarios.length) {
          router.push(`/lab-management/scenarios/${sortedScenarios[idx].id}`);
        }
      },
      description: 'Open selected scenario',
      category: 'Navigation',
    },
    {
      key: 'n',
      handler: () => router.push('/lab-management/scenarios/new'),
      description: 'New scenario',
      category: 'Actions',
    },
    {
      key: 'f',
      handler: () => {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < sortedScenarios.length) {
          const scenario = sortedScenarios[idx];
          const isFav = favorites.has(scenario.id);
          setFavorites(prev => {
            const next = new Set(prev);
            if (isFav) next.delete(scenario.id);
            else next.add(scenario.id);
            return next;
          });
          fetch('/api/lab-management/scenarios/favorites', {
            method: isFav ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario_id: scenario.id }),
          }).catch(() => {
            // Revert on error
            setFavorites(prev => {
              const next = new Set(prev);
              if (isFav) next.add(scenario.id);
              else next.delete(scenario.id);
              return next;
            });
          });
        }
      },
      description: 'Toggle favorite on selected scenario',
      category: 'Actions',
    },
    {
      key: 'escape',
      handler: () => {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else {
          setSelectedIndex(-1);
        }
      },
      description: 'Clear selection / close modal',
      category: 'Global',
    },
  ];

  useKeyboardShortcuts(shortcuts, true);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading scenarios...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

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
                <span>Scenarios</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Scenario Library</h1>
            </div>
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <Link
              href="/lab-management/scenarios/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Scenario
            </Link>
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
                  placeholder="Search scenarios..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  showFavoritesOnly
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
                title={showFavoritesOnly ? 'Show all scenarios' : 'Show favorites only'}
              >
                <Star
                  className={`w-5 h-5 ${showFavoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`}
                />
                Favorites
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
                  categoryFilter || difficultyFilter || programFilter
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-5 h-5" />
                Filters
                {(categoryFilter || difficultyFilter || programFilter) && (
                  <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center dark:bg-blue-500">
                    {[categoryFilter, difficultyFilter, programFilter].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Levels</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
                    <select
                      value={programFilter}
                      onChange={(e) => setProgramFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Programs</option>
                      <option value="EMT">EMT</option>
                      <option value="AEMT">AEMT</option>
                      <option value="Paramedic">Paramedic</option>
                    </select>
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
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {sortedScenarios.length} scenario{sortedScenarios.length !== 1 ? 's' : ''} found
          {showFavoritesOnly && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">• Favorites only</span>
          )}
        </div>

        {/* Scenarios Grid */}
        {sortedScenarios.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-800">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No scenarios found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {showFavoritesOnly
                ? 'You have no favorited scenarios yet. Click the star on any scenario to save it here.'
                : hasActiveFilters
                ? 'Try adjusting your filters or search term'
                : 'Get started by creating your first scenario'}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/lab-management/scenarios/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <Plus className="w-5 h-5" />
                Create Scenario
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedScenarios.map((scenario, index) => {
              const CategoryIcon = CATEGORY_ICONS[scenario.category] || FileText;
              const isFavorited = favorites.has(scenario.id);
              const isSelected = index === selectedIndex;

              return (
                <Link
                  key={scenario.id}
                  href={`/lab-management/scenarios/${scenario.id}`}
                  className={`relative bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow dark:bg-gray-800 dark:hover:bg-gray-750 ${
                    isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                  }`}
                >
                  {/* Favorite star button */}
                  <button
                    onClick={(e) => toggleFavorite(scenario.id, e)}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star
                      className={`h-5 w-5 transition-all ${
                        isFavorited
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-400 hover:text-amber-400'
                      }`}
                    />
                  </button>

                  <div className="flex items-start gap-4 pr-8">
                    <div className="p-3 bg-blue-100 rounded-lg shrink-0 dark:bg-blue-900/50">
                      <CategoryIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{scenario.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${DIFFICULTY_COLORS[scenario.difficulty]}`}>
                          {scenario.difficulty}
                        </span>
                        {scenario.platinum_required && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Platinum
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {scenario.chief_complaint || scenario.category}
                        {scenario.subcategory && ` • ${scenario.subcategory}`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded dark:bg-gray-700 dark:text-gray-300">
                          {scenario.category}
                        </span>
                        {scenario.applicable_programs.map(prog => (
                          <span key={prog} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded dark:bg-blue-900/30 dark:text-blue-300">
                            {prog}
                          </span>
                        ))}
                        {scenario.estimated_duration && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded dark:bg-gray-700 dark:text-gray-300">
                            ~{scenario.estimated_duration} min
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={shortcuts}
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  );
}
