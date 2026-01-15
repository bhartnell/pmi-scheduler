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
  GraduationCap,
  Wand2,
  AlertCircle,
  Printer,
  Download,
  RotateCcw
} from 'lucide-react';
import { canManageContent, type Role } from '@/lib/permissions';

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
  const [generating, setGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [generationStats, setGenerationStats] = useState<any>(null);
  const [numGroupsInput, setNumGroupsInput] = useState(4);

  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [dragSource, setDragSource] = useState<string | 'unassigned' | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && cohortId) {
      fetchData();
      fetchCurrentUser();
    }
  }, [session, cohortId]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    alert('In the print dialog, select "Save as PDF" as your printer to download a PDF.');
    window.print();
  };

  const handleClearAllAssignments = async () => {
    if (!confirm('This will remove all students from their groups. Continue?')) return;

    // Move all students to unassigned
    const allMembers = groups.flatMap(g => g.members);
    setGroups(groups.map(g => ({ ...g, members: [] })));
    setUnassignedStudents([...unassignedStudents, ...allMembers]);
    setHasChanges(true);
  };

  const handleGenerate = async () => {
    if (!confirm(`This will create ${numGroupsInput} groups and auto-assign all students. Existing group assignments will be replaced. Continue?`)) {
      return;
    }

    setGenerating(true);
    setWarnings([]);
    setGenerationStats(null);

    try {
      // First, generate the groups assignment
      const res = await fetch('/api/lab-management/groups/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: cohortId,
          num_groups: numGroupsInput,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Create groups if needed
        const existingGroupCount = groups.length;
        const neededGroups = numGroupsInput - existingGroupCount;

        // Create additional groups if needed
        const newGroupPromises = [];
        for (let i = 0; i < neededGroups; i++) {
          newGroupPromises.push(
            fetch('/api/lab-management/groups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cohort_id: cohortId,
                name: `Group ${existingGroupCount + i + 1}`,
              }),
            }).then(r => r.json())
          );
        }

        const newGroups = await Promise.all(newGroupPromises);
        const allGroups = [...groups, ...newGroups.filter(g => g.success).map(g => ({ ...g.group, members: [] }))];

        // Take only the number of groups we need
        const finalGroups = allGroups.slice(0, numGroupsInput);

        // Build student lookup
        const studentMap = new Map(allStudents.map(s => [s.id, s]));

        // Apply generated assignments to groups
        const updatedGroups = finalGroups.map((group, idx) => {
          const groupAssignment = data.groups.find((g: any) => g.group_index === idx);
          const members = groupAssignment?.student_ids
            .map((id: string) => studentMap.get(id))
            .filter(Boolean) || [];
          return { ...group, members };
        });

        setGroups(updatedGroups);
        setUnassignedStudents([]); // All students should be assigned
        setWarnings(data.warnings || []);
        setGenerationStats(data.stats);
        setHasChanges(true);

        if (data.warnings?.length > 0) {
          setShowWarnings(true);
        }
      } else {
        alert('Failed to generate groups: ' + data.error);
      }
    } catch (error) {
      console.error('Error generating groups:', error);
      alert('Failed to generate groups');
    }

    setGenerating(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !cohort) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Cohort Not Found</h2>
          <Link href="/lab-management/admin/cohorts" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to Cohorts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/cohorts/${cohortId}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {cohort.program.abbreviation} {cohort.cohort_number}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Study Groups</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Study Groups</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {cohort.program.abbreviation} Group {cohort.cohort_number} • {allStudents.length} students
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <div className="flex items-center gap-1 border dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700">
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={numGroupsInput}
                  onChange={(e) => setNumGroupsInput(parseInt(e.target.value) || 4)}
                  className="w-12 text-center text-sm border-none focus:outline-none bg-transparent text-gray-900 dark:text-white"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">groups</span>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                <Wand2 className="w-4 h-4" />
                {generating ? 'Generating...' : 'Auto-Generate'}
              </button>
              <button
                onClick={handleClearAllAssignments}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
              <button
                onClick={handleCreateGroup}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                <Download className="w-4 h-4" />
                PDF
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

      <main className="max-w-7xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block mb-6">
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-3">
            <div>
              <h1 className="text-2xl font-bold">Study Groups</h1>
              <p className="text-gray-600">
                {cohort?.program.abbreviation} Group {cohort?.cohort_number} • {allStudents.length} students
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Printed: {new Date().toLocaleDateString()}</p>
              <p>{groups.length} groups</p>
            </div>
          </div>
          {/* Print Legend */}
          <div className="mt-3 flex gap-4 text-xs">
            <span className="font-medium">Learning Styles:</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-blue-500 text-white rounded flex items-center justify-center text-xs">A</span> Audio</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-500 text-white rounded flex items-center justify-center text-xs">V</span> Visual</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-orange-500 text-white rounded flex items-center justify-center text-xs">K</span> Kinesthetic</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-purple-500 text-white rounded flex items-center justify-center text-xs">S</span> Social</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-gray-500 text-white rounded flex items-center justify-center text-xs">I</span> Independent</span>
          </div>
        </div>

        {/* Warnings Panel */}
        {warnings.length > 0 && showWarnings && (
          <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 print:hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Generation Warnings ({warnings.length})</h3>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-700 dark:text-yellow-400">
                    {warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setShowWarnings(false)}
                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {generationStats && (
              <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 text-xs text-yellow-700 dark:text-yellow-400">
                <span className="font-medium">Stats:</span> {generationStats.totalStudents} students •
                {generationStats.numGroups} groups •
                Sizes: [{generationStats.groupSizes?.join(', ')}] •
                {generationStats.avoidanceConflicts} conflict(s)
              </div>
            )}
          </div>
        )}

        {/* Toggle warnings button if hidden */}
        {warnings.length > 0 && !showWarnings && (
          <button
            onClick={() => setShowWarnings(true)}
            className="mb-4 text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 flex items-center gap-1 print:hidden"
          >
            <AlertCircle className="w-4 h-4" />
            Show {warnings.length} warning(s)
          </button>
        )}

        <div className="flex gap-6 print:block">
          {/* Groups */}
          <div className="flex-1">
            {groups.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">No study groups created yet</p>
                <button
                  onClick={handleCreateGroup}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Create First Group
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
                {groups.map((group) => {
                  const stats = getGroupStats(group.members);
                  return (
                    <div
                      key={group.id}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropToGroup(group.id)}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:border print:break-inside-avoid"
                    >
                      {/* Group Header */}
                      <div className="p-3 border-b dark:border-gray-700 flex items-center justify-between">
                        {editingGroupId === group.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup(group.id)}
                              className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameGroup(group.id)}
                              className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingGroupId(null)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white">{group.name}</span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">({group.members.length})</span>
                            </div>
                            <div className="flex items-center gap-1 print:hidden">
                              <button
                                onClick={() => {
                                  setEditingGroupId(group.id);
                                  setEditingName(group.name);
                                }}
                                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {userRole && canManageContent(userRole) && (
                                <button
                                  onClick={() => handleDeleteGroup(group.id)}
                                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Stats */}
                      {group.members.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(stats.agencies).slice(0, 3).map(([agency, count]) => (
                              <span key={agency} className="px-1.5 py-0.5 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 text-gray-700 dark:text-gray-200">
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
                          <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 border-2 border-dashed dark:border-gray-600 rounded-lg p-4">
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
                                  className="flex items-center gap-2 p-2 rounded-lg border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move"
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                                    {student.photo_url ? (
                                      <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs">
                                        {student.first_name[0]}{student.last_name[0]}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {student.first_name} {student.last_name}
                                    </div>
                                    {student.agency && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.agency}</div>
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
          <div className="w-64 flex-shrink-0 print:hidden">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropToUnassigned}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-4"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Unassigned ({unassignedStudents.length})
              </h3>

              {unassignedStudents.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
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
                        className="flex items-center gap-2 p-2 rounded-lg border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {student.first_name} {student.last_name}
                          </div>
                          {student.agency && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.agency}</div>
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
