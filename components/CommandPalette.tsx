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
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Constants ────────────────────────────────────────────────────────────────

const RECENT_KEY = 'command-palette-recent';
const MAX_RECENT = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Build command list (stable — router reference from useRouter is stable)
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

  // ── Filtered / ordered results ────────────────────────────────────────────

  const results = useMemo(() => {
    if (!query.trim()) {
      // No query: show recently used first, then all commands
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

      // Sort recent by recency order
      recentCommands.sort(
        (a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id)
      );

      return [...recentCommands, ...rest];
    }

    return commands.filter((cmd) => fuzzyMatch(query, cmd));
  }, [query, commands]);

  // Group results by category (preserving order)
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();

    // When there is no query and we have recent items, show a "Recent" group first
    if (!query.trim()) {
      const recentIds = getRecentIds();
      const recentItems = results.filter((cmd) => recentIds.includes(cmd.id));
      if (recentItems.length > 0) {
        map.set('Recent', recentItems);
      }
      // Then remaining by their original category
      for (const cmd of results) {
        if (recentIds.includes(cmd.id)) continue;
        const cat = cmd.category;
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(cmd);
      }
    } else {
      for (const cmd of results) {
        const cat = cmd.category;
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(cmd);
      }
    }

    return map;
  }, [results, query]);

  // Flat list of results in display order (for keyboard nav)
  const flatResults = useMemo(() => Array.from(grouped.values()).flat(), [grouped]);

  // Reset selection whenever results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ── Open / close ──────────────────────────────────────────────────────────

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the element is mounted and visible
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

  // ── In-palette keyboard navigation ───────────────────────────────────────

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

  // ── Execute ───────────────────────────────────────────────────────────────

  function executeCommand(cmd: Command) {
    saveRecent(cmd.id);
    close();
    cmd.action();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const modKey = isMac() ? '⌘' : 'Ctrl';

  // Build flat index tracker across groups for aria/keyboard
  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center px-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="mt-[20vh] w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search commands… (${modKey}K to close)`}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base outline-none"
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <ul
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
          role="listbox"
          aria-label="Command results"
        >
          {flatResults.length === 0 ? (
            <li className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
              No results found for &ldquo;{query}&rdquo;
            </li>
          ) : (
            Array.from(grouped.entries()).map(([category, cmds]) => {
              const categoryContent = (
                <div key={category}>
                  {/* Category header */}
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      {category === 'Recent' && (
                        <Clock className="w-3 h-3" aria-hidden="true" />
                      )}
                      {category}
                    </span>
                  </div>

                  {/* Commands in category */}
                  {cmds.map((cmd) => {
                    const idx = globalIndex++;
                    const isSelected = idx === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <li
                        key={cmd.id}
                        data-index={idx}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => executeCommand(cmd)}
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isSelected
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-sm font-medium">{cmd.label}</span>
                        {cmd.description && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block truncate max-w-[120px]">
                            {cmd.description}
                          </span>
                        )}
                        {isSelected && (
                          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded flex-shrink-0">
                            ↵
                          </kbd>
                        )}
                      </li>
                    );
                  })}
                </div>
              );

              return categoryContent;
            })
          )}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↑</kbd>
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↵</kbd>
              select
            </span>
          </span>
          <span>{flatResults.length} command{flatResults.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
