'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  Save
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface FieldTrip {
  id: string;
  name: string;
  trip_date: string;
  location: string | null;
  description: string | null;
}

interface AttendanceRecord {
  student_id: string;
  attended: boolean;
}

interface FieldTripAttendanceProps {
  cohortId: string;
  students: Student[];
}

export default function FieldTripAttendance({ cohortId, students }: FieldTripAttendanceProps) {
  const [fieldTrips, setFieldTrips] = useState<FieldTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<FieldTrip | null>(null);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [newTrip, setNewTrip] = useState({
    name: '',
    trip_date: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
  });

  useEffect(() => {
    fetchFieldTrips();
  }, [cohortId]);

  useEffect(() => {
    if (selectedTrip) {
      fetchAttendance(selectedTrip.id);
    }
  }, [selectedTrip]);

  const fetchFieldTrips = async () => {
    try {
      const res = await fetch(`/api/lab-management/field-trips?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setFieldTrips(data.fieldTrips || []);
        // Select the first trip by default
        if (data.fieldTrips?.length > 0 && !selectedTrip) {
          setSelectedTrip(data.fieldTrips[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching field trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (fieldTripId: string) => {
    try {
      const res = await fetch(`/api/lab-management/field-trips/attendance?fieldTripId=${fieldTripId}`);
      const data = await res.json();
      if (data.success) {
        const map = new Map<string, boolean>();
        (data.attendance || []).forEach((a: AttendanceRecord) => {
          map.set(a.student_id, a.attended);
        });
        setAttendance(map);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const toggleAttendance = async (studentId: string) => {
    if (!selectedTrip) return;

    const currentValue = attendance.get(studentId) || false;
    const newValue = !currentValue;

    // Optimistically update UI
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(studentId, newValue);
      return newMap;
    });

    // Save to server
    try {
      const res = await fetch('/api/lab-management/field-trips/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_trip_id: selectedTrip.id,
          student_id: studentId,
          attended: newValue,
        }),
      });

      if (!res.ok) {
        // Revert on error
        setAttendance(prev => {
          const newMap = new Map(prev);
          newMap.set(studentId, currentValue);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      // Revert on error
      setAttendance(prev => {
        const newMap = new Map(prev);
        newMap.set(studentId, currentValue);
        return newMap;
      });
    }
  };

  const markAllPresent = async () => {
    if (!selectedTrip) return;
    setSaving(true);

    const newAttendance = students.map(s => ({ student_id: s.id, attended: true }));

    try {
      const res = await fetch('/api/lab-management/field-trips/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_trip_id: selectedTrip.id,
          attendance: newAttendance,
        }),
      });

      if (res.ok) {
        const map = new Map<string, boolean>();
        newAttendance.forEach(a => map.set(a.student_id, true));
        setAttendance(map);
      }
    } catch (error) {
      console.error('Error marking all present:', error);
    } finally {
      setSaving(false);
    }
  };

  const createFieldTrip = async () => {
    if (!newTrip.name || !newTrip.trip_date) return;
    setSaving(true);

    try {
      const res = await fetch('/api/lab-management/field-trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: cohortId,
          ...newTrip,
        }),
      });

      const data = await res.json();
      if (data.success && data.fieldTrip) {
        setFieldTrips(prev => [data.fieldTrip, ...prev]);
        setSelectedTrip(data.fieldTrip);
        setShowCreateForm(false);
        setNewTrip({
          name: '',
          trip_date: new Date().toISOString().split('T')[0],
          location: '',
          description: '',
        });
      }
    } catch (error) {
      console.error('Error creating field trip:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const presentCount = Array.from(attendance.values()).filter(Boolean).length;
  const totalStudents = students.length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div
        className="p-4 border-b dark:border-gray-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Field Trip Attendance</h3>
          {selectedTrip && (
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              {presentCount}/{totalStudents} present
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateForm(true);
            }}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded"
            title="Add field trip"
          >
            <Plus className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {/* Create Form */}
          {showCreateForm && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-800 dark:text-purple-300">New Field Trip</h4>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                >
                  <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newTrip.name}
                  onChange={(e) => setNewTrip(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Trip name (e.g., Hospital Tour)"
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <input
                  type="date"
                  value={newTrip.trip_date}
                  onChange={(e) => setNewTrip(prev => ({ ...prev, trip_date: e.target.value }))}
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={newTrip.location}
                  onChange={(e) => setNewTrip(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Location (optional)"
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  onClick={createFieldTrip}
                  disabled={saving || !newTrip.name}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </div>
          )}

          {/* Trip Selector */}
          {fieldTrips.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <select
                  value={selectedTrip?.id || ''}
                  onChange={(e) => {
                    const trip = fieldTrips.find(t => t.id === e.target.value);
                    setSelectedTrip(trip || null);
                  }}
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {fieldTrips.map(trip => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name} - {formatDate(trip.trip_date)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={markAllPresent}
                  disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Mark All Present
                </button>
              </div>

              {/* Attendance Grid */}
              {selectedTrip && (
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 divide-x divide-y dark:divide-gray-700">
                    {students.map(student => {
                      const isPresent = attendance.get(student.id) || false;
                      return (
                        <button
                          key={student.id}
                          onClick={() => toggleAttendance(student.id)}
                          className={`p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            isPresent
                              ? 'bg-green-50 dark:bg-green-900/20'
                              : 'bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isPresent
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isPresent && <Check className="w-3 h-3" />}
                            </div>
                            <span className={`text-sm font-medium truncate ${
                              isPresent
                                ? 'text-green-800 dark:text-green-300'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {student.last_name}, {student.first_name[0]}.
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedTrip && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedTrip.trip_date)}
                    </span>
                    {selectedTrip.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {selectedTrip.location}
                      </span>
                    )}
                  </div>
                  <span className={`font-medium ${
                    presentCount === totalStudents
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {presentCount}/{totalStudents} students present
                    {presentCount === totalStudents && ' ✓'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400 mb-3">No field trips yet</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Create First Trip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
