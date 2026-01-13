'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Users,
  Plus,
  Trash2,
  Home,
  Save,
  AlertTriangle,
  Edit2,
  Check,
  X,
  GraduationCap
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
  photo_url: string | null;
}

interface Group {
  id: string;
  name: string;
  group_number: number;
  description: string | null;
  members: Student[];
}

interface LearningStyle {
  student_id: string;
  primary_style: string;
  social_style: string;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

const STYLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  audio: { bg: 'bg-blue-500', text: 'text-white', label: 'A' },
  visual: { bg: 'bg-green-500', text: 'text-white', label: 'V' },
  kinesthetic: { bg: 'bg-orange-500', text: 'text-white', label: 'K' },
  social: { bg: 'bg-purple-500', text: 'text-white', label: 'S' },
  independent: { bg: 'bg-gray-500', text: 'text-white', label: 'I' },
};

export default function StudyGroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params.id as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [dragSource, setDragSource] = useState<string | 'unassigned' | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && cohortId) {
      fetchData();
    }
  }, [session, cohortId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cohort
      const cohortRes = await fetch(`/api/lab-management/cohorts/${cohortId}`);
      const cohortData = await cohortRes.json();
      if (cohortData.success) {
        setCohort(cohortData.cohort);
      }

      // Fetch all students in cohort
      const studentsRes = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`);
      const studentsData = await studentsRes.json();
      const students = studentsData.students || [];
      setAllStudents(students);

      // Fetch groups
      const groupsRes = await fetch(`/api/lab-management/groups?cohortId=${cohortId}`);
      const groupsData = await groupsRes.json();
      const fetchedGroups = groupsData.groups || [];

      // Fetch members for each group
      const groupsWithMembers: Group[] = await Promise.all(
        fetchedGroups.map(async (group: any) => {
          const membersRes = await fetch(`/api/lab-management/groups/${group.id}/members`);
          const membersData = await membersRes.json();
          return {
            ...group,
            members: membersData.members || [],
          };
        })
      );

      setGroups(groupsWithMembers);

      // Calculate unassigned students
      const assignedIds = new Set(groupsWithMembers.flatMap(g => g.members.map(m => m.id)));
      setUnassignedStudents(students.filter((s: Student) => !assignedIds.has(s.id)));

      // Fetch learning styles
      const lsRes = await fetch(`/api/seating/learning-styles?cohortId=${cohortId}`);
      const lsData = await lsRes.json();
      setLearningStyles(lsData.learningStyles?.map((ls: any) => ({
        student_id: ls.student_id,
        primary_style: ls.primary_style,
        social_style: ls.social_style,
      })) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const getLearningStyle = useCallback((studentId: string) => {
    return learningStyles.find(ls => ls.student_id === studentId);
  }, [learningStyles]);

  const getGroupStats = useCallback((members: Student[]) => {
    const agencies: Record<string, number> = {};
    const styles: Record<string, number> = {};

    members.forEach(m => {
      if (m.agency) {
        agencies[m.agency] = (agencies[m.agency] || 0) + 1;
      }
      const ls = getLearningStyle(m.id);
      if (ls?.primary_style) {
        styles[ls.primary_style] = (styles[ls.primary_style] || 0) + 1;
      }
    });

    return { agencies, styles };
  }, [getLearningStyle]);

  const handleDragStart = (student: Student, source: string | 'unassigned') => {
    setDraggedStudent(student);
    setDragSource(source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropToGroup = (targetGroupId: string) => {
    if (!draggedStudent) return;

    // Remove from source
    if (dragSource === 'unassigned') {
      setUnassignedStudents(unassignedStudents.filter(s => s.id !== draggedStudent.id));
    } else if (dragSource) {
      setGroups(groups.map(g =>
        g.id === dragSource
          ? { ...g, members: g.members.filter(m => m.id !== draggedStudent.id) }
          : g
      ));
    }

    // Add to target group
    setGroups(groups.map(g =>
      g.id === targetGroupId
        ? { ...g, members: [...g.members.filter(m => m.id !== draggedStudent.id), draggedStudent] }
        : g
    ));

    setHasChanges(true);
    setDraggedStudent(null);
    setDragSource(null);
  };

  const handleDropToUnassigned = () => {
    if (!draggedStudent || dragSource === 'unassigned') return;

    // Remove from group
    if (dragSource) {
      setGroups(groups.map(g =>
        g.id === dragSource
          ? { ...g, members: g.members.filter(m => m.id !== draggedStudent.id) }
          : g
      ));
    }

    // Add to unassigned
    setUnassignedStudents([...unassignedStudents, draggedStudent]);

    setHasChanges(true);
    setDraggedStudent(null);
    setDragSource(null);
  };

  const handleCreateGroup = async () => {
    try {
      const res = await fetch('/api/lab-management/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId }),
      });

      const data = await res.json();
      if (data.success) {
        setGroups([...groups, { ...data.group, members: [] }]);
      }
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (!confirm(`Delete ${group.name}? Members will be moved to unassigned.`)) return;

    try {
      const res = await fetch(`/api/lab-management/groups/${groupId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        // Move members to unassigned
        setUnassignedStudents([...unassignedStudents, ...group.members]);
        setGroups(groups.filter(g => g.id !== groupId));
      }
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    if (!editingName.trim()) {
      setEditingGroupId(null);
      return;
    }

    try {
      const res = await fetch(`/api/lab-management/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      const data = await res.json();
      if (data.success) {
        setGroups(groups.map(g =>
          g.id === groupId ? { ...g, name: editingName } : g
        ));
      }
    } catch (error) {
      console.error('Error renaming group:', error);
    }

    setEditingGroupId(null);
    setEditingName('');
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Update all group memberships
      await Promise.all(
        groups.map(async (group) => {
          await fetch(`/api/lab-management/groups/${group.id}/members`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentIds: group.members.map(m => m.id),
            }),
          });
        })
      );

      setHasChanges(false);
      alert('Groups saved!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    }
    setSaving(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !cohort) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cohort Not Found</h2>
          <Link href="/lab-management/admin/cohorts" className="text-blue-600 hover:underline">
            Back to Cohorts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/cohorts/${cohortId}`} className="hover:text-blue-600">
              {cohort.program.abbreviation} {cohort.cohort_number}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Study Groups</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Study Groups</h1>
                <p className="text-sm text-gray-600">
                  {cohort.program.abbreviation} Group {cohort.cohort_number} • {allStudents.length} students
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateGroup}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Groups */}
          <div className="flex-1">
            {groups.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No study groups created yet</p>
                <button
                  onClick={handleCreateGroup}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Create First Group
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => {
                  const stats = getGroupStats(group.members);
                  return (
                    <div
                      key={group.id}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropToGroup(group.id)}
                      className="bg-white rounded-lg shadow"
                    >
                      {/* Group Header */}
                      <div className="p-3 border-b flex items-center justify-between">
                        {editingGroupId === group.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup(group.id)}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameGroup(group.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingGroupId(null)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{group.name}</span>
                              <span className="text-sm text-gray-500">({group.members.length})</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingGroupId(group.id);
                                  setEditingName(group.name);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGroup(group.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Stats */}
                      {group.members.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 border-b text-xs">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(stats.agencies).slice(0, 3).map(([agency, count]) => (
                              <span key={agency} className="px-1.5 py-0.5 bg-white rounded border">
                                {agency}: {count}
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1 mt-1">
                            {Object.entries(stats.styles).map(([style, count]) => (
                              <span
                                key={style}
                                className={`px-1.5 py-0.5 rounded ${STYLE_BADGES[style]?.bg} ${STYLE_BADGES[style]?.text}`}
                              >
                                {STYLE_BADGES[style]?.label}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Members */}
                      <div className="p-2 min-h-[150px]">
                        {group.members.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-sm text-gray-400 border-2 border-dashed rounded-lg p-4">
                            Drag students here
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {group.members.map((student) => {
                              const ls = getLearningStyle(student.id);
                              return (
                                <div
                                  key={student.id}
                                  draggable
                                  onDragStart={() => handleDragStart(student, group.id)}
                                  className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-move"
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                    {student.photo_url ? (
                                      <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                        {student.first_name[0]}{student.last_name[0]}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {student.first_name} {student.last_name}
                                    </div>
                                    {student.agency && (
                                      <div className="text-xs text-gray-500 truncate">{student.agency}</div>
                                    )}
                                  </div>
                                  <div className="flex gap-0.5 flex-shrink-0">
                                    {ls?.primary_style && (
                                      <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                                        {STYLE_BADGES[ls.primary_style]?.label}
                                      </span>
                                    )}
                                    {ls?.social_style && (
                                      <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                                        {STYLE_BADGES[ls.social_style]?.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unassigned Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropToUnassigned}
              className="bg-white rounded-lg shadow p-4 sticky top-4"
            >
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                Unassigned ({unassignedStudents.length})
              </h3>

              {unassignedStudents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  All students are assigned
                </p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {unassignedStudents.map((student) => {
                    const ls = getLearningStyle(student.id);
                    return (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={() => handleDragStart(student, 'unassigned')}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-move"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {student.first_name} {student.last_name}
                          </div>
                          {student.agency && (
                            <div className="text-xs text-gray-500 truncate">{student.agency}</div>
                          )}
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {ls?.primary_style && (
                            <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                              {STYLE_BADGES[ls.primary_style]?.label}
                            </span>
                          )}
                          {ls?.social_style && (
                            <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                              {STYLE_BADGES[ls.social_style]?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
