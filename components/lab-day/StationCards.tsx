'use client';

import Link from 'next/link';
import {
  Users,
  MapPin,
  FileText,
  ExternalLink,
  ClipboardCheck,
  Edit2,
  Plus,
} from 'lucide-react';
import type { Station, SkillDocument } from './types';
import { STATION_TYPE_COLORS, STATION_TYPE_BADGES } from './types';
import CalendarAvailabilityDot from '@/components/CalendarAvailabilityDot';
import TemplateGuideSection from '@/components/TemplateGuideSection';

interface StationCardsProps {
  stations: Station[];
  stationSkillDocs: Record<string, SkillDocument[]>;
  stationSkillSheetIds: Record<string, string>;
  calendarAvailability: Map<string, { status: 'free' | 'partial' | 'busy' | 'disconnected'; events: { title: string; start: string; end: string }[] }>;
  labDayId: string;
  getStationTitle: (station: Station) => string;
  onEditStation: (station: Station) => void;
  onOpenRoleModal: (station: Station) => void;
}

export default function StationCards({
  stations,
  stationSkillDocs,
  stationSkillSheetIds,
  calendarAvailability,
  labDayId,
  getStationTitle,
  onEditStation,
  onOpenRoleModal,
}: StationCardsProps) {
  if (stations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Stations Yet</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Add stations to this lab day to get started.</p>
        <Link
          href={`/lab-management/schedule/${labDayId}/stations/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add First Station
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stations.map((station) => (
        <div
          key={station.id}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 ${STATION_TYPE_COLORS[station.station_type] || 'border-gray-200 dark:border-gray-700'}`}
        >
          <div className="p-4">
            {/* Station Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    Station {station.station_number}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATION_TYPE_BADGES[station.station_type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {station.station_type}
                  </span>
                  {station.platinum_required && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                      Platinum
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {getStationTitle(station)}
                </h3>
                {station.scenario && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{station.scenario.category}</p>
                )}
              </div>
            </div>

            {/* Station Details */}
            <div className="space-y-2 text-sm mb-4">
              {(station.instructor_name || station.instructor?.name) && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{station.instructor_name || station.instructor?.name}</span>
                  {station.instructor_email && calendarAvailability.has(station.instructor_email.toLowerCase()) && (
                    <CalendarAvailabilityDot
                      status={calendarAvailability.get(station.instructor_email.toLowerCase())!.status}
                      events={calendarAvailability.get(station.instructor_email.toLowerCase())!.events}
                      size="sm"
                    />
                  )}
                </div>
              )}
              {(station.room || station.location) && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{station.room || station.location}</span>
                </div>
              )}
              {station.documentation_required && (
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <FileText className="w-4 h-4" />
                  <span>Documentation required</span>
                </div>
              )}
            </div>

            {/* Document Links */}
            {(station.skill_sheet_url || station.instructions_url || (stationSkillDocs[station.id] && stationSkillDocs[station.id].length > 0)) && (
              <div className="flex flex-wrap gap-2 mb-3 print:hidden">
                {station.skill_sheet_url && (
                  <a
                    href={station.skill_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <FileText className="w-3 h-3" />
                    Skill Sheet
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {station.instructions_url && (
                  <a
                    href={station.instructions_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50"
                  >
                    <FileText className="w-3 h-3" />
                    Instructions
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {stationSkillDocs[station.id] && stationSkillDocs[station.id].map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50"
                  >
                    <FileText className="w-3 h-3" />
                    {doc.document_name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}

            {/* View Skill Sheet (from skill_sheets table lookup) */}
            {stationSkillSheetIds[station.id] ? (
              <div className="mb-3 print:hidden">
                <Link
                  href={`/skill-sheets/${stationSkillSheetIds[station.id]}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <ClipboardCheck className="w-3 h-3" />
                  View Skill Sheet
                </Link>
              </div>
            ) : (station.skill_name || station.scenario?.title) ? (
              <div className="mb-3 print:hidden">
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">No skill sheet available</span>
              </div>
            ) : null}

            {/* Template Guide (from applied template metadata) */}
            {station.metadata && Object.keys(station.metadata).length > 0 && (
              <div className="mb-3">
                <TemplateGuideSection metadata={station.metadata} />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t dark:border-gray-700 print:hidden">
              <button
                onClick={() => onEditStation(station)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              {station.scenario && (
                <>
                  <Link
                    href={`/lab-management/scenarios/${station.scenario.id}`}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <FileText className="w-4 h-4" />
                    Scenario
                  </Link>
                  <button
                    onClick={() => onOpenRoleModal(station)}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Users className="w-4 h-4" />
                    Log Roles
                  </button>
                </>
              )}
              <Link
                href={`/lab-management/grade/station/${station.id}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <ClipboardCheck className="w-4 h-4" />
                Grade
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
