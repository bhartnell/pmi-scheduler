'use client';

import { useState } from 'react';
import {
  Plus,
  Users,
  X,
  Shield,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import CalendarAvailabilityDot from '@/components/CalendarAvailabilityDot';
import { canAccessAdmin } from '@/lib/permissions';
import { useToast } from '@/components/Toast';
import type { LabDayRole, Instructor } from './types';

interface LabDayRolesSectionProps {
  labDayId: string;
  labDayRoles: LabDayRole[];
  instructors: Instructor[];
  userRole: string | null;
  calendarAvailability: Map<string, { status: 'free' | 'busy' | 'partial' | 'disconnected'; events: any[] }>;
  onRolesChange: (roles: LabDayRole[]) => void;
}

export default function LabDayRolesSection({
  labDayId,
  labDayRoles,
  instructors,
  userRole,
  calendarAvailability,
  onRolesChange,
}: LabDayRolesSectionProps) {
  const toast = useToast();
  const [showRoleAssignForm, setShowRoleAssignForm] = useState(false);
  const [roleAssignRole, setRoleAssignRole] = useState<'lab_lead' | 'roamer' | 'observer'>('roamer');
  const [roleAssignInstructorId, setRoleAssignInstructorId] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);

  const handleAddLabDayRole = async () => {
    if (!roleAssignInstructorId || !roleAssignRole) return;
    setAddingRole(true);
    try {
      const res = await fetch('/api/lab-management/lab-day-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          instructor_id: roleAssignInstructorId,
          role: roleAssignRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRolesChange([...labDayRoles, data.role]);
        setRoleAssignInstructorId('');
        setShowRoleAssignForm(false);
        toast?.addToast('success', 'Role assigned successfully');
      } else {
        toast?.addToast('error', data.error || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Error adding lab day role:', error);
      toast?.addToast('error', 'Failed to assign role');
    }
    setAddingRole(false);
  };

  const handleRemoveLabDayRole = async (roleId: string) => {
    setRemovingRoleId(roleId);
    try {
      const res = await fetch(`/api/lab-management/lab-day-roles?id=${roleId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        onRolesChange(labDayRoles.filter(r => r.id !== roleId));
        toast?.addToast('success', 'Role removed');
      } else {
        toast?.addToast('error', data.error || 'Failed to remove role');
      }
    } catch (error) {
      console.error('Error removing lab day role:', error);
      toast?.addToast('error', 'Failed to remove role');
    }
    setRemovingRoleId(null);
  };

  const renderRoleGroup = (
    roles: LabDayRole[],
    label: string,
    description: string,
    colorClasses: { badge: string; remove: string },
    icon?: React.ReactNode
  ) => {
    if (roles.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 normal-case tracking-normal print:hidden"> &mdash; {description}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {roles.map(role => (
            <span
              key={role.id}
              className={`inline-flex items-center gap-1 px-3 py-1 ${colorClasses.badge} rounded-full text-sm font-medium group`}
            >
              {icon}
              {role.instructor?.name || 'Unknown'}
              {role.instructor?.email && calendarAvailability.has(role.instructor.email.toLowerCase()) && (
                <CalendarAvailabilityDot
                  status={calendarAvailability.get(role.instructor.email.toLowerCase())!.status}
                  events={calendarAvailability.get(role.instructor.email.toLowerCase())!.events}
                  size="sm"
                />
              )}
              {userRole && canAccessAdmin(userRole) && (
                <button
                  onClick={() => handleRemoveLabDayRole(role.id)}
                  disabled={removingRoleId === role.id}
                  className={`ml-0.5 ${colorClasses.remove} opacity-0 group-hover:opacity-100 transition-opacity print:hidden`}
                  title="Remove"
                >
                  {removingRoleId === role.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:shadow-none print:border print:border-gray-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Lab Leads &amp; Roamers
        </h3>
        {userRole && canAccessAdmin(userRole) && (
          <button
            onClick={() => setShowRoleAssignForm(!showRoleAssignForm)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {showRoleAssignForm ? 'Cancel' : 'Add'}
          </button>
        )}
      </div>

      {/* Inline Add Role Form */}
      {showRoleAssignForm && userRole && canAccessAdmin(userRole) && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 print:hidden">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
              <select
                value={roleAssignRole}
                onChange={(e) => setRoleAssignRole(e.target.value as 'lab_lead' | 'roamer' | 'observer')}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="lab_lead">Lab Lead</option>
                <option value="roamer">Roamer</option>
                <option value="observer">Observer</option>
              </select>
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
              <select
                value={roleAssignInstructorId}
                onChange={(e) => setRoleAssignInstructorId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select instructor...</option>
                {instructors
                  .filter(inst => !labDayRoles.some(r => r.instructor_id === inst.id && r.role === roleAssignRole))
                  .map(inst => {
                    const avail = inst.email ? calendarAvailability.get(inst.email.toLowerCase()) : undefined;
                    const dot = avail
                      ? avail.status === 'free' ? '\u{1F7E2} '
                      : avail.status === 'partial' ? '\u{1F7E1} '
                      : avail.status === 'busy' ? '\u{1F534} '
                      : '\u26AA '
                      : '';
                    return (
                      <option key={inst.id} value={inst.id}>{dot}{inst.name}</option>
                    );
                  })
                }
              </select>
            </div>
            <button
              onClick={handleAddLabDayRole}
              disabled={addingRole || !roleAssignInstructorId}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {addingRole ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Assign
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Lab Leads oversee the lab and run the timer. Roamers float between stations and grab supplies. Observers shadow or train.
          </p>
        </div>
      )}

      {labDayRoles.length === 0 && !showRoleAssignForm ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic print:hidden">
          No roles assigned.{' '}
          {userRole && canAccessAdmin(userRole) ? (
            <button
              onClick={() => setShowRoleAssignForm(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline not-italic"
            >
              Assign Lab Leads &amp; Roamers
            </button>
          ) : (
            <span>Lab leads and roamers have not been assigned for this lab day.</span>
          )}
        </p>
      ) : (
        <div className="flex flex-wrap gap-6">
          {renderRoleGroup(
            labDayRoles.filter(r => r.role === 'lab_lead'),
            'Lab Lead',
            'oversees lab, runs timer',
            {
              badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 print:bg-amber-100 print:text-amber-800',
              remove: 'text-amber-600 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400',
            },
            <Shield className="w-3 h-3" />
          )}
          {renderRoleGroup(
            labDayRoles.filter(r => r.role === 'roamer'),
            'Roamer',
            'floats between stations, grabs supplies',
            {
              badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 print:bg-blue-100 print:text-blue-800',
              remove: 'text-blue-600 dark:text-blue-400 hover:text-red-600 dark:hover:text-red-400',
            },
            <RotateCcw className="w-3 h-3" />
          )}
          {renderRoleGroup(
            labDayRoles.filter(r => r.role === 'observer'),
            'Observer',
            'shadowing / training',
            {
              badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 print:bg-purple-100 print:text-purple-800',
              remove: 'text-purple-600 dark:text-purple-400 hover:text-red-600 dark:hover:text-red-400',
            }
          )}
        </div>
      )}
    </div>
  );
}
