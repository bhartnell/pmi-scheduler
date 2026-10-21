'use client';

import { Stethoscope, Search, HelpCircle } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import NotificationBell from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePathname } from 'next/navigation';
import { visibleSections, activeSectionKey } from './sections';
import SubNavLine from '@/components/layout/SubNavLine';

interface HomeTopBarProps {
  role: string | null | undefined;
}

const navLinkClass = (active: boolean) =>
  active
    ? 'inline-flex items-center px-3 min-h-[44px] text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg'
    : 'inline-flex items-center px-3 min-h-[44px] text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors';

/**
 * App-wide top bar (TRIM 6/7b-1a, rendered by AppChrome in the root layout):
 * brand, the nine sections, and utilities. The avatar menu (Preview,
 * settings, sign out) is the global UserMenu pinned top-right, so the right
 * edge reserves room for it. Under the bar, SubNavLine is the one line that
 * is both breadcrumb and sub-navigation. Wide layout is the base; below lg the
 * section links scroll sideways.
 */
export default function HomeTopBar({ role }: HomeTopBarProps) {
  const sections = visibleSections(role);
  const pathname = usePathname() ?? '/';
  const activeKey = activeSectionKey(pathname);

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
                aria-current={pathname === '/' ? 'page' : undefined}
                className={navLinkClass(pathname === '/')}
              >
                Home
              </Link>
            </li>
            {sections.map((s) => (
              <li key={s.key}>
                <Link
                  href={s.href}
                  aria-current={activeKey === s.key ? 'true' : undefined}
                  className={navLinkClass(activeKey === s.key)}
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
      <SubNavLine pathname={pathname} />
    </header>
  );
}
