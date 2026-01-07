'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  X
} from 'lucide-react';

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
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchScenarios();
    }
  }, [session, categoryFilter, difficultyFilter, programFilter]);

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

  const filteredScenarios = scenarios.filter(s => 
    search === '' || 
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.chief_complaint?.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const clearFilters = () => {
    setCategoryFilter('');
    setDifficultyFilter('');
    setProgramFilter('');
    setSearch('');
  };

  const hasActiveFilters = categoryFilter || difficultyFilter || programFilter || search;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading scenarios...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Scenarios</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Scenario Library</h1>
            </div>
            <Link
              href="/lab-management/scenarios/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Scenario
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search scenarios..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
                  hasActiveFilters ? 'border-blue-500 bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-5 h-5" />
                Filters
                {hasActiveFilters && (
                  <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                    {[categoryFilter, difficultyFilter, programFilter].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                    >
                      <option value="">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                    >
                      <option value="">All Levels</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                    <select
                      value={programFilter}
                      onChange={(e) => setProgramFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
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
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
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
        <div className="mb-4 text-sm text-gray-600">
          {filteredScenarios.length} scenario{filteredScenarios.length !== 1 ? 's' : ''} found
        </div>

        {/* Scenarios Grid */}
        {filteredScenarios.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scenarios found</h3>
            <p className="text-gray-600 mb-4">
              {hasActiveFilters 
                ? 'Try adjusting your filters or search term'
                : 'Get started by creating your first scenario'}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/lab-management/scenarios/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Create Scenario
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredScenarios.map((scenario) => {
              const CategoryIcon = CATEGORY_ICONS[scenario.category] || FileText;
              
              return (
                <Link
                  key={scenario.id}
                  href={`/lab-management/scenarios/${scenario.id}`}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg shrink-0">
                      <CategoryIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{scenario.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${DIFFICULTY_COLORS[scenario.difficulty]}`}>
                          {scenario.difficulty}
                        </span>
                        {scenario.platinum_required && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                            Platinum
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {scenario.chief_complaint || scenario.category}
                        {scenario.subcategory && ` • ${scenario.subcategory}`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                          {scenario.category}
                        </span>
                        {scenario.applicable_programs.map(prog => (
                          <span key={prog} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                            {prog}
                          </span>
                        ))}
                        {scenario.estimated_duration && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                            ~{scenario.estimated_duration} min
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
