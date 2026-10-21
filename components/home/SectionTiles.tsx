'use client';

import { ExternalLink } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import { visibleSections, OPS_HUB_LINKS } from './sections';

/**
 * Bottom band of the home page: one tile per section (centered content, icon
 * square, title, one-line description, chips to the main pages), then a row of
 * small tiles for the PMI Operations Hub. Operations Hub is instructor+ only.
 */
export default function SectionTiles({
  role,
  showOpsHub,
}: {
  role: string | null | undefined;
  showOpsHub: boolean;
}) {
  const sections = visibleSections(role);

  return (
    <section aria-label="Sections" className="max-w-screen-2xl mx-auto">
      <h2 className="sr-only">Sections</h2>
      <div className="grid grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 flex flex-col items-center text-center"
            >
              <Link href={s.href} className="flex flex-col items-center group">
                <div className={`w-14 h-14 ${s.iconBg} rounded-xl flex items-center justify-center mb-3`} aria-hidden="true">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:underline">{s.label}</h3>
              </Link>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{s.description}</p>
              <div className="flex flex-wrap justify-center gap-2 text-xs mt-auto">
                {s.chips.map((c) => (
                  <Link
                    key={c.href + c.label}
                    href={c.href}
                    className={`inline-flex items-center min-h-[32px] px-3 rounded-full ${s.chip} hover:opacity-80`}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showOpsHub && (
        <div className="mt-8 text-center">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">PMI Operations Hub</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {OPS_HUB_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md text-sm font-medium text-gray-800 dark:text-gray-200 transition-shadow"
              >
                {l.label}
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
