'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Wrench,
  Users,
  AlertTriangle,
  Clock,
  Layers,
  BookOpen,
} from 'lucide-react';

export interface StationMetadata {
  station_id?: string;
  duration_minutes?: number;
  time_block?: string;
  equipment?: string[];
  tracking?: { type: string; log_fields?: string[]; [key: string]: unknown };
  instructor_required?: boolean;
  roles?: string[];
  instructor_tiering?: {
    one_instructor?: string;
    two_instructors?: string;
    three_instructors?: string;
  };
  stress_layers?: string[];
  common_errors?: string[];
  scenario_cards?: Array<Record<string, string>>;
  available_stations?: Array<{
    station_id: string;
    station_name: string;
    category?: string;
    duration_per_student_minutes?: number;
    description?: string;
    equipment?: string[];
  }>;
  available_scenarios?: Array<Record<string, string>>;
}

interface TemplateGuideSectionProps {
  metadata: StationMetadata;
}

export default function TemplateGuideSection({ metadata }: TemplateGuideSectionProps) {
  const [collapsed, setCollapsed] = useState(true);

  const hasTimeBlock = metadata.time_block || metadata.duration_minutes;
  const hasEquipment = metadata.equipment && metadata.equipment.length > 0;
  const hasInstructorTiering =
    metadata.instructor_tiering &&
    (metadata.instructor_tiering.one_instructor ||
      metadata.instructor_tiering.two_instructors ||
      metadata.instructor_tiering.three_instructors);
  const hasRoles = metadata.roles && metadata.roles.length > 0;
  const hasCommonErrors = metadata.common_errors && metadata.common_errors.length > 0;
  const hasScenarioCards = metadata.scenario_cards && metadata.scenario_cards.length > 0;
  const hasAvailableStations =
    metadata.available_stations && metadata.available_stations.length > 0;
  const hasStressLayers = metadata.stress_layers && metadata.stress_layers.length > 0;

  const hasAnySection =
    hasTimeBlock ||
    hasEquipment ||
    hasInstructorTiering ||
    hasRoles ||
    hasCommonErrors ||
    hasScenarioCards ||
    hasAvailableStations ||
    hasStressLayers;

  if (!hasAnySection) return null;

  return (
    <div className="border border-orange-200 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20 rounded-lg">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex items-center justify-between w-full p-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-800 dark:text-orange-300">
          <BookOpen className="w-4 h-4 shrink-0" />
          Template Guide
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
        )}
      </button>

      {/* Collapsible content */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Time Block */}
          {hasTimeBlock && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="w-3 h-3" />
                Time Block
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {metadata.time_block
                  ? metadata.duration_minutes
                    ? `${metadata.time_block} (${metadata.duration_minutes} min)`
                    : metadata.time_block
                  : `${metadata.duration_minutes} min`}
              </p>
            </div>
          )}

          {/* Equipment Needed */}
          {hasEquipment && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Wrench className="w-3 h-3" />
                Equipment Needed
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {metadata.equipment!.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructor Tiering */}
          {hasInstructorTiering && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Users className="w-3 h-3" />
                Instructor Tiering
              </p>
              <div className="space-y-0.5">
                {metadata.instructor_tiering!.three_instructors && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">3 instructors:</span>{' '}
                    {metadata.instructor_tiering!.three_instructors}
                  </p>
                )}
                {metadata.instructor_tiering!.two_instructors && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">2 instructors:</span>{' '}
                    {metadata.instructor_tiering!.two_instructors}
                  </p>
                )}
                {metadata.instructor_tiering!.one_instructor && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">1 instructor:</span>{' '}
                    {metadata.instructor_tiering!.one_instructor}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Team Roles */}
          {hasRoles && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Users className="w-3 h-3" />
                Team Roles
              </p>
              <div className="flex flex-wrap gap-1">
                {metadata.roles!.map((role, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 capitalize"
                  >
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Common Errors */}
          {hasCommonErrors && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <AlertTriangle className="w-3 h-3" />
                Common Errors (Watch For)
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2">
                <ul className="list-disc list-inside space-y-0.5">
                  {metadata.common_errors!.map((err, idx) => (
                    <li key={idx} className="text-sm text-amber-900 dark:text-amber-200">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Scenario Cards */}
          {hasScenarioCards && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <BookOpen className="w-3 h-3" />
                Scenario Cards ({metadata.scenario_cards!.length})
              </p>
              <div className="space-y-1">
                {metadata.scenario_cards!.map((card, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
                  >
                    {Object.entries(card).map(([key, value]) => (
                      <span key={key} className="text-gray-700 dark:text-gray-300">
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                        {value}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Sub-Stations */}
          {hasAvailableStations && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Layers className="w-3 h-3" />
                Available Sub-Stations
              </p>
              <div className="space-y-1.5">
                {metadata.available_stations!.map((sub, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {sub.station_name}
                      </span>
                      {sub.category && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {sub.category}
                        </span>
                      )}
                      {sub.duration_per_student_minutes && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {sub.duration_per_student_minutes} min/student
                        </span>
                      )}
                    </div>
                    {sub.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stress Layers */}
          {hasStressLayers && (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                <Layers className="w-3 h-3" />
                Stress Layers
              </p>
              <div className="flex flex-wrap gap-1">
                {metadata.stress_layers!.map((layer, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
                  >
                    {layer}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
