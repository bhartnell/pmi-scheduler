'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, X, Loader2, Plus, ChevronDown } from 'lucide-react';
import CalendarAvailabilityDot from '@/components/CalendarAvailabilityDot';
import { canAccessAdmin } from '@/lib/permissions';
import { useToast } from '@/components/Toast';
import type { LabDayRole, Instructor, InstructorAvailabilityEntry } from './types';
import LabDayRolesSection from './LabDayRolesSection';
import { buildAvailabilityMap, getAvailInfo, availabilitySuffix } from './instructorAvailability';

interface Person {
  key: string;
  name: string;
  email: string | null;
  group: 'full_time' | 'part_time' | 'other';
  tags: string[];
  role_ids: string[];
  from_other_sources: boolean;
}

interface WhosComingBlockProps {
  labDayId: string;
  labDayRoles: LabDayRole[];
  instructors: Instructor[];
  userRole: string | null;
  calendarAvailability: Map<string, { status: 'free' | 'busy' | 'partial' | 'disconnected'; events: any[] }>;
  instructorAvailability: InstructorAvailabilityEntry[];
  onRolesChange: (roles: LabDayRole[]) => void;
}

const GROUP_LABELS: Record<Person['group'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time and volunteers',
  other: 'Other',
};

const OTHER_VALUE = '__other__';

/**
 * Single "Who's coming (n)" block for the lab day page. Replaces the separate
 * Lab Leads & Roamers card and Volunteers row. Adds and removes write
 * lab_day_roles through the existing roles endpoint, which already creates /
 * removes the instructor's Google Calendar event.
 */
export default function WhosComingBlock({
  labDayId,
  labDayRoles,
  instructors,
  userRole,
  calendarAvailability,
  instructorAvailability,
  onRolesChange,
}: WhosComingBlockProps) {
  const toast = useToast();
  const canEdit = !!userRole && canAccessAdmin(userRole);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showLeads, setShowLeads] = useState(false);
  const [selected, setSelected] = useState('');
  const [otherName, setOtherName] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const availabilityMap = useMemo(() => buildAvailabilityMap(instructorAvailability), [instructorAvailability]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/whos-coming`);
      const data = await res.json();
      if (data.success) setPeople(data.people || []);
    } catch (error) {
      console.error('Error loading who is coming:', error);
    } finally {
      setLoading(false);
    }
  }, [labDayId]);

  // Reload whenever the shared roles list changes (leads/roamers form below,
  // or an add/remove here) so every writer converges on one list.
  useEffect(() => {
    load();
  }, [load, labDayRoles]);

  const handleAdd = async () => {
    const isOther = selected === OTHER_VALUE;
    if (!selected || (isOther && !otherName.trim())) return;
    setAdding(true);
    try {
      const res = await fetch('/api/lab-management/lab-day-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          role: 'attending',
          ...(isOther ? { other_name: otherName.trim() } : { instructor_id: selected }),
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRolesChange([...labDayRoles, data.role]);
        setSelected('');
        setOtherName('');
        setShowAdd(false);
        toast?.addToast('success', isOther ? 'Added' : 'Added, invite sent');
      } else {
        toast?.addToast('error', data.error || 'Failed to add');
      }
    } catch (error) {
      console.error('Error adding attendee:', error);
      toast?.addToast('error', 'Failed to add');
    }
    setAdding(false);
  };

  const handleRemove = async (p: Person) => {
    setRemovingKey(p.key);
    try {
      let failed = false;
      for (const id of p.role_ids) {
        const res = await fetch(`/api/lab-management/lab-day-roles?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!data.success) {
          failed = true;
          toast?.addToast('error', data.error || 'Failed to remove');
          break;
        }
      }
      if (!failed) {
        const gone = new Set(p.role_ids);
        onRolesChange(labDayRoles.filter(r => !gone.has(r.id)));
        toast?.addToast('success', 'Removed');
      }
    } catch (error) {
      console.error('Error removing attendee:', error);
      toast?.addToast('error', 'Failed to remove');
    }
    setRemovingKey(null);
  };

  // Dropdown: part-timers and volunteers first, full-timers further down.
  // Everyone already on the day is left out.
  const onDayEmails = new Set(people.map(p => p.email?.toLowerCase()).filter(Boolean) as string[]);
  const candidates = instructors.filter(i => !onDayEmails.has(i.email?.toLowerCase()));
  const isPartTimer = (i: Instructor) => !!i.is_part_time || i.role === 'volunteer_instructor';
  const partTimers = candidates.filter(isPartTimer);
  const fullTimers = candidates.filter(i => !isPartTimer(i));
  const renderOption = (inst: Instructor) => {
    const calAvail = inst.email ? calendarAvailability.get(inst.email.toLowerCase()) : undefined;
    const dot = calAvail
      ? calAvail.status === 'free' ? '\u{1F7E2} '
      : calAvail.status === 'partial' ? '\u{1F7E1} '
      : calAvail.status === 'busy' ? '\u{1F534} '
      : '⚪ '
      : '';
    return (
      <option key={inst.id} value={inst.id}>
        {dot}{inst.name}{availabilitySuffix(getAvailInfo(availabilityMap, inst))}
      </option>
    );
  };

  const groups = (['full_time', 'part_time', 'other'] as const)
    .map(g => ({ g, list: people.filter(p => p.group === g) }))
    .filter(x => x.list.length > 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:shadow-none print:border print:border-gray-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Who&apos;s coming ({people.length})
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
        </h3>
        {canEdit && (
          <div className="flex items-center gap-4 print:hidden">
            <button
              onClick={() => setShowLeads(v => !v)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 min-h-[44px]"
              aria-expanded={showLeads}
            >
              Assign Lab Leads &amp; Roamers
              <ChevronDown className={`w-3 h-3 transition-transform ${showLeads ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 min-h-[44px]"
            >
              <Plus className="w-3 h-3" />
              {showAdd ? 'Cancel' : 'Add instructor'}
            </button>
          </div>
        )}
      </div>

      {showAdd && canEdit && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 print:hidden">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {partTimers.length > 0 && <optgroup label="Part-time and volunteers">{partTimers.map(renderOption)}</optgroup>}
                {fullTimers.length > 0 && <optgroup label="Full-time">{fullTimers.map(renderOption)}</optgroup>}
                <option value={OTHER_VALUE}>Other (type a name)</option>
              </select>
            </div>
            {selected === OTHER_VALUE && (
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                <input
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                  maxLength={120}
                  placeholder="Guest name"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={adding || !selected || (selected === OTHER_VALUE && !otherName.trim())}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[44px]"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Adding an instructor puts them on the day and sends their calendar invite. &ldquo;Other&rdquo; is a name only, with no invite.
          </p>
        </div>
      )}

      {groups.length === 0 && !loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic print:hidden">Nobody is on this day yet.</p>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {groups.map(({ g, list }) => (
            <div key={g}>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {GROUP_LABELS[g]}
              </div>
              <div className="flex flex-wrap gap-2">
                {list.map(p => {
                  const avail = p.email ? calendarAvailability.get(p.email.toLowerCase()) : undefined;
                  const removable = canEdit && p.role_ids.length > 0;
                  return (
                    <span
                      key={p.key}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
                    >
                      {p.name}
                      {p.tags.length > 0 && (
                        <span className="text-xs font-normal opacity-80">{p.tags.join(' · ')}</span>
                      )}
                      {avail && <CalendarAvailabilityDot status={avail.status} events={avail.events} size="sm" />}
                      {removable && (
                        <button
                          onClick={() => handleRemove(p)}
                          disabled={removingKey === p.key}
                          className="text-amber-600 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400 print:hidden"
                          title={p.from_other_sources ? 'Remove from the day (station / signup assignments stay)' : 'Remove'}
                          aria-label={`Remove ${p.name}`}
                        >
                          {removingKey === p.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showLeads && canEdit && (
        <div className="mt-4 print:hidden">
          <LabDayRolesSection
            embedded
            labDayId={labDayId}
            labDayRoles={labDayRoles}
            instructors={instructors}
            userRole={userRole}
            calendarAvailability={calendarAvailability}
            instructorAvailability={instructorAvailability}
            onRolesChange={onRolesChange}
          />
        </div>
      )}
    </div>
  );
}
