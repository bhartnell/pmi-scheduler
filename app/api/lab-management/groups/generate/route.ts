import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
}

interface LearningStyle {
  student_id: string;
  primary_style: 'audio' | 'visual' | 'kinesthetic' | null;
  social_style: 'social' | 'independent' | null;
}

interface Preference {
  student_id: string;
  other_student_id: string;
  preference_type: 'avoid' | 'prefer_near';
}

interface GroupAssignment {
  group_index: number;
  student_ids: string[];
}

function generateGroups(
  students: Student[],
  learningStyles: LearningStyle[],
  preferences: Preference[],
  numGroups: number
): { groups: GroupAssignment[]; warnings: string[]; stats: any } {
  const warnings: string[] = [];
  const groups: string[][] = Array.from({ length: numGroups }, () => []);

  // Create lookup maps
  const styleMap = new Map<string, LearningStyle>();
  learningStyles.forEach(ls => styleMap.set(ls.student_id, ls));

  // Build avoidance map
  const avoidMap = new Map<string, Set<string>>();
  preferences.filter(p => p.preference_type === 'avoid').forEach(p => {
    if (!avoidMap.has(p.student_id)) avoidMap.set(p.student_id, new Set());
    if (!avoidMap.has(p.other_student_id)) avoidMap.set(p.other_student_id, new Set());
    avoidMap.get(p.student_id)!.add(p.other_student_id);
    avoidMap.get(p.other_student_id)!.add(p.student_id);
  });

  // Group students by agency
  const agencyGroups = new Map<string, Student[]>();
  const noAgencyStudents: Student[] = [];

  students.forEach(student => {
    if (student.agency) {
      if (!agencyGroups.has(student.agency)) {
        agencyGroups.set(student.agency, []);
      }
      agencyGroups.get(student.agency)!.push(student);
    } else {
      noAgencyStudents.push(student);
    }
  });

  // Track which group each student is in
  const studentGroup = new Map<string, number>();
  const placedStudents = new Set<string>();

  // Helper to check if student has avoidance conflict in group
  const hasAvoidanceConflict = (studentId: string, groupIndex: number): boolean => {
    const avoidSet = avoidMap.get(studentId);
    if (!avoidSet) return false;

    return groups[groupIndex].some(existingId => avoidSet.has(existingId));
  };

  // Helper to get group with fewest members
  const getSmallestGroup = (excludeGroups: number[] = []): number => {
    let minSize = Infinity;
    let minIndex = 0;

    for (let i = 0; i < numGroups; i++) {
      if (excludeGroups.includes(i)) continue;
      if (groups[i].length < minSize) {
        minSize = groups[i].length;
        minIndex = i;
      }
    }

    return minIndex;
  };

  // Helper to get learning style diversity score for a group
  const getLearningStyleCounts = (groupIndex: number): { audio: number; visual: number; kinesthetic: number } => {
    const counts = { audio: 0, visual: 0, kinesthetic: 0 };
    for (const studentId of groups[groupIndex]) {
      const ls = styleMap.get(studentId);
      if (ls?.primary_style === 'audio') counts.audio++;
      else if (ls?.primary_style === 'visual') counts.visual++;
      else if (ls?.primary_style === 'kinesthetic') counts.kinesthetic++;
    }
    return counts;
  };

  // Helper to find best group for a student based on learning style diversity
  const getBestGroupForDiversity = (student: Student, availableGroups: number[]): number => {
    const studentStyle = styleMap.get(student.id)?.primary_style;
    if (!studentStyle) {
      // No learning style - just pick smallest group
      return availableGroups.reduce((best, idx) =>
        groups[idx].length < groups[best].length ? idx : best, availableGroups[0]);
    }

    let bestGroup = availableGroups[0];
    let bestScore = Infinity;

    for (const groupIndex of availableGroups) {
      const counts = getLearningStyleCounts(groupIndex);
      // Score is the count of same learning style - prefer groups with fewer of same style
      const score = studentStyle === 'audio' ? counts.audio :
                    studentStyle === 'visual' ? counts.visual :
                    counts.kinesthetic;

      // Tiebreaker: prefer smaller groups
      const adjustedScore = score * 100 + groups[groupIndex].length;

      if (adjustedScore < bestScore) {
        bestScore = adjustedScore;
        bestGroup = groupIndex;
      }
    }

    return bestGroup;
  };

  // Phase 1: Distribute agency members evenly across groups
  // Sort agencies by size (largest first) for better distribution
  const sortedAgencies = Array.from(agencyGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  for (const [agency, agencyStudents] of sortedAgencies) {
    // Shuffle students within agency for randomness
    const shuffled = [...agencyStudents].sort(() => Math.random() - 0.5);

    for (const student of shuffled) {
      // Find groups that don't have this student's agency yet (or have fewest from this agency)
      const agencyCountPerGroup = groups.map(g =>
        g.filter(id => students.find(s => s.id === id)?.agency === agency).length
      );

      const minAgencyCount = Math.min(...agencyCountPerGroup);
      const preferredGroups = agencyCountPerGroup
        .map((count, idx) => ({ count, idx }))
        .filter(g => g.count === minAgencyCount)
        .map(g => g.idx);

      // Among preferred groups, filter out those with avoidance conflicts
      let availableGroups = preferredGroups.filter(idx => !hasAvoidanceConflict(student.id, idx));

      // If all have conflicts, just use preferred groups
      if (availableGroups.length === 0) {
        availableGroups = preferredGroups;
        // Will add warning later
      }

      // Pick the best group based on learning style diversity
      const targetGroup = getBestGroupForDiversity(student, availableGroups);

      groups[targetGroup].push(student.id);
      studentGroup.set(student.id, targetGroup);
      placedStudents.add(student.id);
    }
  }

  // Phase 2: Place students without agency
  for (const student of noAgencyStudents) {
    // Find smallest groups without avoidance conflicts
    let availableGroups = Array.from({ length: numGroups }, (_, i) => i)
      .filter(idx => !hasAvoidanceConflict(student.id, idx));

    if (availableGroups.length === 0) {
      availableGroups = Array.from({ length: numGroups }, (_, i) => i);
    }

    const targetGroup = getBestGroupForDiversity(student, availableGroups);

    groups[targetGroup].push(student.id);
    studentGroup.set(student.id, targetGroup);
    placedStudents.add(student.id);
  }

  // Phase 3: Balance group sizes
  // If any group is more than 1 student larger than another, try to rebalance
  const targetSize = Math.ceil(students.length / numGroups);

  let iterations = 0;
  while (iterations < 50) { // Safety limit
    const sizes = groups.map(g => g.length);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);

    if (maxSize - minSize <= 1) break; // Balanced within 1 student

    const largestIdx = sizes.indexOf(maxSize);
    const smallestIdx = sizes.indexOf(minSize);

    // Try to move a student from largest to smallest
    let moved = false;
    for (let i = groups[largestIdx].length - 1; i >= 0 && !moved; i--) {
      const studentId = groups[largestIdx][i];
      const student = students.find(s => s.id === studentId);

      // Check if moving would cause avoidance conflict
      if (hasAvoidanceConflict(studentId, smallestIdx)) continue;

      // Check agency distribution
      const studentAgency = student?.agency;
      if (studentAgency) {
        const agencyInTarget = groups[smallestIdx].filter(id =>
          students.find(s => s.id === id)?.agency === studentAgency
        ).length;
        const agencyInSource = groups[largestIdx].filter(id =>
          students.find(s => s.id === id)?.agency === studentAgency
        ).length;

        // Don't move if it would make target have more of this agency than source
        if (agencyInTarget >= agencyInSource - 1) continue;
      }

      // Move student
      groups[largestIdx].splice(i, 1);
      groups[smallestIdx].push(studentId);
      studentGroup.set(studentId, smallestIdx);
      moved = true;
    }

    if (!moved) break; // Can't balance further without violating constraints
    iterations++;
  }

  // Generate warnings for avoidance conflicts
  for (let groupIndex = 0; groupIndex < numGroups; groupIndex++) {
    const groupStudentIds = groups[groupIndex];
    for (const studentId of groupStudentIds) {
      const avoidSet = avoidMap.get(studentId);
      if (!avoidSet) continue;

      for (const otherId of groupStudentIds) {
        if (studentId === otherId) continue;
        if (avoidSet.has(otherId)) {
          const student = students.find(s => s.id === studentId);
          const other = students.find(s => s.id === otherId);
          warnings.push(`Conflict in Group ${groupIndex + 1}: ${student?.first_name} should avoid ${other?.first_name}`);
        }
      }
    }
  }

  // Remove duplicate warnings
  const uniqueWarnings = [...new Set(warnings)];

  // Build stats
  const stats = {
    totalStudents: students.length,
    numGroups,
    groupSizes: groups.map(g => g.length),
    agencyCounts: Object.fromEntries(
      Array.from(agencyGroups.entries()).map(([agency, students]) => [agency, students.length])
    ),
    agencyDistribution: groups.map((g, idx) => {
      const distribution: Record<string, number> = {};
      for (const studentId of g) {
        const student = students.find(s => s.id === studentId);
        if (student?.agency) {
          distribution[student.agency] = (distribution[student.agency] || 0) + 1;
        }
      }
      return { group: idx + 1, agencies: distribution };
    }),
    learningStyleDistribution: groups.map((g, idx) => {
      const counts = { audio: 0, visual: 0, kinesthetic: 0, unassessed: 0 };
      for (const studentId of g) {
        const ls = styleMap.get(studentId);
        if (!ls?.primary_style) counts.unassessed++;
        else if (ls.primary_style === 'audio') counts.audio++;
        else if (ls.primary_style === 'visual') counts.visual++;
        else if (ls.primary_style === 'kinesthetic') counts.kinesthetic++;
      }
      return { group: idx + 1, styles: counts };
    }),
    avoidanceConflicts: uniqueWarnings.length,
  };

  return {
    groups: groups.map((studentIds, idx) => ({
      group_index: idx,
      student_ids: studentIds,
    })),
    warnings: uniqueWarnings,
    stats,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cohort_id, num_groups } = body;

    if (!cohort_id) {
      return NextResponse.json({ success: false, error: 'cohort_id is required' }, { status: 400 });
    }

    const numGroups = num_groups || 4; // Default to 4 groups

    // Get all active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, agency')
      .eq('cohort_id', cohort_id)
      .eq('status', 'active');

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json({ success: false, error: 'No students in cohort' }, { status: 400 });
    }

    // Get learning styles for cohort students
    const studentIds = students.map(s => s.id);
    const { data: learningStyles, error: lsError } = await supabase
      .from('student_learning_styles')
      .select('student_id, primary_style, social_style')
      .in('student_id', studentIds);

    if (lsError) throw lsError;

    // Get seating preferences (can apply to groups too)
    const { data: preferences, error: prefError } = await supabase
      .from('seating_preferences')
      .select('student_id, other_student_id, preference_type')
      .or(`student_id.in.(${studentIds.join(',')}),other_student_id.in.(${studentIds.join(',')})`);

    // Generate groups
    const result = generateGroups(
      students,
      learningStyles || [],
      preferences || [],
      numGroups
    );

    return NextResponse.json({
      success: true,
      groups: result.groups,
      warnings: result.warnings,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Error generating groups:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate groups' }, { status: 500 });
  }
}
