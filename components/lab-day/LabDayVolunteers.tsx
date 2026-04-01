'use client';

import { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Users,
  Copy,
  Check,
  ClipboardCheck,
  Mail,
  Phone,
} from 'lucide-react';

interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  volunteer_type: string;
  agency_affiliation: string | null;
  needs_evaluation: boolean;
  evaluation_skill: string | null;
  evaluation_status: string | null;
  status: string;
  notes: string | null;
}

interface LabDayVolunteersProps {
  labDayId: string;
}

const volunteerTypeLabel: Record<string, string> = {
  instructor_1_candidate: 'Instructor 1',
  former_student: 'Former Student',
  community: 'Community',
};

const volunteerTypeColor: Record<string, string> = {
  instructor_1_candidate:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  former_student:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  community:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const evalStatusColor: Record<string, string> = {
  pending: 'text-amber-600 dark:text-amber-400',
  passed: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
};

export default function LabDayVolunteers({ labDayId }: LabDayVolunteersProps) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchVolunteers();
  }, [labDayId]);

  useEffect(() => {
    // Collapse by default if no volunteers
    if (!loading && volunteers.length === 0) {
      setCollapsed(true);
    }
  }, [loading, volunteers.length]);

  const fetchVolunteers = async () => {
    try {
      const res = await fetch(
        `/api/lab-management/lab-days/${labDayId}/volunteers`
      );
      const data = await res.json();
      if (data.success) {
        setVolunteers(data.volunteers || []);
      }
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = (volunteer: Volunteer) => {
    navigator.clipboard.writeText(volunteer.email);
    setCopiedId(volunteer.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return null;

  return (
    <div className="mb-6 print:mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 hover:text-gray-900 dark:hover:text-white print:hidden"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        <Users className="w-4 h-4" />
        Volunteers
        <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
          {volunteers.length}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {volunteers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic ml-6">
              No volunteers signed up for this lab day.
            </p>
          ) : (
            volunteers.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {v.name}
                </span>

                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                    volunteerTypeColor[v.volunteer_type] ||
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {volunteerTypeLabel[v.volunteer_type] || v.volunteer_type}
                </span>

                {v.agency_affiliation && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({v.agency_affiliation})
                  </span>
                )}

                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Mail className="w-3 h-3" />
                  {v.email}
                  <button
                    onClick={() => copyEmail(v)}
                    className="p-0.5 hover:text-gray-700 dark:hover:text-gray-200 print:hidden"
                    title="Copy email"
                  >
                    {copiedId === v.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </span>

                {v.phone && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Phone className="w-3 h-3" />
                    {v.phone}
                  </span>
                )}

                {v.needs_evaluation && v.evaluation_skill && (
                  <span className="flex items-center gap-1 text-xs">
                    <ClipboardCheck className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Eval: {v.evaluation_skill}
                    </span>
                    {v.evaluation_status && (
                      <span
                        className={`font-medium ${
                          evalStatusColor[v.evaluation_status] ||
                          'text-gray-500'
                        }`}
                      >
                        ({v.evaluation_status})
                      </span>
                    )}
                  </span>
                )}

                {v.notes && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic truncate max-w-[200px]" title={v.notes}>
                    {v.notes}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
