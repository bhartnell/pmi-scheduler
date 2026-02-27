'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  CheckSquare,
  Calendar,
  FlaskConical,
  Stethoscope,
  CalendarDays,
  Users,
  FileText,
  Settings,
  Bell,
  BarChart3,
  GraduationCap,
  Plus,
  MapPin,
  User,
  AlertTriangle,
  Search,
  Clock,
  Loader2,
  X,
  BookOpen,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  category: string;
  action: () => void;
  keywords: string[];
  description?: string;
}

interface SearchResultItem {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  category: string;
  action: () => void;
  keywords: string[];
  description?: string;
  badge?: string;
  badgeColor?: string;
}

interface SearchApiResponse {
  results: {
    students: Array<{
      id: string;
      name: string;
      email: string;
      cohortName: string | null;
      type: 'student';
    }>;
    scenarios: Array<{
      id: string;
      title: string;
      category: string | null;
      chiefComplaint: string | null;
      difficulty: string | null;
      type: 'scenario';
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string | null;
      type: 'task';
    }>;
    labDays: Array<{
      id: string;
      date: string;
      title: string | null;
      status: string | null;
      cohortName: string | null;
      type: 'lab_day';
    }>;
    instructors: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      type: 'instructor';
    }>;
  };
  totalCount: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const RECENT_KEY = 'command-palette-recent';
const RECENT_SEARCHES_KEY = 'command-palette-recent-searches';
const MAX_RECENT = 5;
const SEARCH_DEBOUNCE_MS = 300;

// ── Badge color helpers ───────────────────────────────────────────────────────

function getDifficultyColor(difficulty: string | null): string {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'hard':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'advanced':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getTaskStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'in_progress':
    case 'in progress':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'overdue':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getLabStatusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'scheduled':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function getRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getRecentIds().filter((rid) => rid !== id);
    const next = [id, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = query.trim();
    if (!trimmed) return;
    const prev = getRecentSearches().filter((q) => q !== trimmed);
    const next = [trimmed, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore storage errors
  }
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, command: Command): boolean {
  const q = query.toLowerCase();
  return (
    command.label.toLowerCase().includes(q) ||
    command.category.toLowerCase().includes(q) ||
    command.keywords.some((kw) => kw.toLowerCase().includes(q)) ||
    (command.description?.toLowerCase().includes(q) ?? false)
  );
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform?.toUpperCase().includes('MAC') ?? false;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedQuery = useRef<string>('');

  // Recent searches display state (so "Clear" can update UI immediately)
  const [recentSearchList, setRecentSearchList] = useState<string[]>([]);

  // Sync recent searches from localStorage when opened or query cleared
  useEffect(() => {
    if (isOpen && !query.trim()) {
      setRecentSearchList(getRecentSearches());
    }
  }, [isOpen, query]);

  // Build command list
  const commands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: Home,
        category: 'Navigation',
        action: () => router.push('/'),
        keywords: ['home'],
      },
      {
        id: 'nav-tasks',
        label: 'Go to Tasks',
        icon: CheckSquare,
        category: 'Navigation',
        action: () => router.push('/tasks'),
        keywords: ['todo'],
      },
      {
        id: 'nav-calendar',
        label: 'Go to Calendar',
        icon: Calendar,
        category: 'Navigation',
        action: () => router.push('/calendar'),
        keywords: ['schedule'],
      },
      {
        id: 'nav-labs',
        label: 'Go to Lab Management',
        icon: FlaskConical,
        category: 'Navigation',
        action: () => router.push('/lab-management'),
        keywords: ['lab'],
      },
      {
        id: 'nav-clinical',
        label: 'Go to Clinical',
        icon: Stethoscope,
        category: 'Navigation',
        action: () => router.push('/clinical'),
        keywords: ['clinical', 'site'],
      },
      {
        id: 'nav-schedule',
        label: 'Go to Lab Schedule',
        icon: CalendarDays,
        category: 'Navigation',
        action: () => router.push('/lab-management/schedule'),
        keywords: ['schedule'],
      },
      {
        id: 'nav-students',
        label: 'Go to Students',
        icon: Users,
        category: 'Navigation',
        action: () => router.push('/lab-management/students'),
        keywords: ['student'],
      },
      {
        id: 'nav-scenarios',
        label: 'Go to Scenarios',
        icon: FileText,
        category: 'Navigation',
        action: () => router.push('/lab-management/scenarios'),
        keywords: ['scenario'],
      },
      {
        id: 'nav-resources',
        label: 'Go to Resources',
        icon: BookOpen,
        category: 'Navigation',
        action: () => router.push('/resources'),
        keywords: ['resource', 'docs', 'files'],
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        icon: Settings,
        category: 'Navigation',
        action: () => router.push('/settings'),
        keywords: ['preferences'],
      },
      {
        id: 'nav-notifications',
        label: 'Go to Notifications',
        icon: Bell,
        category: 'Navigation',
        action: () => router.push('/notifications'),
        keywords: ['alerts'],
      },
      {
        id: 'nav-reports',
        label: 'Go to Reports',
        icon: BarChart3,
        category: 'Navigation',
        action: () => router.push('/lab-management/reports'),
        keywords: ['analytics'],
      },
      {
        id: 'nav-cohorts',
        label: 'Go to Cohorts',
        icon: GraduationCap,
        category: 'Navigation',
        action: () => router.push('/lab-management/cohorts'),
        keywords: ['cohort', 'group'],
      },
      {
        id: 'nav-workload',
        label: 'Instructor Workload',
        icon: BarChart3,
        category: 'Navigation',
        action: () => router.push('/reports/instructor-workload'),
        keywords: ['workload', 'analytics'],
      },
      // Actions
      {
        id: 'action-new-task',
        label: 'Create New Task',
        icon: Plus,
        category: 'Actions',
        action: () => router.push('/tasks?new=true'),
        keywords: ['add', 'create'],
      },
      {
        id: 'action-site-visits',
        label: 'Log Site Visit',
        icon: MapPin,
        category: 'Actions',
        action: () => router.push('/clinical/site-visits'),
        keywords: ['clinical', 'visit'],
      },
      // Quick Filters
      {
        id: 'filter-my-tasks',
        label: 'My Tasks',
        icon: User,
        category: 'Quick Filters',
        action: () => router.push('/tasks?tab=assigned'),
        keywords: ['assigned'],
      },
      {
        id: 'filter-overdue',
        label: 'Overdue Tasks',
        icon: AlertTriangle,
        category: 'Quick Filters',
        action: () => router.push('/tasks?tab=assigned&filter=overdue'),
        keywords: ['late', 'past due'],
      },
    ],
    [router]
  );

  // ── Search API call (debounced) ────────────────────────────────────────────

  const runSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }

      // Avoid duplicate calls for the same query
      if (searchQuery === lastSearchedQuery.current) return;
      lastSearchedQuery.current = searchQuery;

      setSearchLoading(true);
      setSearchError(null);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}&limit=5`
        );

        if (!res.ok) {
          throw new Error('Search request failed');
        }

        const data: SearchApiResponse = await res.json();

        // Convert API results to SearchResultItem for unified keyboard nav
        const items: SearchResultItem[] = [];

        data.results.students.forEach((s) => {
          const subtitle = [s.email, s.cohortName ? `Cohort: ${s.cohortName}` : null]
            .filter(Boolean)
            .join(' · ');
          items.push({
            id: `search-student-${s.id}`,
            label: s.name,
            description: subtitle || undefined,
            icon: Users,
            category: 'Students',
            keywords: [],
            action: () => router.push(`/lab-management/students/${s.id}`),
          });
        });

        data.results.scenarios.forEach((s) => {
          const subtitle = [s.chiefComplaint, s.category]
            .filter(Boolean)
            .join(' · ');
          items.push({
            id: `search-scenario-${s.id}`,
            label: s.title,
            description: subtitle || undefined,
            icon: FileText,
            category: 'Scenarios',
            keywords: [],
            badge: s.difficulty ?? undefined,
            badgeColor: getDifficultyColor(s.difficulty),
            action: () => router.push(`/lab-management/scenarios/${s.id}`),
          });
        });

        data.results.tasks.forEach((t) => {
          items.push({
            id: `search-task-${t.id}`,
            label: t.title,
            description: undefined,
            icon: CheckSquare,
            category: 'Tasks',
            keywords: [],
            badge: t.status.replace(/_/g, ' '),
            badgeColor: getTaskStatusColor(t.status),
            action: () => router.push(`/tasks/${t.id}`),
          });
        });

        data.results.labDays.forEach((l) => {
          const dateStr = l.date ? formatDate(l.date) : '';
          const subtitle = [dateStr, l.cohortName ?? null]
            .filter(Boolean)
            .join(' · ');
          items.push({
            id: `search-labday-${l.id}`,
            label: l.title || 'Lab Day',
            description: subtitle || undefined,
            icon: CalendarDays,
            category: 'Labs',
            keywords: [],
            badge: l.status ?? undefined,
            badgeColor: getLabStatusColor(l.status),
            action: () => router.push(`/lab-management/schedule/${l.id}`),
          });
        });

        data.results.instructors.forEach((u) => {
          items.push({
            id: `search-instructor-${u.id}`,
            label: u.name,
            description: u.email,
            icon: User,
            category: 'Instructors',
            keywords: [],
            badge: formatRoleLabel(u.role),
            badgeColor:
              'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
            action: () => router.push('/admin/users'),
          });
        });

        setSearchResults(items);
      } catch (err) {
        console.error('Search error:', err);
        setSearchError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [router]
  );

  // Trigger debounced search when query changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      lastSearchedQuery.current = '';
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, runSearch]);

  // ── Filtered / ordered command results ──────────────────────────────────

  const commandResults = useMemo(() => {
    if (!query.trim()) {
      const recentIds = getRecentIds();
      const recentCommands: Command[] = [];
      const rest: Command[] = [];

      for (const cmd of commands) {
        if (recentIds.includes(cmd.id)) {
          recentCommands.push(cmd);
        } else {
          rest.push(cmd);
        }
      }

      recentCommands.sort(
        (a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id)
      );

      return [...recentCommands, ...rest];
    }

    return commands.filter((cmd) => fuzzyMatch(query, cmd));
  }, [query, commands]);

  // Group command results by category
  const groupedCommands = useMemo(() => {
    const map = new Map<string, Command[]>();

    if (!query.trim()) {
      const recentIds = getRecentIds();
      const recentItems = commandResults.filter((cmd) =>
        recentIds.includes(cmd.id)
      );
      if (recentItems.length > 0) {
        map.set('Recent', recentItems);
      }
      for (const cmd of commandResults) {
        if (recentIds.includes(cmd.id)) continue;
        const cat = cmd.category;
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(cmd);
      }
    } else {
      for (const cmd of commandResults) {
        const cat = cmd.category;
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(cmd);
      }
    }

    return map;
  }, [commandResults, query]);

  // Group search results by their entity category
  const groupedSearchResults = useMemo(() => {
    if (query.length < 2 || searchResults.length === 0)
      return new Map<string, SearchResultItem[]>();

    const map = new Map<string, SearchResultItem[]>();
    for (const item of searchResults) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [searchResults, query]);

  // Recent searches as pseudo-commands (shown when no query is typed)
  const recentSearchItems = useMemo(() => {
    if (query.trim()) return [];
    return recentSearchList.map((q) => ({
      id: `recent-search-${q}`,
      label: q,
      icon: Search,
      category: 'Recent Searches',
      action: () => setQuery(q),
      keywords: [],
    }));
  }, [query, recentSearchList]);

  // Flat list of ALL items in display order for keyboard nav
  const flatResults = useMemo(() => {
    const allItems: Array<Command | SearchResultItem> = [];

    if (!query.trim() && recentSearchItems.length > 0) {
      allItems.push(...recentSearchItems);
    }

    for (const cmds of groupedCommands.values()) {
      allItems.push(...cmds);
    }

    if (query.length >= 2) {
      for (const items of groupedSearchResults.values()) {
        allItems.push(...items);
      }
    }

    return allItems;
  }, [groupedCommands, groupedSearchResults, recentSearchItems, query]);

  // Reset selection whenever query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ── Open / close ─────────────────────────────────────────────────────────

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
    setSearchResults([]);
    setSearchError(null);
    lastSearchedQuery.current = '';
    setRecentSearchList(getRecentSearches());
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Global keyboard listener for Cmd+K / Ctrl+K ───────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isKCombo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (isKCombo) {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  // Expose open function on window so the navbar search button can call it
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__openCommandPalette = open;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__openCommandPalette;
    };
  }, [open]);

  // ── In-palette keyboard navigation ──────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatResults.length === 0 ? 0 : (prev + 1) % flatResults.length
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatResults.length === 0
            ? 0
            : (prev - 1 + flatResults.length) % flatResults.length
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          executeCommand(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector<HTMLLIElement>(
      `[data-index="${selectedIndex}"]`
    );
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // ── Execute ──────────────────────────────────────────────────────────────

  function executeCommand(cmd: Command | SearchResultItem) {
    if (cmd.id.startsWith('search-')) {
      saveRecentSearch(query);
    } else if (!cmd.id.startsWith('recent-search-')) {
      saveRecent(cmd.id);
    }
    close();
    cmd.action();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const modKey = isMac() ? '⌘' : 'Ctrl';
  const hasQueryResults =
    query.length >= 2 && (searchResults.length > 0 || searchLoading || searchError);
  const commandCount = flatResults.length;

  // Build flat index tracker across groups for keyboard nav
  let globalIndex = 0;

  // Helper to render a single item row
  function renderItem(item: Command | SearchResultItem, idx: number) {
    const isSelected = idx === selectedIndex;
    const Icon = item.icon;
    const searchItem = item as SearchResultItem;

    return (
      <li
        key={item.id}
        data-index={idx}
        role="option"
        aria-selected={isSelected}
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        onMouseEnter={() => setSelectedIndex(idx)}
        onClick={() => executeCommand(item)}
      >
        {/* Icon */}
        <Icon
          className={`w-4 h-4 flex-shrink-0 ${
            isSelected
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
          aria-hidden="true"
        />

        {/* Label + description stacked */}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{item.label}</span>
          {item.description && (
            <span className="block text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
              {item.description}
            </span>
          )}
        </span>

        {/* Badge (difficulty / status / role) - hidden on small screens */}
        {searchItem.badge && (
          <span
            className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 capitalize ${
              searchItem.badgeColor ||
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {searchItem.badge}
          </span>
        )}

        {/* Enter hint when selected */}
        {isSelected && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded flex-shrink-0">
            {item.id.startsWith('recent-search-') ? 'search' : '↵'}
          </kbd>
        )}
      </li>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center px-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="mt-[15vh] w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          {searchLoading ? (
            <Loader2
              className="w-5 h-5 text-blue-400 flex-shrink-0 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, students, scenarios, labs…"
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base outline-none"
            aria-label="Search commands and records"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded flex-shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <ul
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto py-2"
          role="listbox"
          aria-label="Search results"
        >
          {/* Recent searches section (when no query typed) */}
          {!query.trim() && recentSearchItems.length > 0 && (() => {
            const sectionItems = recentSearchItems;
            return (
              <div key="recent-searches">
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    Recent Searches
                  </span>
                  <button
                    className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRecentSearches();
                      setRecentSearchList([]);
                    }}
                    aria-label="Clear recent searches"
                  >
                    Clear
                  </button>
                </div>
                {sectionItems.map((item) => {
                  const idx = globalIndex++;
                  return renderItem(item, idx);
                })}
              </div>
            );
          })()}

          {/* Command results (always shown, filtered by query if present) */}
          {commandResults.length > 0 || !query.trim() ? (
            Array.from(groupedCommands.entries()).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    {category === 'Recent' && (
                      <Clock className="w-3 h-3" aria-hidden="true" />
                    )}
                    {category}
                  </span>
                </div>
                {cmds.map((cmd) => {
                  const idx = globalIndex++;
                  return renderItem(cmd, idx);
                })}
              </div>
            ))
          ) : null}

          {/* Search results section (when query is 2+ chars) */}
          {query.length >= 2 && (
            <>
              {searchLoading && searchResults.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Searching records&hellip;
                </div>
              )}

              {searchError && !searchLoading && (
                <div role="alert" className="px-4 py-4 text-center text-sm text-red-500 dark:text-red-400">
                  {searchError}
                </div>
              )}

              {!searchLoading &&
                !searchError &&
                searchResults.length === 0 &&
                commandResults.length === 0 && (
                  <li className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                    No results found for &ldquo;{query}&rdquo;
                  </li>
                )}

              {searchResults.length > 0 && (
                <>
                  {commandResults.length > 0 && (
                    <div className="mx-4 my-2 border-t border-gray-100 dark:border-gray-800" />
                  )}

                  {Array.from(groupedSearchResults.entries()).map(([category, items]) => {
                    const CategoryIcon =
                      category === 'Students'
                        ? Users
                        : category === 'Scenarios'
                        ? FileText
                        : category === 'Labs'
                        ? CalendarDays
                        : category === 'Tasks'
                        ? CheckSquare
                        : category === 'Instructors'
                        ? User
                        : Search;

                    return (
                      <div key={`search-${category}`}>
                        <div className="px-4 pt-3 pb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                            <CategoryIcon className="w-3 h-3" aria-hidden="true" />
                            {category}
                          </span>
                        </div>
                        {items.map((item) => {
                          const idx = globalIndex++;
                          return renderItem(item, idx);
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* Empty state */}
          {!query.trim() &&
            commandResults.length === 0 &&
            recentSearchItems.length === 0 && (
              <li className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                No commands available
              </li>
            )}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                ↑
              </kbd>
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                ↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                ↵
              </kbd>
              select
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                {modKey}K
              </kbd>
              close
            </span>
          </span>
          <span>
            {hasQueryResults
              ? `${commandCount} result${commandCount !== 1 ? 's' : ''}`
              : `${commandCount} command${commandCount !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
    </div>
  );
}
