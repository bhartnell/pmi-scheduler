'use client';

import { useState } from 'react';
import {
  X,
  Save,
} from 'lucide-react';
import type { Station, Student, ScenarioParticipation } from './types';

interface ScenarioRoleModalProps {
  station: Station;
  labDayId: string;
  labDayDate: string;
  cohortStudents: Student[];
  scenarioParticipation: ScenarioParticipation[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ScenarioRoleModal({
  station,
  labDayId,
  labDayDate,
  cohortStudents,
  scenarioParticipation,
  onClose,
  onSaved,
}: ScenarioRoleModalProps) {
  const [savingRoles, setSavingRoles] = useState(false);

  // Pre-fill existing role assignments for this scenario on this lab day
  const existingRoles = scenarioParticipation.filter(
    sp => sp.scenario_id === station.scenario?.id && sp.lab_day_id === labDayId
  );

  const prefilledRoles: Record<string, string> = {
    team_lead: '',
    med_tech: '',
    monitor_tech: '',
    airway_tech: '',
    observer: ''
  };

  existingRoles.forEach(sp => {
    if (sp.role && sp.student_id) {
      prefilledRoles[sp.role] = sp.student_id;
    }
  });

  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>(prefilledRoles);

  const handleSaveRoles = async () => {
    if (!station.scenario) return;
    setSavingRoles(true);
    try {
      const rolesToLog = Object.entries(roleAssignments).filter(([_, studentId]) => studentId);

      for (const [role, studentId] of rolesToLog) {
        await fetch('/api/tracking/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            scenario_id: station.scenario.id,
            scenario_name: station.scenario.title,
            role: role,
            lab_day_id: labDayId,
            date: labDayDate
          })
        });
      }

      onSaved();
      alert(`Successfully logged ${rolesToLog.length} role assignment(s)`);
    } catch (error) {
      console.error('Error saving roles:', error);
      alert('Failed to save roles');
    }
    setSavingRoles(false);
  };

  if (!station.scenario) return null;

  const roleLabels: Record<string, string> = {
    team_lead: 'Team Lead',
    med_tech: 'Med Tech',
    monitor_tech: 'Monitor Tech',
    airway_tech: 'Airway Tech',
    observer: 'Observer',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Log Scenario Roles
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {station.scenario.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {Object.entries(roleLabels).map(([roleKey, label]) => (
            <div key={roleKey}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
              </label>
              <select
                value={roleAssignments[roleKey] || ''}
                onChange={(e) => setRoleAssignments(prev => ({ ...prev, [roleKey]: e.target.value }))}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              >
                <option value="">Select student...</option>
                {cohortStudents.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.last_name}, {student.first_name}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Previously logged roles for this scenario */}
          {existingRoles.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">
                Previously Logged
              </h4>
              <div className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                {existingRoles.map(sp => (
                  <div key={sp.id}>
                    {sp.role.replace(/_/g, ' ')}: {sp.student?.last_name}, {sp.student?.first_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveRoles}
            disabled={savingRoles || !Object.values(roleAssignments).some(v => v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {savingRoles ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            Log All
          </button>
        </div>
      </div>
    </div>
  );
}
