'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  ChevronLeft,
  Calendar,
  Plus,
  Edit2,
  ClipboardCheck,
  FileText,
  Users,
  MapPin,
  Clock,
  Check,
  AlertCircle
} from 'lucide-react';

interface LabDay {
  id: string;
  date: string;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
  stations: Station[];
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  scenario?: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
  };
  skill_name: string | null;
  custom_title: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  room: string | null;
  notes: string | null;
  rotation_minutes: number;
  num_rotations: number;
  // Legacy fields for backwards compatibility
  instructor?: {
    id: string;
    name: string;
  };
  location: string | null;
  documentation_required: boolean;
  platinum_required: boolean;
}

const STATION_TYPE_COLORS: Record<string, string> = {
  scenario: 'border-blue-200 bg-blue-50',
  skill: 'border-green-200 bg-green-50',
  documentation: 'border-purple-200 bg-purple-50',
  lecture: 'border-yellow-200 bg-yellow-50',
  testing: 'border-red-200 bg-red-50',
};

const STATION_TYPE_BADGES: Record<string, string> = {
  scenario: 'bg-blue-100 text-blue-800',
  skill: 'bg-green-100 text-green-800',
  documentation: 'bg-purple-100 text-purple-800',
  lecture: 'bg-yellow-100 text-yellow-800',
  testing: 'bg-red-100 text-red-800',
};

export default function LabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const labDayId = params.id as string;
  const justGraded = searchParams.get('graded');

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchLabDay();
    }
  }, [session, labDayId]);

  const fetchLabDay = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const data = await res.json();
      
      if (data.success) {
        setLabDay(data.labDay);
      } else {
        console.error('Failed to fetch lab day:', data.error);
      }
    } catch (error) {
      console.error('Error fetching lab day:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone issues
    // Adding T12:00:00 ensures the date displays correctly in any timezone
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStationTitle = (station: Station) => {
    if (station.scenario) return station.scenario.title;
    if (station.skill_name) return station.skill_name;
    if (station.custom_title) return station.custom_title;
    return `Station ${station.station_number}`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!labDay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Lab Day Not Found</h2>
          <p className="text-gray-600 mb-4">The requested lab day could not be found.</p>
          <Link
            href="/lab-management/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Success Toast */}
      {justGraded && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5" />
          <span>Assessment saved successfully!</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/lab-management/schedule" className="hover:text-blue-600">Schedule</Link>
                <ChevronRight className="w-4 h-4" />
                <span>{labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {formatDate(labDay.date)}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                {labDay.week_number && labDay.day_number && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Week {labDay.week_number}, Day {labDay.day_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {labDay.num_rotations} rotations × {labDay.rotation_duration} min
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/lab-management/schedule/${labDayId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <Link
                href={`/lab-management/schedule/${labDayId}/stations/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Station
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notes */}
        {labDay.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-yellow-800 mb-1">Notes</h3>
            <p className="text-yellow-700 text-sm">{labDay.notes}</p>
          </div>
        )}

        {/* Stations Grid */}
        {labDay.stations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Stations Yet</h3>
            <p className="text-gray-600 mb-4">Add stations to this lab day to get started.</p>
            <Link
              href={`/lab-management/schedule/${labDayId}/stations/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add First Station
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labDay.stations.map((station) => (
              <div
                key={station.id}
                className={`bg-white rounded-lg shadow border-l-4 ${STATION_TYPE_COLORS[station.station_type] || 'border-gray-200'}`}
              >
                <div className="p-4">
                  {/* Station Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-900">
                          Station {station.station_number}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATION_TYPE_BADGES[station.station_type] || 'bg-gray-100 text-gray-800'}`}>
                          {station.station_type}
                        </span>
                        {station.platinum_required && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                            Platinum
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900">
                        {getStationTitle(station)}
                      </h3>
                      {station.scenario && (
                        <p className="text-sm text-gray-600">{station.scenario.category}</p>
                      )}
                    </div>
                  </div>

                  {/* Station Details */}
                  <div className="space-y-2 text-sm mb-4">
                    {(station.instructor_name || station.instructor?.name) && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{station.instructor_name || station.instructor?.name}</span>
                      </div>
                    )}
                    {(station.room || station.location) && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{station.room || station.location}</span>
                      </div>
                    )}
                    {station.documentation_required && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <FileText className="w-4 h-4" />
                        <span>Documentation required</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    {station.scenario && (
                      <Link
                        href={`/lab-management/scenarios/${station.scenario.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        <FileText className="w-4 h-4" />
                        View Scenario
                      </Link>
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
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/lab-management/students?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Users className="w-4 h-4" />
            View Students
          </Link>
          <Link
            href={`/lab-management/reports/team-leads?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <ClipboardCheck className="w-4 h-4" />
            Team Lead Report
          </Link>
        </div>
      </main>
    </div>
  );
}
