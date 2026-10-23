'use client';

import { useEffect, useSyncExternalStore } from 'react';

export interface BreadcrumbNameState {
  entityTitle?: string;
  customSegments?: Record<string, string>;
  /** Overrides the link target of a crumb, keyed by its path without the leading slash. */
  customHrefs?: Record<string, string>;
}

const EMPTY: BreadcrumbNameState = {};
let current: BreadcrumbNameState = EMPTY;
const listeners = new Set<() => void>();

function publish(next: BreadcrumbNameState) {
  current = next;
  listeners.forEach((l) => l());
}

/** Record names for the app-wide SubNavLine (TRIM 6/7b-1c). Read by SubNavLine. */
export function useBreadcrumbNames(): BreadcrumbNameState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => EMPTY,
  );
}

/**
 * Renders nothing. A page mounts this to give the line under the top bar the
 * name of the record it shows (e.g. the lab day title) in place of "Detail".
 * Replaces the per-page Breadcrumbs component.
 */
export default function BreadcrumbNames({ entityTitle, customSegments, customHrefs }: BreadcrumbNameState) {
  const segKey = customSegments ? JSON.stringify(customSegments) : '';
  const hrefKey = customHrefs ? JSON.stringify(customHrefs) : '';
  useEffect(() => {
    publish({
      entityTitle,
      customSegments: segKey ? JSON.parse(segKey) : undefined,
      customHrefs: hrefKey ? JSON.parse(hrefKey) : undefined,
    });
    return () => publish(EMPTY);
  }, [entityTitle, segKey, hrefKey]);
  return null;
}
