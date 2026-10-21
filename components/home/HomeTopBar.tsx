'use client';

import { Stethoscope, Search, HelpCircle } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import NotificationBell from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { visibleSections } from './sections';

interface HomeTopBarProps {
  role: string | null | undefined;
}

/**
 * Home top bar: brand, the nine sections, and utilities. The avatar menu
 * (Preview, settings, sign out) is the global UserMenu pinned top-right, so
 * the right edge reserves room for it. Under the bar, a breadcrumb line.
 * Wide layout is the base; below lg the section links scroll sideways.
 */
export default function HomeTopBar({ role }: HomeTopBarProps) {
  const sections = visibleSections(role);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 pr-20 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="PMI Paramedic Tools home">
          <span className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center" aria-hidden="true">
            <Stethoscope className="w-5 h-5 text-white" />
          </span>
          <span className="font-bold text-gray-900 dark:text-white max-md:hidden">PMI Paramedic Tools</span>
        </Link>

        <nav aria-label="Sections" className="flex-1 min-w-0 overflow-x-auto">
          <ul className="flex items-center gap-1 whitespace-nowrap">
            <li>
              <Link
                href="/"
                aria-current="page"
                className="inline-flex items-center px-3 min-h-[44px] text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg"
              >
                Home
              </Link>
            </li>
            {sections.map((s) => (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className="inline-flex items-center px-3 min-h-[44px] text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {s.short}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__openCommandPalette?.();
            }}
            aria-label="Open search (Ctrl+K)"
            title="Search (Ctrl+K / Cmd+K)"
            className="flex items-center justify-center w-11 h-11 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
          <NotificationBell />
          <Link
            href="/help"
            aria-label="Help Center"
            className="flex items-center justify-center w-11 h-11 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700">
        <nav aria-label="Breadcrumb" className="max-w-screen-2xl mx-auto px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
          <ol className="flex items-center gap-1">
            <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-200">Home</li>
          </ol>
        </nav>
      </div>
    </header>
  );
}
