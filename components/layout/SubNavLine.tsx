'use client';

import { ChevronRight } from 'lucide-react';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import { buildBreadcrumbItems } from '@/components/Breadcrumbs';
import { sectionForPath } from '@/components/home/sections';

/**
 * The one line under the app-wide top bar (TRIM 6/7b-1). It is both the
 * breadcrumb and the sub-navigation: on a section's front page it lists that
 * section's main pages as links (current one highlighted); on a deeper page it
 * shows the path as links; on Home it just says Home. Same height everywhere.
 */
export default function SubNavLine({ pathname }: { pathname: string }) {
  const section = sectionForPath(pathname);
  const onFront =
    section && (pathname === section.href || section.chips.some((c) => c.href === pathname));

  let content: React.ReactNode;
  if (pathname === '/') {
    content = <span aria-current="page" className="font-medium text-gray-700 dark:text-gray-200">Home</span>;
  } else if (section && onFront) {
    const links = section.chips.some((c) => c.href === section.href)
      ? section.chips
      : [{ label: section.short, href: section.href }, ...section.chips];
    content = (
      <>
        <span className="font-medium text-gray-700 dark:text-gray-200 mr-2">{section.title}:</span>
        <ul className="flex items-center gap-1">
          {links.map((l) => {
            const current = l.href === pathname;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current ? 'page' : undefined}
                  className={
                    current
                      ? 'px-2 py-1 rounded-md font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30'
                      : 'px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                  }
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );
  } else {
    const items = buildBreadcrumbItems(pathname).slice(1);
    content = (
      <ol className="flex items-center gap-1">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />}
            {item.isCurrent ? (
              <span aria-current="page" className="font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-blue-600 dark:hover:text-blue-400">{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700">
      <nav
        aria-label="Breadcrumb"
        className="max-w-screen-2xl mx-auto px-4 h-10 flex items-center text-sm text-gray-500 dark:text-gray-400 overflow-x-auto whitespace-nowrap"
      >
        {content}
      </nav>
    </div>
  );
}
