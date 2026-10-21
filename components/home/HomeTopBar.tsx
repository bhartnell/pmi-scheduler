'use client';

import { Stethoscope, Search, HelpCircle } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import Breadcrumbs from '@/components/Breadcrumbs';
import { visibleSections } from './sections';

/**
 * Home top bar: brand, the nine sections, search / bell / help / theme.
 * The avatar menu (Preview, settings, sign out) is the global UserMenu pinned
 * top-right, so the bar leaves room for it. The breadcrumb line sits under it.
 * Wide layout is the base; below lg the section row scrolls sideways.
 */
export default function HomeTopBar({ role }: { role: string | null | undefined }) {
  const sections = visibleSections(role);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 pr-20 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="PMI Paramedic Tools home">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center" aria-hidden="true">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white max-xl:hidden">PMI Paramedic Tools</span>
        </Link>

        <nav aria-label="Sections" className="flex-1 min-w-0 overflow-x-auto">
          <ul className="flex items-center gap-1 whitespace-nowrap">
            <li>
              <Link
                href="/"
                aria-current="page"
                className="flex items-center min-h-[44px] px-3 text-sm font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                Home
              </Link>
            </li>
            {sections.map((s) => (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className="flex items-center min-h-[44px] px-3 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {s.label}
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
            className="flex items-center justify-center min-h-[44px] min-w-[44px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
          <NotificationBell />
          <Link
            href="/help"
            aria-label="Help Center"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700">
        <div className="max-w-screen-2xl mx-auto px-4 py-1">
          <Breadcrumbs />
        </div>
      </div>
    </header>
  );
}
