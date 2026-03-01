'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Star,
  Heart,
  Tag,
  X,
  ChevronRight,
  Activity,
  AlertTriangle,
  Brain,
  Baby,
  Thermometer,
  FileText,
  Download,
  Upload,
  Copy,
  SortAsc,
  MessageSquare,
  Plus,
  Check,
  Loader2,
} from 'lucide-react';
import { canCreateScenarios } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LibraryScenario {
  id: string;
  title: string;
  chief_complaint: string | null;
  difficulty: string;
  category: string;
  subcategory: string | null;
  applicable_programs: string[];
  estimated_duration: number | null;
  is_active: boolean;
  created_at: string;
  tags: string[];
  avg_rating: number;
  rating_count: number;
  my_rating: number | null;
  my_comment: string | null;
  is_favorite: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BODY_SYSTEMS = ['Cardiac', 'Respiratory', 'Trauma', 'Neuro', 'OB/GYN', 'Pediatric', 'Other'];

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const SORT_OPTIONS = [
  { value: 'title', label: 'Name' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'rating', label: 'Rating' },
  { value: 'created_at', label: 'Date Created' },
];

const COMMON_TAGS = [
  'Team Lead Practice',
  'Medication Admin',
  'Airway Management',
  'Cardiac Arrest',
  'Pediatric',
  'Geriatric',
  'Trauma',
  'Medical',
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  advanced: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  expert: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
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
  Neuro: Brain,
  Other: FileText,
};

// ---------------------------------------------------------------------------
// Star Rating Display
// ---------------------------------------------------------------------------

function StarDisplay({
  value,
  max = 5,
  size = 'sm',
}: {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
}) {
  const px = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(value);
        const half = !filled && i < value;
        return (
          <span key={i} className="relative">
            <Star className={`${px} text-gray-300 dark:text-gray-600`} />
            {(filled || half) && (
              <Star
                className={`${px} text-amber-400 fill-amber-400 absolute inset-0`}
                style={half ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Interactive Star Rating
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hovered !== null ? star <= hovered : star <= (value || 0);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className="p-0.5 focus:outline-none"
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                active ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-300'
              }`}
            />
          </button>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tag Chip
// ---------------------------------------------------------------------------

function TagChip({
  tag,
  onRemove,
  onClick,
  active,
}: {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
        active
          ? 'bg-blue-600 text-white dark:bg-blue-500'
          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
      }`}
      onClick={onClick}
    >
      <Tag className="w-3 h-3" />
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:text-red-400"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Clone Modal
// ---------------------------------------------------------------------------

function CloneModal({
  scenario,
  onClose,
  onCloned,
}: {
  scenario: LibraryScenario;
  onClose: () => void;
  onCloned: (id: string, title: string) => void;
}) {
  const [title, setTitle] = useState(`${scenario.title} (Copy)`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClone = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/lab-management/scenario-library/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario.id, new_title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Clone failed');
      } else {
        onCloned(data.scenario.id, data.scenario.title);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Clone Scenario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Cloning <span className="font-medium text-gray-900 dark:text-white">{scenario.title}</span>. All phases, criteria, and tags will be copied.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Scenario Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Cloning...' : 'Clone Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate Modal
// ---------------------------------------------------------------------------

function RateModal({
  scenario,
  onClose,
  onRated,
}: {
  scenario: LibraryScenario;
  onClose: () => void;
  onRated: (rating: number, avg: number, count: number) => void;
}) {
  const [rating, setRating] = useState<number | null>(scenario.my_rating);
  const [comment, setComment] = useState(scenario.my_comment || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!rating) { setError('Please select a rating'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/lab-management/scenario-library/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario.id, rating, comment: comment.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save rating');
      } else {
        onRated(rating, data.avg_rating, data.rating_count);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rate Scenario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{scenario.title}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Comment <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Share your experience with this scenario..."
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !rating}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag Manager (inline panel for a single scenario card)
// ---------------------------------------------------------------------------

function TagManager({
  scenario,
  allTags,
  onTagsChanged,
  onClose,
}: {
  scenario: LibraryScenario;
  allTags: string[];
  onTagsChanged: (id: string, tags: string[]) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    const lower = input.toLowerCase();
    const pool = [...new Set([...COMMON_TAGS, ...allTags])].filter(
      (t) => t.toLowerCase().includes(lower) && !scenario.tags.includes(t)
    );
    setSuggestions(pool.slice(0, 8));
  }, [input, allTags, scenario.tags]);

  const addTag = async (tag: string) => {
    if (!tag.trim() || scenario.tags.includes(tag.trim())) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lab-management/scenario-library/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario.id, tag: tag.trim() }),
      });
      if (res.ok) {
        onTagsChanged(scenario.id, [...scenario.tags, tag.trim()]);
        setInput('');
        setSuggestions([]);
      }
    } finally {
      setSaving(false);
    }
  };

  const removeTag = async (tag: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/lab-management/scenario-library/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario.id, tag }),
      });
      if (res.ok) {
        onTagsChanged(scenario.id, scenario.tags.filter((t) => t !== tag));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Manage Tags</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {scenario.tags.map((t) => (
          <TagChip key={t} tag={t} onRemove={() => removeTag(t)} />
        ))}
        {scenario.tags.length === 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">No tags yet</span>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) { e.preventDefault(); addTag(input); }
          }}
          placeholder="Add tag... (Enter to add)"
          className="w-full px-3 py-1.5 text-sm border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={saving}
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                onClick={() => addTag(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Common tag quick-add */}
      <div className="mt-2 flex flex-wrap gap-1">
        {COMMON_TAGS.filter((t) => !scenario.tags.includes(t)).slice(0, 6).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => addTag(t)}
            className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            + {t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario Card
// ---------------------------------------------------------------------------

function ScenarioCard({
  scenario,
  allTags,
  activeTagFilter,
  onTagClick,
  onTagsChanged,
  onFavoriteToggle,
  onCloneClick,
  onRateClick,
  onExport,
}: {
  scenario: LibraryScenario;
  allTags: string[];
  activeTagFilter: string;
  onTagClick: (tag: string) => void;
  onTagsChanged: (id: string, tags: string[]) => void;
  onFavoriteToggle: (id: string) => void;
  onCloneClick: (s: LibraryScenario) => void;
  onRateClick: (s: LibraryScenario) => void;
  onExport: (s: LibraryScenario) => void;
}) {
  const [showTagManager, setShowTagManager] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[scenario.category] || FileText;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
          <CategoryIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link
              href={`/lab-management/scenarios/${scenario.id}`}
              className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
            >
              {scenario.title}
            </Link>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${DIFFICULTY_COLORS[scenario.difficulty] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
              {scenario.difficulty}
            </span>
          </div>

          {scenario.chief_complaint && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
              {scenario.chief_complaint}
              {scenario.subcategory && ` • ${scenario.subcategory}`}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              {scenario.category}
            </span>
            {scenario.applicable_programs.map((p) => (
              <span key={p} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                {p}
              </span>
            ))}
            {scenario.estimated_duration && (
              <span>~{scenario.estimated_duration} min</span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-2">
            {scenario.avg_rating > 0 ? (
              <>
                <StarDisplay value={scenario.avg_rating} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {scenario.avg_rating.toFixed(1)} ({scenario.rating_count})
                </span>
              </>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">No ratings yet</span>
            )}
          </div>

          {/* Tags */}
          {scenario.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scenario.tags.map((t) => (
                <TagChip
                  key={t}
                  tag={t}
                  active={t === activeTagFilter}
                  onClick={() => onTagClick(t)}
                />
              ))}
            </div>
          )}

          {/* Tag manager (expandable) */}
          {showTagManager && (
            <TagManager
              scenario={scenario}
              allTags={allTags}
              onTagsChanged={onTagsChanged}
              onClose={() => setShowTagManager(false)}
            />
          )}
        </div>

        {/* Action buttons column */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Favorite */}
          <button
            onClick={() => onFavoriteToggle(scenario.id)}
            title={scenario.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                scenario.is_favorite
                  ? 'fill-red-500 text-red-500'
                  : 'text-gray-400 hover:text-red-400'
              }`}
            />
          </button>

          {/* Rate */}
          <button
            onClick={() => onRateClick(scenario)}
            title="Rate this scenario"
            className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              scenario.my_rating ? 'text-amber-500' : 'text-gray-400 hover:text-amber-400'
            }`}
          >
            <Star className={`w-5 h-5 ${scenario.my_rating ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Tags */}
          <button
            onClick={() => setShowTagManager((v) => !v)}
            title="Manage tags"
            className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              showTagManager ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-blue-500'
            }`}
          >
            <Tag className="w-5 h-5" />
          </button>

          {/* Clone */}
          <button
            onClick={() => onCloneClick(scenario)}
            title="Clone scenario"
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-green-500"
          >
            <Copy className="w-5 h-5" />
          </button>

          {/* Export */}
          <button
            onClick={() => onExport(scenario)}
            title="Export as JSON"
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-blue-500"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Open arrow */}
          <Link
            href={`/lab-management/scenarios/${scenario.id}`}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Open scenario"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ScenarioLibraryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [scenarios, setScenarios] = useState<LibraryScenario[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('scenario_favorites');
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('title');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [cloneTarget, setCloneTarget] = useState<LibraryScenario | null>(null);
  const [rateTarget, setRateTarget] = useState<LibraryScenario | null>(null);
  const [importSuccess, setImportSuccess] = useState('');
  const [cloneSuccess, setCloneSuccess] = useState('');

  // Import ref
  const importInputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Load scenarios + tags
  useEffect(() => {
    if (session) {
      fetchScenarios();
      fetchAllTags();
    }
  }, [session, categoryFilter, difficultyFilter, tagFilter, sortBy]);

  const fetchScenarios = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (tagFilter) params.set('tag', tagFilter);
      if (sortBy) params.set('sort', sortBy);
      if (search) params.set('search', search);

      const res = await fetch(`/api/lab-management/scenario-library?${params}`);
      const data = await res.json();
      if (data.success) {
        setScenarios(data.scenarios);
      } else {
        setError(data.error || 'Failed to load scenarios');
      }
    } catch {
      setError('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      const res = await fetch('/api/lab-management/scenario-library/tags');
      const data = await res.json();
      if (data.success) setAllTags(data.tags);
    } catch {
      // non-fatal
    }
  };

  // Merge localStorage favorites into scenario objects
  const scenariosWithFavorites = useMemo(
    () => scenarios.map((s) => ({ ...s, is_favorite: favoriteIds.has(s.id) })),
    [scenarios, favoriteIds]
  );

  // Search and favorites filter are client-side on top of server-filtered results
  const visibleScenarios = scenariosWithFavorites.filter((s) => {
    if (favoritesOnly && !s.is_favorite) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.chief_complaint?.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFavoriteToggle = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('scenario_favorites', JSON.stringify([...next]));
      } catch {
        // localStorage unavailable - favorites not persisted
      }
      return next;
    });
  }, []);

  const handleTagsChanged = useCallback((id: string, tags: string[]) => {
    setScenarios((prev) => prev.map((s) => s.id === id ? { ...s, tags } : s));
    // Refresh all-tags list
    fetchAllTags();
  }, []);

  const handleRated = useCallback((scenarioId: string, myRating: number, avg: number, count: number) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === scenarioId
          ? { ...s, my_rating: myRating, avg_rating: avg, rating_count: count }
          : s
      )
    );
    setRateTarget(null);
  }, []);

  const handleCloned = useCallback((newId: string, newTitle: string) => {
    setCloneTarget(null);
    setCloneSuccess(`Cloned as "${newTitle}"`);
    setTimeout(() => setCloneSuccess(''), 4000);
    // Navigate to the clone
    router.push(`/lab-management/scenarios/${newId}`);
  }, [router]);

  // Export a single scenario as JSON
  const handleExport = useCallback(async (scenario: LibraryScenario) => {
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenario.id}`);
      const data = await res.json();
      if (!data.success) return;
      const json = JSON.stringify(data.scenario, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scenario.title.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  }, []);

  // Import scenario(s) from JSON file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/lab-management/scenarios/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (data.success || data.imported?.length > 0) {
        setImportSuccess(`Imported ${data.imported?.length || 0} scenario(s)`);
        setTimeout(() => setImportSuccess(''), 4000);
        fetchScenarios();
      }
    } catch {
      // silent - could add error toast
    }
    // Reset input so same file can be re-imported
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const clearFilters = () => {
    setCategoryFilter('');
    setDifficultyFilter('');
    setTagFilter('');
    setFavoritesOnly(false);
    setSearch('');
    setSortBy('title');
  };

  const hasActiveFilters = categoryFilter || difficultyFilter || tagFilter || favoritesOnly || search;

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
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
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/lab-management/scenarios" className="hover:text-blue-600 dark:hover:text-blue-400">Scenarios</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white">Library</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                Simulation Scenario Library
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Browse, rate, tag, and clone scenarios across all cohorts
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Import */}
              <label
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm font-medium"
                title="Import scenario from JSON"
              >
                <Upload className="w-4 h-4" />
                Import
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>

              {/* New scenario */}
              <Link
                href="/lab-management/scenarios/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Scenario
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toast messages */}
        {(importSuccess || cloneSuccess) && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-300 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            {importSuccess || cloneSuccess}
          </div>
        )}

        {/* Search + filter bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow mb-6 border border-gray-100 dark:border-gray-700">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, complaint, category, or tag..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>Sort: {o.label}</option>
                ))}
              </select>

              {/* Favorites toggle */}
              <button
                onClick={() => setFavoritesOnly((v) => !v)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  favoritesOnly
                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-red-500 text-red-500' : ''}`} />
                Favorites
              </button>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter || difficultyFilter || tagFilter
                    ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(categoryFilter || difficultyFilter || tagFilter) && (
                  <span className="ml-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                    {[categoryFilter, difficultyFilter, tagFilter].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Expanded filter panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Body system */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Body System / Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Categories</option>
                      {BODY_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Difficulty</label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Levels</option>
                      {DIFFICULTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  {/* Tag filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tag</label>
                    <select
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="">All Tags</option>
                      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Active tag chips */}
                {allTags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Quick filter by tag:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map((t) => (
                        <TagChip
                          key={t}
                          tag={t}
                          active={t === tagFilter}
                          onClick={() => setTagFilter(t === tagFilter ? '' : t)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <X className="w-4 h-4" />
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tag filter active pill */}
        {tagFilter && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Filtered by tag:</span>
            <TagChip tag={tagFilter} onRemove={() => setTagFilter('')} active />
          </div>
        )}

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {loading ? 'Loading...' : `${visibleScenarios.length} scenario${visibleScenarios.length !== 1 ? 's' : ''}`}
            {favoritesOnly && <span className="ml-2 text-red-500"> • Favorites only</span>}
          </span>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : visibleScenarios.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-16 text-center">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No scenarios found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {favoritesOnly
                ? 'Click the heart icon on any scenario card to add it to your favorites.'
                : hasActiveFilters
                ? 'Try adjusting your filters or search term.'
                : 'No scenarios have been created yet.'}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/lab-management/scenarios/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" />
                Create Scenario
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                allTags={allTags}
                activeTagFilter={tagFilter}
                onTagClick={(t) => setTagFilter(t === tagFilter ? '' : t)}
                onTagsChanged={handleTagsChanged}
                onFavoriteToggle={handleFavoriteToggle}
                onCloneClick={setCloneTarget}
                onRateClick={setRateTarget}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </main>

      {/* Clone Modal */}
      {cloneTarget && (
        <CloneModal
          scenario={cloneTarget}
          onClose={() => setCloneTarget(null)}
          onCloned={handleCloned}
        />
      )}

      {/* Rate Modal */}
      {rateTarget && (
        <RateModal
          scenario={rateTarget}
          onClose={() => setRateTarget(null)}
          onRated={(myRating, avg, count) => handleRated(rateTarget.id, myRating, avg, count)}
        />
      )}
    </div>
  );
}
