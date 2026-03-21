'use client';

import { formatCohortNumber } from '@/lib/format-cohort';
import {
  Printer,
  X,
} from 'lucide-react';
import type { LabDay, Station, LabDayRole, ChecklistItem, Student } from './types';

interface ShiftCoverage {
  id: string;
  title: string;
  signups: {
    id: string;
    status: string;
    instructor: { id: string; name: string; email: string } | null;
  }[];
}

interface LabDayPrintViewProps {
  labDay: LabDay;
  labDayRoles: LabDayRole[];
  checklistItems: ChecklistItem[];
  coverageShifts: ShiftCoverage[];
  cohortStudents: Student[];
  showRosterPrint: boolean;
  rosterIncludePhotos: boolean;
  onSetShowRosterPrint: (show: boolean) => void;
  onSetRosterIncludePhotos: (include: boolean) => void;
  formatDate: (dateString: string) => string;
  formatTime: (timeString: string | null) => string | null;
}

export default function LabDayPrintView({
  labDay,
  labDayRoles,
  checklistItems,
  coverageShifts,
  cohortStudents,
  showRosterPrint,
  rosterIncludePhotos,
  onSetShowRosterPrint,
  onSetRosterIncludePhotos,
  formatDate,
  formatTime,
}: LabDayPrintViewProps) {
  return (
    <>
      {/* Print Header - Only visible when printing non-roster view */}
      <div className={`hidden mb-4 p-4 border-b-2 border-gray-800${showRosterPrint ? '' : ' print:block'}`}>
        <h1 className="text-2xl font-bold text-center">LAB DAY SCHEDULE</h1>
        <div className="mt-2 flex justify-between text-sm">
          <div>
            <p><strong>Cohort:</strong> {labDay.cohort.program.abbreviation} Group {formatCohortNumber(labDay.cohort.cohort_number)}</p>
            <p><strong>Date:</strong> {formatDate(labDay.date)}</p>
            {(labDay.start_time || labDay.end_time) && (
              <p><strong>Time:</strong> {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}</p>
            )}
          </div>
          <div className="text-right">
            {labDay.title && (
              <p className="font-semibold text-base">{labDay.title}</p>
            )}
            {labDay.week_number && labDay.day_number && (
              <p><strong>Week {labDay.week_number}, Day {labDay.day_number}</strong></p>
            )}
            <p>{labDay.num_rotations} rotations x {labDay.rotation_duration} min</p>
          </div>
        </div>
        {labDayRoles.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-400 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {labDayRoles.filter(r => r.role === 'lab_lead').length > 0 && (
              <span>
                <strong>Lab Lead{labDayRoles.filter(r => r.role === 'lab_lead').length > 1 ? 's' : ''}:</strong>{' '}
                {labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown').join(', ')}
              </span>
            )}
            {labDayRoles.filter(r => r.role === 'roamer').length > 0 && (
              <span>
                <strong>Roamer{labDayRoles.filter(r => r.role === 'roamer').length > 1 ? 's' : ''}:</strong>{' '}
                {labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown').join(', ')}
              </span>
            )}
            {labDayRoles.filter(r => r.role === 'observer').length > 0 && (
              <span>
                <strong>Observer{labDayRoles.filter(r => r.role === 'observer').length > 1 ? 's' : ''}:</strong>{' '}
                {labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown').join(', ')}
              </span>
            )}
          </div>
        )}

        {/* Print: Stations Table */}
        {labDay.stations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Stations</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-400">
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600 w-8">#</th>
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600">Type</th>
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600">Station / Scenario</th>
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600">Instructor</th>
                  <th className="text-left py-1 font-semibold text-gray-600">Room</th>
                </tr>
              </thead>
              <tbody>
                {labDay.stations.map((station: Station) => (
                  <tr key={station.id} className="border-b border-gray-200">
                    <td className="py-1.5 pr-2 text-gray-500">{station.station_number}</td>
                    <td className="py-1.5 pr-2 capitalize text-gray-600 text-xs">{station.station_type.replace('_', ' ')}</td>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-gray-900">
                        {station.custom_title || station.scenario?.title || station.skill_name || `Station ${station.station_number}`}
                      </span>
                      {station.station_notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{station.station_notes}</p>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-gray-700">
                      {station.instructor_name || <span className="text-gray-300 italic">TBD</span>}
                    </td>
                    <td className="py-1.5 text-gray-700">{station.room || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print: Rotation Schedule */}
        {labDay.start_time && labDay.rotation_duration > 0 && labDay.num_rotations > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Rotation Schedule</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {Array.from({ length: labDay.num_rotations }, (_, i) => {
                const startParts = labDay.start_time!.split(':');
                const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
                const rotStart = startMinutes + (i * labDay.rotation_duration);
                const rotEnd = rotStart + labDay.rotation_duration;
                const fmtTime = (mins: number) => {
                  const h = Math.floor(mins / 60) % 12 || 12;
                  const m = String(mins % 60).padStart(2, '0');
                  const ampm = Math.floor(mins / 60) >= 12 ? 'PM' : 'AM';
                  return `${h}:${m} ${ampm}`;
                };
                return (
                  <div key={i} className="border border-gray-200 rounded px-2 py-1">
                    <span className="font-semibold text-gray-700">R{i + 1}:</span>{' '}
                    <span className="text-gray-600">{fmtTime(rotStart)} - {fmtTime(rotEnd)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Print: Checklist */}
        {checklistItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
              Prep Checklist ({checklistItems.filter(i => i.is_completed).length}/{checklistItems.length})
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
              {checklistItems.map(item => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <span className={`text-xs ${item.is_completed ? 'text-green-600' : 'text-gray-400'}`}>
                    {item.is_completed ? '\u2713' : '\u25CB'}
                  </span>
                  <span className={item.is_completed ? 'text-gray-500 line-through' : 'text-gray-800'}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print: Coverage */}
        {coverageShifts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Shift Coverage</h2>
            {coverageShifts.map(shift => {
              const confirmed = shift.signups.filter(s => s.status === 'confirmed');
              return (
                <div key={shift.id} className="text-sm mb-1">
                  <strong>{shift.title}</strong>
                  {confirmed.length > 0 && (
                    <span className="ml-2 text-gray-600">{confirmed.map(s => s.instructor?.name || 'Unknown').join(', ')}</span>
                  )}
                  {confirmed.length === 0 && (
                    <span className="ml-2 text-gray-400 italic">No confirmed signups</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Print: Notes */}
        {labDay.notes && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-1">Notes</h2>
            <p className="text-sm text-gray-600">{labDay.notes}</p>
          </div>
        )}

        {/* Print: Student Roster */}
        {cohortStudents.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
              Student Roster ({cohortStudents.length})
            </h2>
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-sm">
              {cohortStudents
                .sort((a, b) => a.last_name.localeCompare(b.last_name))
                .map((student, idx) => (
                  <span key={student.id} className="text-gray-800">
                    {idx + 1}. {student.last_name}, {student.first_name}
                  </span>
                ))
              }
            </div>
          </div>
        )}

        <div className="mt-4 pt-2 border-t border-gray-300 text-xs text-gray-400 flex justify-between">
          <span>PMI EMS Scheduler</span>
          <span>Printed {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Roster Print View */}
      {showRosterPrint && (
        <div className="hidden print:block p-6 bg-white text-black">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold">PMI Paramedic Program</h1>
            <h2 className="text-xl font-semibold mt-1">Lab Day Roster</h2>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Date:</strong> {formatDate(labDay.date)}</p>
              <p><strong>Cohort:</strong> {labDay.cohort.program.abbreviation} Group {formatCohortNumber(labDay.cohort.cohort_number)}</p>
              {labDay.title && <p><strong>Lab:</strong> {labDay.title}</p>}
            </div>
            <div>
              {(labDay.start_time || labDay.end_time) && (
                <p><strong>Time:</strong> {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}</p>
              )}
              {labDay.week_number && labDay.day_number && (
                <p><strong>Week {labDay.week_number}, Day {labDay.day_number}</strong></p>
              )}
              <p><strong>Rotations:</strong> {labDay.num_rotations} x {labDay.rotation_duration} min</p>
            </div>
          </div>
          {labDayRoles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-bold border-b border-gray-400 pb-1 mb-3 uppercase tracking-wide">Lab Day Roles</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {labDayRoles.filter(r => r.role === 'lab_lead').length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">Lab Lead{labDayRoles.filter(r => r.role === 'lab_lead').length > 1 ? 's' : ''}:</span>{' '}
                    <span>{labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown').join(', ')}</span>
                    <span className="text-gray-500 ml-1 text-xs">(oversees lab day, runs timer)</span>
                  </div>
                )}
                {labDayRoles.filter(r => r.role === 'roamer').length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">Roamer{labDayRoles.filter(r => r.role === 'roamer').length > 1 ? 's' : ''}:</span>{' '}
                    <span>{labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown').join(', ')}</span>
                    <span className="text-gray-500 ml-1 text-xs">(floats between stations, grabs supplies)</span>
                  </div>
                )}
                {labDayRoles.filter(r => r.role === 'observer').length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">Observer{labDayRoles.filter(r => r.role === 'observer').length > 1 ? 's' : ''}:</span>{' '}
                    <span>{labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown').join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {labDay.stations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-bold border-b border-gray-400 pb-1 mb-3 uppercase tracking-wide">Stations &amp; Instructors</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 pr-4 font-semibold w-12">Stn</th>
                    <th className="text-left py-1 pr-4 font-semibold">Station</th>
                    <th className="text-left py-1 font-semibold">Instructor</th>
                    <th className="text-left py-1 pl-4 font-semibold">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {labDay.stations.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-4 font-medium">{s.station_number}</td>
                      <td className="py-1.5 pr-4">{s.custom_title || s.scenario?.title || s.skill_name || `Station ${s.station_number}`}</td>
                      <td className="py-1.5">{s.instructor_name ? `${s.instructor_name}${s.instructor_email ? ` (${s.instructor_email})` : ''}` : <span className="text-gray-400 italic">TBD</span>}</td>
                      <td className="py-1.5 pl-4">{s.room || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <h3 className="text-base font-bold border-b border-gray-400 pb-1 mb-3 uppercase tracking-wide">
              Enrolled Students ({cohortStudents.length})
            </h3>
            {cohortStudents.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No students found for this cohort.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 pr-4 font-semibold w-8">#</th>
                    <th className="text-left py-1 pr-4 font-semibold">Name</th>
                    <th className="text-left py-1 pr-4 font-semibold">Email</th>
                    <th className="text-left py-1 pr-4 font-semibold">Agency</th>
                    {rosterIncludePhotos && <th className="text-left py-1 font-semibold">Photo</th>}
                  </tr>
                </thead>
                <tbody>
                  {cohortStudents.map((student, index) => (
                    <tr key={student.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-4 text-gray-500">{index + 1}.</td>
                      <td className="py-1.5 pr-4 font-medium">{student.last_name}, {student.first_name}</td>
                      <td className="py-1.5 pr-4 text-gray-600">{student.email || ''}</td>
                      <td className="py-1.5 pr-4">{student.agency || ''}</td>
                      {rosterIncludePhotos && (
                        <td className="py-1.5">
                          {student.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={student.photo_url} alt={`${student.first_name} ${student.last_name}`} className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <span className="text-gray-400 text-xs italic">No photo</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400 flex justify-between">
            <span>PMI EMS Scheduler</span>
            <span>Generated: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      )}

      {/* Roster Print Controls */}
      {showRosterPrint && (
        <div className="print:hidden fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 flex flex-col gap-3 w-72">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">Roster Print Options</span>
            <button onClick={() => onSetShowRosterPrint(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={rosterIncludePhotos} onChange={(e) => onSetRosterIncludePhotos(e.target.checked)} className="w-4 h-4 rounded" />
            Include student photos
          </label>
          <button onClick={() => window.print()} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Printer className="w-4 h-4" />
            Print Roster
          </button>
          <button onClick={() => onSetShowRosterPrint(false)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
