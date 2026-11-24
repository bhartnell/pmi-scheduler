// Shared derivation for the NREMT day counts: who is testing, waiting or complete.
// Lifted verbatim out of the Coordinator View (app/labs/schedule/[id]/coordinator) so the
// NREMT hub overview row and the Coordinator View strip can never disagree. Pure functions,
// no I/O. Input shapes are the student-queue API response (students, stations, cells,
// skillColumns, skillCells).

export interface DayStatsStudent {
  id: string;
}
export interface DayStatsStation {
  id: string;
}
export interface DayStatsCell {
  status: string;
}
export interface DayStatsSkillColumn {
  skillName: string;
}

export type StudentDayState = 'testing' | 'waiting' | 'complete';

/** Number of stations this student has completed. */
export function getStudentCompletionCount(
  student: DayStatsStudent,
  stations: DayStatsStation[],
  cells: Record<string, DayStatsCell>
): number {
  let count = 0;
  for (const station of stations) {
    const cell = cells[`${student.id}_${station.id}`];
    if (cell?.status === 'completed') count++;
  }
  return count;
}

/** The first station where this student is in progress, or null. */
export function isStudentCurrentlyTesting<S extends DayStatsStation>(
  student: DayStatsStudent,
  stations: S[],
  cells: Record<string, DayStatsCell>
): S | null {
  for (const station of stations) {
    const cell = cells[`${student.id}_${station.id}`];
    if (cell?.status === 'in_progress') return station;
  }
  return null;
}

/**
 * Complete beats testing (in progress somewhere) beats waiting.
 *
 * Complete is counted BY SKILL when the day has skill columns: a day can run several stations
 * for one skill (Nov 25: 14 stations, 7 skills), so "every station done" is never reached.
 * A student is complete when every skill column has a completed skill cell for them. The old
 * every-station rule stays as the fallback for a day with no skill columns.
 */
export function classifyStudent(
  student: DayStatsStudent,
  stations: DayStatsStation[],
  cells: Record<string, DayStatsCell>,
  skillColumns?: DayStatsSkillColumn[],
  skillCells?: Record<string, DayStatsCell>
): StudentDayState {
  if (skillColumns && skillColumns.length > 0) {
    const allSkillsDone = skillColumns.every(
      (col) => skillCells?.[`${student.id}_${col.skillName}`]?.status === 'completed'
    );
    if (allSkillsDone) return 'complete';
  } else {
    const totalStations = stations.length;
    const completedCount = getStudentCompletionCount(student, stations, cells);
    if (completedCount >= totalStations && totalStations > 0) return 'complete';
  }
  if (isStudentCurrentlyTesting(student, stations, cells)) return 'testing';
  return 'waiting';
}

export interface DayStats {
  students: number;
  testing: number;
  waiting: number;
  complete: number;
  /** Skill-level completion (completed skill cells) and its possible total (students x skills). */
  skillsCompleted: number;
  skillsPossible: number;
}

/** Counts used by the hub overview row. Same rules as the Coordinator View status bar and progress table. */
export function computeDayStats(
  students: DayStatsStudent[],
  stations: DayStatsStation[],
  cells: Record<string, DayStatsCell>,
  skillColumns: DayStatsSkillColumn[],
  skillCells: Record<string, DayStatsCell>
): DayStats {
  let testing = 0;
  let waiting = 0;
  let complete = 0;
  for (const s of students) {
    const state = classifyStudent(s, stations, cells, skillColumns, skillCells);
    if (state === 'testing') testing++;
    else if (state === 'complete') complete++;
    else waiting++;
  }
  let skillsCompleted = 0;
  for (const key of Object.keys(skillCells)) {
    if (skillCells[key].status === 'completed') skillsCompleted++;
  }
  return {
    students: students.length,
    testing,
    waiting,
    complete,
    skillsCompleted,
    skillsPossible: students.length * skillColumns.length,
  };
}
