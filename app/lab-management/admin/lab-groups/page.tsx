'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Users,
  GripVertical,
  X,
  Edit2,
  Check,
  History,
  ChevronDown,
  ChevronUp,
  UserMinus,
  ArrowRight
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  email: string | null;
}

interface LabGroup {
  id: string;
  name: string;
  display_order: number;
  members: {
    id: string;
    student: Student;
  }[];
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

export default function LabGroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [groups, setGroups] = useState<LabGroup[]>([]);
  const [ungroupedStudents, setUngroupedStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Editing states
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  // Drag state
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [movingStudent, setMovingStudent] = useState<Student | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchGroups();
    }
  }, [selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
        if (data.cohorts.length > 0) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-groups?cohortId=${selectedCohort}`);
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
        setUngroupedStudents(data.ungroupedStudents || []);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-groups/history?cohortId=${selectedCohort}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch('/api/lab-management/lab-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort,
          name: newGroupName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewGroupName('');
        setShowNewGroup(false);
        fetchGroups();
      }
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const renameGroup = async (groupId: string) => {
    if (!editingName.trim()) return;

    try {
      const res = await fetch(`/api/lab-management/lab-groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setEditingGroupId(null);
        fetchGroups();
      }
    } catch (error) {
      console.error('Error renaming group:', error);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      const res = await fetch(`/api/lab-management/lab-groups/${groupId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchGroups();
      } else {
        alert(data.error || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const moveStudent = async (studentId: string, groupId: string | null) => {
    try {
      const res = await fetch('/api/lab-management/lab-groups/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          group_id: groupId,
          changed_by: session?.user?.email
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchGroups();
        setMovingStudent(null);
      }
    } catch (error) {
      console.error('Error moving student:', error);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, student: Student) => {
    setDraggedStudent(student);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    setDragOverGroup(groupId);
  };

  const handleDragLeave = () => {
    setDragOverGroup(null);
  };

  const handleDrop = (e: React.DragEvent, groupId: string | null) => {
    e.preventDefault();
    if (draggedStudent) {
      moveStudent(draggedStudent.id, groupId);
    }
    setDraggedStudent(null);
    setDragOverGroup(null);
  };

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Lab Groups</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Groups</h1>
            <div className="flex items-center gap-2">
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              >
                <option value="">Select Cohort</option>
                {cohorts.map(cohort => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.program.abbreviation} Group {cohort.cohort_number}
                  </option>
                ))}
              </select>
              <button
                onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
                className={`p-2 rounded-lg ${showHistory ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="View history"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!selectedCohort ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Select a cohort to manage lab groups</p>
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* History Panel */}
            {showHistory && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Changes</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No changes recorded yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {history.map(h => (
                      <div key={h.id} className="text-sm flex items-start gap-2">
                        <span className="text-gray-400 dark:text-gray-500 shrink-0">
                          {new Date(h.changed_at).toLocaleDateString()}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{h.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {isMobile
                  ? 'Tap a student and select "Move to" to reassign them to a different group.'
                  : 'Drag and drop students between groups to reassign them. Changes are saved automatically.'}
              </p>
            </div>

            {/* Groups Grid */}
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
              {/* Existing Groups */}
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow ${
                    dragOverGroup === group.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, group.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, group.id)}
                >
                  {/* Group Header */}
                  <div className="p-3 border-b dark:border-gray-700 flex items-center justify-between">
                    {editingGroupId === group.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && renameGroup(group.id)}
                        />
                        <button onClick={() => renameGroup(group.id)} className="text-green-600 dark:text-green-400">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingGroupId(null)} className="text-gray-400 dark:text-gray-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => isMobile && setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                        >
                          <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400">({group.members?.length || 0})</span>
                          {isMobile && (
                            expandedGroup === group.id
                              ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                              : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingGroupId(group.id); setEditingName(group.name); }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {group.members?.length === 0 && (
                            <button
                              onClick={() => deleteGroup(group.id)}
                              className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Group Members */}
                  <div className={`p-2 min-h-[100px] ${isMobile && expandedGroup !== group.id ? 'hidden' : ''}`}>
                    {group.members?.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                        {isMobile ? 'No students' : 'Drop students here'}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {group.members?.map(member => (
                          <div
                            key={member.id}
                            draggable={!isMobile}
                            onDragStart={(e) => handleDragStart(e, member.student)}
                            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              !isMobile ? 'cursor-grab active:cursor-grabbing' : ''
                            } ${movingStudent?.id === member.student.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                          >
                            {!isMobile && <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden shrink-0">
                              {member.student.photo_url ? (
                                <img src={member.student.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {member.student.first_name[0]}{member.student.last_name[0]}
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                              {member.student.first_name} {member.student.last_name}
                            </span>
                            {isMobile && (
                              <button
                                onClick={() => setMovingStudent(movingStudent?.id === member.student.id ? null : member.student)}
                                className="p-1 text-gray-400 dark:text-gray-500"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mobile Move Options */}
                  {isMobile && movingStudent && group.members?.some(m => m.student.id === movingStudent.id) && (
                    <div className="p-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Move to:</p>
                      <div className="flex flex-wrap gap-1">
                        {groups.filter(g => g.id !== group.id).map(g => (
                          <button
                            key={g.id}
                            onClick={() => moveStudent(movingStudent.id, g.id)}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                          >
                            {g.name}
                          </button>
                        ))}
                        <button
                          onClick={() => moveStudent(movingStudent.id, null)}
                          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                        >
                          Unassign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add New Group */}
              {showNewGroup ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg mb-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createGroup()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createGroup}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                      className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewGroup(true)}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[150px]"
                >
                  <Plus className="w-5 h-5" />
                  Add Group
                </button>
              )}
            </div>

            {/* Ungrouped Students */}
            {ungroupedStudents.length > 0 && (
              <div
                className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg ${
                  dragOverGroup === 'ungrouped' ? 'ring-2 ring-yellow-500' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, 'ungrouped')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
              >
                <div className="p-3 border-b border-yellow-200 dark:border-yellow-700">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <UserMinus className="w-5 h-5" />
                    Ungrouped Students ({ungroupedStudents.length})
                  </h3>
                </div>
                <div className="p-3">
                  <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {ungroupedStudents.map(student => (
                      <div
                        key={student.id}
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, student)}
                        className={`flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg ${
                          !isMobile ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${movingStudent?.id === student.id ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        {!isMobile && <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {student.first_name[0]}{student.last_name[0]}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        {isMobile && (
                          <button
                            onClick={() => setMovingStudent(movingStudent?.id === student.id ? null : student)}
                            className="p-1 text-gray-400 dark:text-gray-500"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Mobile Move Options for Ungrouped */}
                  {isMobile && movingStudent && ungroupedStudents.some(s => s.id === movingStudent.id) && (
                    <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Assign to:</p>
                      <div className="flex flex-wrap gap-1">
                        {groups.map(g => (
                          <button
                            key={g.id}
                            onClick={() => moveStudent(movingStudent.id, g.id)}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
