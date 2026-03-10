'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Eye, ChevronDown, Check } from 'lucide-react';
import { useRolePreview } from './RolePreviewProvider';
import { canAccessAdmin, getRoleLabel, type Role } from '@/lib/permissions';

const PREVIEWABLE_ROLES: Role[] = [
  'lead_instructor',
  'agency_liaison',
  'instructor',
  'volunteer_instructor',
  'program_director',
  'agency_observer',
  'student',
  'guest',
];

export default function RolePreviewSelector() {
  const { data: session } = useSession();
  const { startPreview, isPreviewMode, previewRole, exitPreview } = useRolePreview();
  const [realRole, setRealRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.role) {
          setRealRole(data.user.role);
        }
      })
      .catch(() => {});
  }, [session?.user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (!realRole || !canAccessAdmin(realRole)) return null;

  return (
    <div ref={ref} className="fixed bottom-4 right-20 z-[100] print:hidden">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg shadow-lg transition-colors ${
          isPreviewMode
            ? 'bg-orange-600 text-white hover:bg-orange-700'
            : 'bg-gray-800 text-gray-200 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
        }`}
        title="Preview as another role"
      >
        <Eye className="w-3.5 h-3.5" />
        {isPreviewMode ? getRoleLabel(previewRole!) : 'Preview'}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Preview as Role
          </div>
          {PREVIEWABLE_ROLES.map(role => (
            <button
              key={role}
              onClick={() => {
                startPreview(role);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                previewRole === role
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {getRoleLabel(role)}
              {previewRole === role && <Check className="w-4 h-4" />}
            </button>
          ))}
          {isPreviewMode && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <button
                onClick={() => {
                  exitPreview();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
              >
                Exit Preview
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
