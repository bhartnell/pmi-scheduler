'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';

/**
 * Lookup map for route segments to human-readable labels.
 * Keys are the full path (without leading slash).
 */
const ROUTE_LABELS: Record<string, string> = {
  '': 'Home',
  'lab-management': 'Lab Management',
  'lab-management/schedule': 'Schedule',
  'lab-management/scenarios': 'Scenarios',
  'lab-management/skill-sheets': 'Skill Sheets',
  'lab-management/skill-drills': 'Skill Drills',
  'lab-management/templates': 'Templates',
  'lab-management/students': 'Students',
  'lab-management/cohorts': 'Cohorts',
  'lab-management/reports': 'Reports',
  'lab-management/admin': 'Lab Admin',
  'lab-management/seating': 'Seating',
  'lab-management/grade': 'Grading',
  'lab-management/peer-evals': 'Peer Evaluations',
  'lab-management/mentorship': 'Mentorship',
  'lab-management/skills': 'Skills',
  'lab-management/skills/competencies': 'Competencies',
  'clinical': 'Clinical',
  'clinical/internships': 'Internships',
  'clinical/hours': 'Clinical Hours',
  'clinical/preceptors': 'Preceptors',
  'clinical/compliance': 'Compliance',
  'clinical/site-visits': 'Site Visits',
  'clinical/summative-evaluations': 'Summative Evaluations',
  'clinical/affiliations': 'Affiliations',
  'clinical/agencies': 'Agencies',
  'scheduling': 'Scheduling',
  'scheduling/availability': 'Availability',
  'scheduling/shifts': 'Shifts',
  'scheduling/reports': 'Reports',
  'tasks': 'Tasks',
  'admin': 'Admin',
  'admin/users': 'Users',
  'admin/osce-events': 'OSCE Events',
  'admin/osce-observers': 'OSCE Observers',
  'admin/settings': 'Settings',
  'instructor': 'Instructor Portal',
  'calendar': 'Calendar',
  'settings': 'Settings',
  'notifications': 'Notifications',
};

/** Check if a segment looks like a UUID or dynamic ID */
function isDynamicSegment(segment: string): boolean {
  // UUID pattern
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  // Numeric IDs
  if (/^\d+$/.test(segment)) {
    return true;
  }
  // Short hex IDs
  if (/^[0-9a-f]{16,}$/i.test(segment)) {
    return true;
  }
  return false;
}

export interface BreadcrumbsProps {
  /** Display name for the last dynamic segment (e.g., a scenario title or lab day title) */
  entityTitle?: string;
  /** Override labels for specific path segments */
  customSegments?: Record<string, string>;
  /** Additional CSS class for the nav element */
  className?: string;
}

export default function Breadcrumbs({ entityTitle, customSegments, className }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Build breadcrumb items from the current pathname
  const segments = pathname.split('/').filter(Boolean);

  interface BreadcrumbItem {
    label: string;
    href: string;
    isCurrent: boolean;
  }

  const items: BreadcrumbItem[] = [];

  // Always start with Home
  items.push({ label: 'Home', href: '/', isCurrent: segments.length === 0 });

  // Build up breadcrumb items for each path segment
  for (let i = 0; i < segments.length; i++) {
    const pathUpToHere = segments.slice(0, i + 1).join('/');
    const href = '/' + pathUpToHere;
    const isLast = i === segments.length - 1;
    const segment = segments[i];

    // Check custom segments first (by full path or segment name)
    if (customSegments?.[pathUpToHere]) {
      items.push({ label: customSegments[pathUpToHere], href, isCurrent: isLast });
    } else if (customSegments?.[segment]) {
      items.push({ label: customSegments[segment], href, isCurrent: isLast });
    }
    // Check the lookup map
    else if (ROUTE_LABELS[pathUpToHere]) {
      items.push({ label: ROUTE_LABELS[pathUpToHere], href, isCurrent: isLast });
    }
    // Handle known sub-pages like "new"
    else if (segment === 'new') {
      items.push({ label: 'New', href, isCurrent: isLast });
    }
    // Handle dynamic segments
    else if (isDynamicSegment(segment)) {
      if (isLast && entityTitle) {
        items.push({ label: entityTitle, href, isCurrent: true });
      } else if (entityTitle && i === segments.length - 2) {
        // If there is an entityTitle and this is not the last, use the entity title
        items.push({ label: entityTitle, href, isCurrent: false });
      } else {
        // Skip or show a generic label
        items.push({ label: 'Detail', href, isCurrent: isLast });
      }
    }
    // Fallback: capitalize the segment
    else {
      const label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      items.push({ label, href, isCurrent: isLast });
    }
  }

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 list-none p-0 m-0 flex-wrap">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden="true" />
            )}
            {item.isCurrent ? (
              <span
                className="text-gray-900 dark:text-white font-medium"
                aria-current="page"
              >
                {index === 0 && <Home className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
              >
                {index === 0 && <Home className="w-3.5 h-3.5" aria-hidden="true" />}
                {index === 0 ? (
                  <>
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sr-only sm:hidden">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
