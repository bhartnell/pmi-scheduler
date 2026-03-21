'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Star,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  MessageSquare,
  Save,
} from 'lucide-react';
import type { Student, StudentRating } from './types';
import HelpTooltip from '@/components/HelpTooltip';
import { useToast } from '@/components/Toast';

interface StudentRatingsSectionProps {
  labDayId: string;
  cohortStudents: Student[];
}

export default function StudentRatingsSection({ labDayId, cohortStudents }: StudentRatingsSectionProps) {
  const { data: session } = useSession();
  const toast = useToast();

  const [studentRatings, setStudentRatings] = useState<StudentRating[]>([]);
  const [ratingsCollapsed, setRatingsCollapsed] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [savingRating, setSavingRating] = useState<Record<string, boolean>>({});
  const [ratingHover, setRatingHover] = useState<Record<string, number>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStudentRatings();
  }, [labDayId, session]);

  const fetchStudentRatings = async () => {
    if (!labDayId) return; setRatingsLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`); const data = await res.json(); if (data.success) { setStudentRatings(data.ratings || []); const notes: Record<string, string> = {}; const currentEmail = session?.user?.email?.toLowerCase(); (data.ratings || []).forEach((r: StudentRating) => { if (r.instructor_email?.toLowerCase() === currentEmail && r.note) notes[r.student_id] = r.note; }); setPendingNotes(notes); } }
    catch (error) { console.error('Error:', error); }
    setRatingsLoading(false);
  };

  const handleSaveRating = async (studentId: string, rating: number) => {
    setSavingRating(prev => ({ ...prev, [studentId]: true }));
    const currentEmail = session?.user?.email || '';
    const existingIdx = studentRatings.findIndex(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail.toLowerCase());
    const optimisticRating: StudentRating = { id: existingIdx >= 0 ? studentRatings[existingIdx].id : `temp-${studentId}`, lab_day_id: labDayId, student_id: studentId, instructor_email: currentEmail, rating, note: pendingNotes[studentId] || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setStudentRatings(prev => existingIdx >= 0 ? prev.map((r, i) => i === existingIdx ? optimisticRating : r) : [...prev, optimisticRating]);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, rating, note: pendingNotes[studentId] || null }) }); const data = await res.json(); if (data.success) { setStudentRatings(prev => prev.map(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail.toLowerCase() ? data.rating : r)); toast.success('Rating saved'); } else { await fetchStudentRatings(); toast.error('Failed to save rating'); } }
    catch { await fetchStudentRatings(); toast.error('Failed to save rating'); }
    setSavingRating(prev => ({ ...prev, [studentId]: false }));
  };

  const handleSaveNote = async (studentId: string) => {
    const currentEmail = session?.user?.email?.toLowerCase();
    const existing = studentRatings.find(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail);
    if (!existing) return;
    setSavingRating(prev => ({ ...prev, [`note-${studentId}`]: true }));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, rating: existing.rating, note: pendingNotes[studentId] || null }) }); const data = await res.json(); if (data.success) { setStudentRatings(prev => prev.map(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail ? data.rating : r)); toast.success('Note saved'); setExpandedNotes(prev => ({ ...prev, [studentId]: false })); } else toast.error('Failed to save note'); }
    catch { toast.error('Failed to save note'); }
    setSavingRating(prev => ({ ...prev, [`note-${studentId}`]: false }));
  };

  return (
    <div className="mt-6 print:hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        {/* Section header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <button
            onClick={() => setRatingsCollapsed(prev => !prev)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            <Star className="w-5 h-5 text-amber-500 shrink-0" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Student Performance</h3>
            {studentRatings.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                {studentRatings.length} {studentRatings.length === 1 ? 'rating' : 'ratings'}
              </span>
            )}
            {ratingsCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            )}
          </button>
          <div className="group relative inline-flex items-center shrink-0 ml-2">
            <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help" />
            <div className="invisible group-hover:visible absolute right-6 top-0 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg">
              <div className="absolute -right-1 top-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
              Rate student performance during lab sessions. Ratings help track progress and identify students needing additional support.
            </div>
          </div>
        </div>

        {!ratingsCollapsed && (
          <div className="p-4">
            {ratingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cohortStudents.map((student) => {
                  const currentEmail = session?.user?.email?.toLowerCase();
                  const myRating = studentRatings.find(
                    r => r.student_id === student.id && r.instructor_email?.toLowerCase() === currentEmail
                  );
                  const otherRatings = studentRatings.filter(
                    r => r.student_id === student.id && r.instructor_email?.toLowerCase() !== currentEmail
                  );
                  const otherAvg =
                    otherRatings.length > 0
                      ? Math.round(
                          (otherRatings.reduce((s, r) => s + r.rating, 0) / otherRatings.length) * 10
                        ) / 10
                      : null;
                  const hoverVal = ratingHover[student.id] || 0;
                  const displayRating = hoverVal || myRating?.rating || 0;
                  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();
                  const isSaving = savingRating[student.id];
                  const noteExpanded = expandedNotes[student.id];
                  const pendingNote = pendingNotes[student.id] ?? (myRating?.note || '');

                  return (
                    <div
                      key={student.id}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-700/40"
                    >
                      {/* Student identity */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {(student as any).photo_url ? (
                            <img
                              src={(student as any).photo_url}
                              alt={`${student.first_name} ${student.last_name}`}
                              className="w-10 h-10 object-cover rounded-full"
                            />
                          ) : (
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {initials}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {student.first_name} {student.last_name}
                          </p>
                          {otherAvg !== null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {otherRatings.length} other {otherRatings.length === 1 ? 'rating' : 'ratings'}, avg {otherAvg}
                              <Star className="w-3 h-3 inline ml-0.5 text-amber-400 fill-amber-400" />
                            </p>
                          )}
                        </div>
                        {isSaving && (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto flex-shrink-0" />
                        )}
                      </div>

                      {/* Star rating row */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => {
                          const filled = star <= displayRating;
                          return (
                            <button
                              key={star}
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveRating(student.id, star)}
                              onMouseEnter={() => setRatingHover(prev => ({ ...prev, [student.id]: star }))}
                              onMouseLeave={() => setRatingHover(prev => ({ ...prev, [student.id]: 0 }))}
                              className="p-0.5 focus:outline-none disabled:opacity-50"
                              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                            >
                              <Star
                                className={`w-6 h-6 transition-colors ${
                                  filled
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            </button>
                          );
                        })}
                        {myRating && (
                          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                            {myRating.rating}/5
                          </span>
                        )}
                        <HelpTooltip text="Rate this lab experience 1-5. Ratings help improve future lab planning and track student progress over time." />
                      </div>

                      {/* Note section */}
                      {myRating && !noteExpanded && (
                        <button
                          onClick={() => {
                            setPendingNotes(prev => ({ ...prev, [student.id]: myRating.note || '' }));
                            setExpandedNotes(prev => ({ ...prev, [student.id]: true }));
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <MessageSquare className="w-3 h-3" />
                          {myRating.note ? 'Edit note' : 'Add note'}
                        </button>
                      )}

                      {myRating && noteExpanded && (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            value={pendingNote}
                            onChange={e =>
                              setPendingNotes(prev => ({ ...prev, [student.id]: e.target.value }))
                            }
                            placeholder="Optional note about this student..."
                            className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              disabled={savingRating[`note-${student.id}`]}
                              onClick={() => handleSaveNote(student.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingRating[`note-${student.id}`] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() =>
                                setExpandedNotes(prev => ({ ...prev, [student.id]: false }))
                              }
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Show existing note (read-only when not expanded) */}
                      {myRating?.note && !noteExpanded && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2">
                          &ldquo;{myRating.note}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
