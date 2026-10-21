'use client';

import { ExternalLink } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import { hasMinRole } from '@/lib/permissions';
import { OPS_HUB_LINKS, visibleSections } from './sections';

interface SectionTilesProps {
  role: string | null | undefined;
  /** Right-of-Month version (TRIM 6/7a-7): 3 x 3, icon + name + one-line description, no chips, no Operations Hub (OperationsHubRow). */
  compact?: boolean;
}

/**
 * Bottom band of the home page: nine section tiles (icon square, title,
 * one-line description, 2-3 chips) plus a centered row of small PMI
 * Operations Hub tiles. Desktop-first: three across, stacks on phones.
 * The compact (beside-the-Month) version carries icon, name and the one-line
 * description (TRIM 6/7a-8); the Operations Hub row is OperationsHubRow, a
 * full-width row under the Month and Sections.
 */
export default function SectionTiles({ role, compact }: SectionTilesProps) {
  const sections = visibleSections(role);
  const showOps = !!role && hasMinRole(role, 'instructor');

  if (compact) {
    return (
      <section aria-label="Sections" className="min-w-0">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">Sections</p>
        <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.key}
                href={s.href}
                title={s.description}
                className="min-h-[120px] min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow p-3 flex flex-col items-center justify-center text-center gap-2 group"
              >
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:underline">{s.title}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{s.description}</span>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

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

/**
 * Josh's PMI Operations Hub links (TRIM 6/7a-8): one full-width row under the
 * Month and Sections, small tiles left-aligned with the label. Instructor+.
 */
export function OperationsHubRow({ role }: { role: string | null | undefined }) {
  if (!role || !hasMinRole(role, 'instructor')) return null;
  return (
    <section aria-label="PMI Operations Hub" className="w-full mt-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">PMI Operations Hub</p>
      <div className="flex flex-wrap gap-2">
        {OPS_HUB_LINKS.map((o) => {
          const OpsIcon = o.icon;
          return (
            <a
              key={o.href}
              href={o.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 min-h-[44px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <span className={`w-6 h-6 rounded flex items-center justify-center ${o.color}`}>
                <OpsIcon className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{o.label}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </section>
  );
}
