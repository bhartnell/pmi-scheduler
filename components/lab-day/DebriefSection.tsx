'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Star,
  Edit2,
  Save,
  Wrench,
} from 'lucide-react';

interface DebriefSectionProps {
  labDayId: string;
}

export default function DebriefSection({ labDayId }: DebriefSectionProps) {
  const { data: session } = useSession();

  const [debriefs, setDebriefs] = useState<any[]>([]);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefCollapsed, setDebriefCollapsed] = useState(false);
  const [currentUserDebrief, setCurrentUserDebrief] = useState<any>(null);
  const [editingDebriefId, setEditingDebriefId] = useState<string | null>(null);
  const [submittingDebrief, setSubmittingDebrief] = useState(false);
  const [debriefHoverRating, setDebriefHoverRating] = useState(0);
  const [debriefForm, setDebriefForm] = useState({ rating: 0, went_well: '', to_improve: '', student_concerns: '', equipment_issues: '' });
  const [evaluationConcerns, setEvaluationConcerns] = useState<any[]>([]);

  useEffect(() => {
    fetchDebriefs();
    fetchEvaluationConcerns();
  }, [labDayId, session]);

  const fetchDebriefs = async () => {
    if (!labDayId) return; setDebriefLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief`); const data = await res.json(); if (data.success) { setDebriefs(data.debriefs || []); const userEmail = session?.user?.email?.toLowerCase(); const own = (data.debriefs || []).find((d: any) => d.instructor_email?.toLowerCase() === userEmail); setCurrentUserDebrief(own || null); if (own) setDebriefForm({ rating: own.rating || 0, went_well: own.went_well || '', to_improve: own.to_improve || '', student_concerns: own.student_concerns || '', equipment_issues: own.equipment_issues || '' }); } }
    catch (error) { console.error('Error:', error); }
    setDebriefLoading(false);
  };

  const fetchEvaluationConcerns = async () => {
    try { const res = await fetch(`/api/skill-sheets/evaluations-by-lab-day?lab_day_id=${labDayId}`); const data = await res.json(); if (data.success) setEvaluationConcerns((data.evaluations || []).filter((e: any) => e.flagged_items?.length > 0)); }
    catch { /* ignore */ }
  };

  const handleSubmitDebrief = async () => {
    if (debriefForm.rating < 1) return; setSubmittingDebrief(true);
    try { const method = editingDebriefId ? 'PUT' : 'POST'; const url = editingDebriefId ? `/api/lab-management/lab-days/${labDayId}/debrief?id=${editingDebriefId}` : `/api/lab-management/lab-days/${labDayId}/debrief`; const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(debriefForm) }); const data = await res.json(); if (data.success) { setEditingDebriefId(null); await fetchDebriefs(); } }
    catch (error) { console.error('Error:', error); }
    setSubmittingDebrief(false);
  };

  const startEditingDebrief = (debrief: any) => { setEditingDebriefId(debrief.id); setDebriefForm({ rating: debrief.rating || 0, went_well: debrief.went_well || '', to_improve: debrief.to_improve || '', student_concerns: debrief.student_concerns || '', equipment_issues: debrief.equipment_issues || '' }); };

  const cancelEditingDebrief = () => { setEditingDebriefId(null); if (currentUserDebrief) setDebriefForm({ rating: currentUserDebrief.rating || 0, went_well: currentUserDebrief.went_well || '', to_improve: currentUserDebrief.to_improve || '', student_concerns: currentUserDebrief.student_concerns || '', equipment_issues: currentUserDebrief.equipment_issues || '' }); };

  return (
    <div className="mt-6 print:hidden border-t-2 border-indigo-100 dark:border-indigo-900/50 pt-6">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg shadow border border-indigo-100 dark:border-indigo-800/50">
        {/* Section header */}
        <div className="flex items-center justify-between p-4 border-b border-indigo-100 dark:border-indigo-800/50">
          <button
            onClick={() => setDebriefCollapsed(prev => !prev)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Post-Lab Debrief</h3>
            {debriefs.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                {debriefs.length} {debriefs.length === 1 ? 'response' : 'responses'}
              </span>
            )}
            {debriefCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            )}
          </button>
        </div>

        {!debriefCollapsed && (
          <div className="p-4 space-y-6">
            {debriefLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <>
                {/* Student Concerns from Evaluations */}
                {evaluationConcerns.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4 mb-4">
                    <h4 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      Student Concerns from Evaluations
                    </h4>
                    <div className="space-y-2">
                      {evaluationConcerns.map((evalItem: any, i: number) => (
                        <div key={evalItem.id || i} className="bg-white dark:bg-gray-800 rounded border border-amber-100 dark:border-amber-900/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {evalItem.student?.first_name} {evalItem.student?.last_name}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              evalItem.result === 'fail'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : evalItem.result === 'remediation'
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            }`}>
                              {evalItem.result}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {evalItem.skill_sheet?.skill_name} &mdash; evaluated by {evalItem.evaluator?.name || 'Unknown'}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(evalItem.flagged_items || []).map((item: string, j: number) => (
                              <span
                                key={j}
                                className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit / edit form */}
                {(!currentUserDebrief || editingDebriefId === currentUserDebrief?.id) && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/50 p-4 space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                      {editingDebriefId ? 'Edit Your Debrief' : 'Submit Your Debrief'}
                    </h4>

                    {/* Star rating */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Overall Rating <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => {
                          const filled = star <= (debriefHoverRating || debriefForm.rating);
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setDebriefForm({ ...debriefForm, rating: star })}
                              onMouseEnter={() => setDebriefHoverRating(star)}
                              onMouseLeave={() => setDebriefHoverRating(0)}
                              className="p-0.5 focus:outline-none"
                              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                            >
                              <Star
                                className={`w-7 h-7 transition-colors ${
                                  filled
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            </button>
                          );
                        })}
                        {debriefForm.rating > 0 && (
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            {debriefForm.rating} / 5
                          </span>
                        )}
                      </div>
                    </div>

                    {/* What went well */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        What went well?
                      </label>
                      <textarea
                        value={debriefForm.went_well}
                        onChange={e => setDebriefForm({ ...debriefForm, went_well: e.target.value })}
                        rows={3}
                        placeholder="Describe what worked well during the lab..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    {/* What could improve */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        What could improve?
                      </label>
                      <textarea
                        value={debriefForm.to_improve}
                        onChange={e => setDebriefForm({ ...debriefForm, to_improve: e.target.value })}
                        rows={3}
                        placeholder="Describe areas for improvement..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    {/* Student concerns */}
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Student concerns noted?
                      </label>
                      <textarea
                        value={debriefForm.student_concerns}
                        onChange={e => setDebriefForm({ ...debriefForm, student_concerns: e.target.value })}
                        rows={2}
                        placeholder="Any student performance or behavioral concerns..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    {/* Equipment issues */}
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <Wrench className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        Equipment issues?
                      </label>
                      <textarea
                        value={debriefForm.equipment_issues}
                        onChange={e => setDebriefForm({ ...debriefForm, equipment_issues: e.target.value })}
                        rows={2}
                        placeholder="Any equipment problems, damage, or missing items..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleSubmitDebrief}
                        disabled={submittingDebrief || debriefForm.rating < 1}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {submittingDebrief ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {editingDebriefId ? 'Save Changes' : 'Submit Debrief'}
                      </button>
                      {editingDebriefId && (
                        <button
                          onClick={cancelEditingDebrief}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Submitted debriefs list */}
                {debriefs.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Submitted Responses
                    </h4>
                    {debriefs.map(debrief => {
                      const isOwn = debrief.instructor_email?.toLowerCase() === session?.user?.email?.toLowerCase();
                      const isBeingEdited = editingDebriefId === debrief.id;
                      if (isBeingEdited) return null;
                      const emailName = debrief.instructor_email?.split('@')[0] || '';
                      const initials = emailName.slice(0, 2).toUpperCase() || '?';
                      return (
                        <div
                          key={debrief.id}
                          className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
                            isOwn
                              ? 'border-indigo-200 dark:border-indigo-700'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {/* Card header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                  {initials}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {debrief.instructor_email?.split('@')[0] || debrief.instructor_email || 'Unknown'}
                                  {isOwn && (
                                    <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-normal">(you)</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {new Date(debrief.created_at).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit',
                                  })}
                                  {debrief.updated_at !== debrief.created_at && ' (edited)'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Star rating display */}
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= debrief.rating
                                        ? 'text-amber-400 fill-amber-400'
                                        : 'text-gray-200 dark:text-gray-700'
                                    }`}
                                  />
                                ))}
                              </div>
                              {isOwn && (
                                <button
                                  onClick={() => startEditingDebrief(debrief)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card body */}
                          <div className="space-y-3 text-sm">
                            {debrief.went_well && (
                              <div>
                                <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-0.5">
                                  What went well
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{debrief.went_well}</p>
                              </div>
                            )}
                            {debrief.to_improve && (
                              <div>
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-0.5">
                                  What could improve
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{debrief.to_improve}</p>
                              </div>
                            )}
                            {debrief.student_concerns && (
                              <div>
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Student concerns
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{debrief.student_concerns}</p>
                              </div>
                            )}
                            {debrief.equipment_issues && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <Wrench className="w-3 h-3" />
                                  Equipment issues
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{debrief.equipment_issues}</p>
                              </div>
                            )}
                            {!debrief.went_well && !debrief.to_improve && !debrief.student_concerns && !debrief.equipment_issues && (
                              <p className="text-gray-400 dark:text-gray-500 italic">No written notes provided.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {debriefs.length === 0 && !currentUserDebrief && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                    No debriefs submitted yet. Be the first to share feedback on this lab.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
