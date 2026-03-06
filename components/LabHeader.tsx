'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import Breadcrumbs from '@/components/Breadcrumbs';

interface LabHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  actions?: React.ReactNode;
  /** Display name for a dynamic entity (e.g., lab day title, scenario name) */
  entityTitle?: string;
}

export default function LabHeader({ breadcrumbs, title, actions, entityTitle }: LabHeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top row - Logo and Auth */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo/Home Link */}
          <Link
            href="/"
            aria-label="PMI Paramedic Tools - Go to home"
            className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-lg">PMI</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Lab Management System</div>
            </div>
          </Link>

          {/* Auth info */}
          {session && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block" aria-label={`Signed in as ${session.user?.email}`}>
                {session.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                aria-label="Sign out"
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom row - Breadcrumbs and Title */}
        <div>
          {/* Breadcrumbs - use universal component */}
          <Breadcrumbs entityTitle={entityTitle} className="mb-1" />

          {/* Title and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </div>
      </div>
    </header>
  );
}
