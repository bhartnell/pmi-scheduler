'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode, type ElementType } from 'react';

/**
 * CollapsibleCard — uniform expand/collapse wrapper used across the
 * internship detail page.
 *
 * Card structure:
 *   ┌─ button (header) ────────────────────────────────────┐
 *   │  [icon]  Title           [accentChip]  [chevron]    │
 *   ├──────────────────────────────────────────────────────┤
 *   │  children (only rendered when open)                  │
 *   └──────────────────────────────────────────────────────┘
 *
 * Controlled OR uncontrolled:
 *   - Pass `open` + `onToggle` to control externally (Review All toggle).
 *   - Pass only `defaultOpen` to let the component manage its own state.
 *   - The `id` prop becomes the DOM id so deep links / scroll targets
 *     work (e.g. `<a href="#placement-detail">`).
 *
 * The `headerBg` prop accepts Tailwind class strings so each card can
 * keep its existing accent color (blue for Placement, amber for Exams,
 * green for Closeout, etc).
 */
export interface CollapsibleCardProps {
  id?: string;
  title: ReactNode;
  /** Optional icon shown to the left of the title. */
  icon?: ElementType;
  /** Class string for the icon (color/size). */
  iconClassName?: string;
  /** Tailwind class string for the header background tint. */
  headerBg?: string;
  /** Optional content rendered to the right of the title (e.g. "75%" badge). */
  accent?: ReactNode;
  /** Initial open state when uncontrolled. Default false. */
  defaultOpen?: boolean;
  /** External controlled state. Pass with onToggle. */
  open?: boolean;
  /** Called when the user clicks the header. */
  onToggle?: (next: boolean) => void;
  /** Disables the toggle button (renders as static header). */
  locked?: boolean;
  children?: ReactNode;
  /** Extra classes on the outer wrapper (border accents, etc). */
  className?: string;
}

export default function CollapsibleCard({
  id,
  title,
  icon: Icon,
  iconClassName = 'w-5 h-5 text-gray-500',
  headerBg = 'bg-gray-50 dark:bg-gray-700/30',
  accent,
  defaultOpen = false,
  open,
  onToggle,
  locked = false,
  children,
  className = '',
}: CollapsibleCardProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);

  // Keep internal in sync if a parent later flips defaultOpen (rare but
  // covers Review All scenarios where uncontrolled cards still need to
  // respond to a global expand-all).
  useEffect(() => {
    if (!isControlled) setInternalOpen(defaultOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen]);

  const isOpen = isControlled ? !!open : internalOpen;

  const handleToggle = () => {
    if (locked) return;
    const next = !isOpen;
    if (isControlled) {
      onToggle?.(next);
    } else {
      setInternalOpen(next);
      onToggle?.(next);
    }
  };

  return (
    <div
      id={id}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden scroll-mt-4 ${className}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={locked}
        className={`w-full px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${headerBg} flex items-center justify-between gap-2 ${
          locked ? 'cursor-default' : 'hover:opacity-90'
        }`}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={iconClassName} />}
          <span className="font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {accent}
          {!locked &&
            (isOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            ))}
        </span>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}
