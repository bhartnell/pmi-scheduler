'use client';

import { ExternalLink } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import { hasMinRole } from '@/lib/permissions';
import { OPS_HUB_LINKS, visibleSections } from './sections';

interface SectionTilesProps {
  role: string | null | undefined;
}

/**
 * Bottom band of the home page: nine section tiles (icon square, title,
 * one-line description, 2-3 chips) plus a centered row of small PMI
 * Operations Hub tiles. Desktop-first: three across, stacks on phones.
 */
export default function SectionTiles({ role }: SectionTilesProps) {
  const sections = visibleSections(role);
  const showOps = !!role && hasMinRole(role, 'instructor');

  return (
    <section aria-label="Sections" className="mt-10">
      <div className="grid grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow p-5 flex flex-col items-center text-center"
            >
              <Link href={s.href} className="flex flex-col items-center min-h-[44px] group">
                <span className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:underline">{s.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{s.description}</p>
              </Link>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {s.chips.map((c) => (
                  <Link
                    key={c.href + c.label}
                    href={c.href}
                    className="px-3 py-1.5 min-h-[32px] text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showOps && (
        <div className="mt-8 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            PMI Operations Hub
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {OPS_HUB_LINKS.map((o) => {
              const Icon = o.icon;
              return (
                <a
                  key={o.href}
                  href={o.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow"
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${o.color}`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{o.label}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
