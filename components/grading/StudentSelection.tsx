'use client';

import Link from 'next/link';
import { Users, Star } from 'lucide-react';
import StudentPicker from '@/components/StudentPicker';
import type { Student, LabGroup, Station } from './types';

interface StudentSelectionProps {
  isSkillsStation: boolean;
  station: Station;
  allStudents: Student[];
  labGroups: LabGroup[];
  selectedGroupId: string;
  selectedStudentId: string;
  teamLeaderId: string;
  rotationNumber: number;
  onSetSelectedGroupId: (id: string) => void;
  onSetSelectedStudentId: (id: string) => void;
  onSetTeamLeaderId: (id: string) => void;
  onSetRotationNumber: (num: number) => void;
  triggerAutoSave: () => void;
}

export default function StudentSelection({
  isSkillsStation,
  station,
  allStudents,
  labGroups,
  selectedGroupId,
  selectedStudentId,
  teamLeaderId,
  rotationNumber,
  onSetSelectedGroupId,
  onSetSelectedStudentId,
  onSetTeamLeaderId,
  onSetRotationNumber,
  triggerAutoSave,
}: StudentSelectionProps) {
  const selectedGroup = labGroups.find(g => g.id === selectedGroupId);

  if (isSkillsStation) {
    return (
      /* Skills Station: Simple student dropdown */
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
          Select Student
        </h2>

        {/* Student Selection with Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student</label>
          {allStudents.length === 0 ? (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Loading students...
              </p>
            </div>
          ) : (
            <StudentPicker
              students={allStudents}
              value={selectedStudentId}
              onChange={(id) => {
                onSetSelectedStudentId(id);
                triggerAutoSave();
              }}
              placeholder="Select a student..."
            />
          )}
        </div>

        {/* Rotation Number (optional for skills) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rotation <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  onSetRotationNumber(num);
                  triggerAutoSave();
                }}
                className={`w-12 h-12 rounded-lg font-medium ${
                  rotationNumber === num
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    /* Scenario Station: Group & Team Lead Selection */
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Select Group & Team Lead
      </h2>

      {/* Rotation Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rotation Number</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => {
                onSetRotationNumber(num);
                triggerAutoSave();
              }}
              className={`w-12 h-12 rounded-lg font-medium ${
                rotationNumber === num
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Lab Group Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lab Group</label>
        {labGroups.length === 0 ? (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              No lab groups found for this cohort.
              <Link href={`/lab-management/cohorts/${station.lab_day.cohort.id}/groups`} className="underline ml-1">
                Create groups first
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {labGroups.map(group => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  onSetSelectedGroupId(group.id);
                  onSetTeamLeaderId('');
                  triggerAutoSave();
                }}
                className={`p-3 rounded-lg border-2 text-left ${
                  selectedGroupId === group.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">{group.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{group.members?.length || 0} students</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Team Lead Selection */}
      {selectedGroup && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Team Leader <Star className="w-4 h-4 inline text-yellow-500" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {selectedGroup.members?.map(member => (
              <button
                key={member.student.id}
                type="button"
                onClick={() => {
                  onSetTeamLeaderId(member.student.id);
                  triggerAutoSave();
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                  teamLeaderId === member.student.id
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden shrink-0">
                  {member.student.photo_url ? (
                    <img src={member.student.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {member.student.first_name[0]}{member.student.last_name[0]}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {member.student.first_name} {member.student.last_name}
                  </div>
                  {teamLeaderId === member.student.id && (
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <Star className="w-3 h-3" /> Team Lead
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
