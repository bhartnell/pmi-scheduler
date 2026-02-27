'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, X, CheckSquare, CalendarDays, FileText, Clock } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-task',
    label: 'New Task',
    icon: CheckSquare,
    href: '/tasks?new=true',
    color: 'bg-purple-600 hover:bg-purple-700',
  },
  {
    id: 'new-lab-day',
    label: 'New Lab Day',
    icon: CalendarDays,
    href: '/lab-management/schedule/new',
    color: 'bg-green-600 hover:bg-green-700',
  },
  {
    id: 'new-scenario',
    label: 'New Scenario',
    icon: FileText,
    href: '/lab-management/scenarios/new',
    color: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    id: 'new-shift',
    label: 'New Shift',
    icon: Clock,
    href: '/scheduling/shifts/new',
    color: 'bg-teal-600 hover:bg-teal-700',
  },
];

export default function QuickActionsMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user role on mount when session is available
  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchRole = async () => {
      try {
        const res = await fetch('/api/instructor/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user?.role) {
            setUserRole(data.user.role);
          }
        }
      } catch {
        // Silently fail — component just won't render
      }
    };

    fetchRole();
  }, [session?.user?.email]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard shortcut: period (.) to toggle, Escape to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't fire in input fields, textareas, selects, or contenteditable
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key === '.' && !isInputField && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = useCallback(
    (href: string) => {
      setIsOpen(false);
      router.push(href);
    },
    [router]
  );

  // Don't render on auth/signin pages
  if (!mounted || pathname.startsWith('/auth')) return null;

  // Only show for instructor and above
  if (!userRole || !hasMinRole(userRole, 'instructor')) return null;

  return (
    <div ref={menuRef} className="fixed bottom-20 right-6 z-40 flex flex-col items-end gap-3 print:hidden">
      {/* Action buttons - stagger upward when open */}
      <div
        className={`flex flex-col items-end gap-2 transition-all duration-200 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        {QUICK_ACTIONS.map((action, index) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              className="flex items-center gap-3 transition-all duration-200"
              style={{
                transitionDelay: isOpen ? `${index * 40}ms` : `${(QUICK_ACTIONS.length - 1 - index) * 30}ms`,
                transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
                opacity: isOpen ? 1 : 0,
              }}
            >
              {/* Label */}
              <span className="px-3 py-1.5 text-sm font-medium text-white bg-gray-800 dark:bg-gray-700 rounded-lg shadow-md whitespace-nowrap">
                {action.label}
              </span>
              {/* Icon button */}
              <button
                onClick={() => handleAction(action.href)}
                className={`flex items-center justify-center w-11 h-11 rounded-full text-white shadow-lg transition-all hover:shadow-xl hover:scale-110 active:scale-95 ${action.color}`}
                aria-label={action.label}
                tabIndex={isOpen ? 0 : -1}
              >
                <Icon className="w-5 h-5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main FAB toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-center w-14 h-14 rounded-full text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105 active:scale-95 ${
          isOpen
            ? 'bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-500'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={isOpen ? 'Close (press . or Esc)' : 'Quick actions (press .)'}
      >
        <span
          className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </span>
      </button>

      {/* Keyboard shortcut hint - shown briefly on render, then fades */}
      {!isOpen && (
        <span aria-hidden="true" className="absolute -top-6 right-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap select-none pointer-events-none">
          press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">.</kbd>
        </span>
      )}
    </div>
  );
}
