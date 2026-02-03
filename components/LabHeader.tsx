'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { LogOut, Home } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

interface LabHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  actions?: React.ReactNode;
}

export default function LabHeader({ breadcrumbs = [], title, actions }: LabHeaderProps) {
  const { data: session } = useSession();

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Top row - Logo and Auth */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo/Home Link */}
          <Link
            href="/"
            className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
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
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom row - Breadcrumbs and Title */}
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-gray-400 dark:text-gray-500">/</span>
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">/</span>
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-blue-600 dark:hover:text-blue-400">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-900 dark:text-white">{crumb.label}</span>
                )}
              </span>
            ))}
          </div>

          {/* Title and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
