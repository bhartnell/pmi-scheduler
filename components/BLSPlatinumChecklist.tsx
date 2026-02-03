'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, Square, ClipboardCheck } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  category: string;
  certification_levels: string[];
}

interface AssignedSkill {
  skill: Skill;
  assignedStations: {
    id: string;
    station_number: number;
    custom_title: string | null;
  }[];
}

interface BLSPlatinumChecklistProps {
  labDayId: string;
  currentStationId?: string;
  selectedSkillIds: string[];
  onToggleSkill?: (skillId: string) => void;
  readOnly?: boolean;
}

// Define BLS/Platinum skills - these are the core skills that should be tracked
const BLS_PLATINUM_SKILLS = [
  'Airway Management',
  'BVM Ventilation',
  'CPR / High Performance CPR',
  'AED Operation',
  'Spinal Motion Restriction',
  'Hemorrhage Control',
  'Splinting',
  'Patient Assessment',
  'Vital Signs',
  'Oxygen Administration',
  'Suctioning',
  'OPA/NPA Insertion',
  'Bandaging',
  'Patient Lifting/Moving',
  'Scene Safety Assessment',
];

export default function BLSPlatinumChecklist({
  labDayId,
  currentStationId,
  selectedSkillIds,
  onToggleSkill,
  readOnly = false,
}: BLSPlatinumChecklistProps) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [assignedSkillsMap, setAssignedSkillsMap] = useState<Map<string, AssignedSkill>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [labDayId]);

  const fetchData = async () => {
    try {
      // Fetch all skills from library
      const skillsRes = await fetch('/api/lab-management/skills');
      const skillsData = await skillsRes.json();

      // Fetch skills already assigned to any station on this lab day
      const labDaySkillsRes = await fetch(`/api/lab-management/lab-day-skills?labDayId=${labDayId}`);
      const labDaySkillsData = await labDaySkillsRes.json();

      if (skillsData.success) {
        // Filter to only show BLS/Platinum category skills or those in our predefined list
        const blsSkills = (skillsData.skills || []).filter((skill: Skill) =>
          skill.category === 'BLS' ||
          skill.category === 'Platinum' ||
          skill.category === 'BLS/Platinum' ||
          BLS_PLATINUM_SKILLS.some(name =>
            skill.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(skill.name.toLowerCase())
          )
        );
        setAllSkills(blsSkills);
      }

      if (labDaySkillsData.success) {
        const map = new Map<string, AssignedSkill>();
        for (const as of (labDaySkillsData.assignedSkills || [])) {
          map.set(as.skill.id, as);
        }
        setAssignedSkillsMap(map);
      }
    } catch (error) {
      console.error('Failed to fetch skills data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (allSkills.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center text-gray-500 dark:text-gray-400">
        <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No BLS/Platinum skills defined in the library</p>
      </div>
    );
  }

  // Count assigned vs total
  const assignedToOtherStations = allSkills.filter(skill => {
    const assigned = assignedSkillsMap.get(skill.id);
    if (!assigned) return false;
    // Check if assigned to a station OTHER than current one
    return assigned.assignedStations.some(s => s.id !== currentStationId);
  }).length;

  const assignedToCurrentStation = selectedSkillIds.length;
  const totalSkills = allSkills.length;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
        <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-green-600" />
          BLS / Platinum Skills Checklist
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {assignedToOtherStations + assignedToCurrentStation} of {totalSkills} skills assigned for this lab day
        </p>
      </div>

      {/* Skills List */}
      <div className="p-3 max-h-64 overflow-y-auto space-y-1">
        {allSkills.map(skill => {
          const assignedInfo = assignedSkillsMap.get(skill.id);
          const isSelectedHere = selectedSkillIds.includes(skill.id);

          // Check if assigned to other stations (not current)
          const assignedElsewhere = assignedInfo?.assignedStations.filter(
            s => s.id !== currentStationId
          ) || [];
          const isAssignedElsewhere = assignedElsewhere.length > 0;

          return (
            <div
              key={skill.id}
              className={`flex items-center gap-2 p-2 rounded ${
                isSelectedHere
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : isAssignedElsewhere
                  ? 'bg-gray-100 dark:bg-gray-600/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600/30'
              }`}
            >
              {/* Checkbox or indicator */}
              {readOnly ? (
                isSelectedHere || isAssignedElsewhere ? (
                  <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )
              ) : (
                <input
                  type="checkbox"
                  checked={isSelectedHere}
                  onChange={() => onToggleSkill?.(skill.id)}
                  disabled={isAssignedElsewhere}
                  className="w-4 h-4 text-green-600 rounded flex-shrink-0"
                />
              )}

              {/* Skill name */}
              <span
                className={`text-sm flex-1 ${
                  isAssignedElsewhere && !isSelectedHere
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : isSelectedHere
                    ? 'text-green-800 dark:text-green-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {skill.name}
              </span>

              {/* Station indicator */}
              {(isAssignedElsewhere || isSelectedHere) && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {isSelectedHere && 'This station'}
                  {isSelectedHere && isAssignedElsewhere && ', '}
                  {isAssignedElsewhere && (
                    assignedElsewhere.map(s => `Stn ${s.station_number}`).join(', ')
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-0.5 bg-gray-400 line-through"></span>
          = assigned to another station
        </span>
      </div>
    </div>
  );
}
