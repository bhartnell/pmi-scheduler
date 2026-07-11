'use client';

import { Users, Loader2 } from 'lucide-react';
import type { InstructorAvailabilityEntry } from './types';

interface AvailableInstructorsSectionProps {
  instructorAvailability: InstructorAvailabilityEntry[];
  loading: boolean;
}

/**
 * At-a-glance "who's available today" panel for the lab day detail page.
 * Consumes the single lab-day-level fetch of
 * GET /api/lab-management/instructor-availability (see page.tsx) — does
 * NOT fetch per station. Read-only: this is purely a summary view over the
 * same classification EditStationModal / LabDayRolesSection use to filter
 * their instructor pickers.
 */
export default function AvailableInstructorsSection({
  instructorAvailability,
  loading,
}: AvailableInstructorsSectionProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:hidden">
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking instructor availability...
        </div>
      </div>
    );
  }

  if (instructorAvailability.length === 0) return null;

  const available = instructorAvailability.filter(i => i.group === 'available');
  const volunteers = instructorAvailability.filter(i => i.group === 'volunteer');
  const conflicts = instructorAvailability.filter(i => i.group === 'conflict');
  const noData = instructorAvailability.filter(i => i.group === 'no_availability');
  const totalCount = available.length + volunteers.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:hidden">
      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
        Available Today
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
          ({totalCount} instructor{totalCount !== 1 ? 's' : ''})
        </span>
      </h3>

      {totalCount === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No instructors have submitted availability or volunteered for this lab day yet.
        </p>
      ) : (
        // Desktop-first / wide: two columns side by side by default, collapse
        // to one column only on small screens (see CLAUDE.md UI Layout Rule).
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Available ({available.length})
              </span>
            </div>
            {available.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {available.map(i => (
                  <span
                    key={i.id}
                    className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium"
                  >
                    {i.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No one has submitted availability for this window.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Volunteering ({volunteers.length})
              </span>
            </div>
            {volunteers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {volunteers.map(i => (
                  <span
                    key={i.id}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                  >
                    {i.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No volunteer signups yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Conflict and no-data instructors are shown separately, clearly
          labeled with the reason — never lumped into a bare "unavailable"
          bucket (the earlier confusion: everyone showed unavailable
          because of Pima Tuesday-class conflicts + sparse seeded data). */}
      {conflicts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Has a conflict ({conflicts.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {conflicts.map(i => {
              const reason = i.conflicts[0]?.title;
              const extra = i.conflicts.length > 1 ? ` +${i.conflicts.length - 1} more` : '';
              return (
                <span
                  key={i.id}
                  className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
                  title={reason ? `${reason}${extra}` : undefined}
                >
                  {i.name}
                  {reason && <span className="font-normal opacity-75"> — {reason}{extra}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {noData.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              No availability submitted ({noData.length})
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {noData.map(i => i.name).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
