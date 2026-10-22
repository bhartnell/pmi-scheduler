// Student view home (mock v3): pure shaping of a student's own team-lead log and
// upcoming lab days. Scenario side only - no skills, no instructor notes, no watch flags.
import { summarizeTeamLeads, type TeamLeadLogRow, type TeamLeadProgress } from './team-lead-requirements.ts';

export interface StudentLeadRow extends TeamLeadLogRow {
  date: string;
  title: string | null;
  room: string | null;
}

export interface StudentLabDayRow {
  date: string;
  title: string | null;
  start_time: string | null;
  cert_course: string | null;
  is_archived: boolean | null;
}

export type CourseStatus = 'passed' | 'needs_retest' | 'coming_up' | 'not_yet';

export interface StudentHome {
  leads: {
    total: number;
    /** Rows with no course/phase: labs and earlier. Never guessed into ACLS/PALS. */
    lab: number;
    acls: number;
    pals: number;
    lastDate: string | null;
    graded: { pass: number; needsRep: number };
  };
  acls: { status: CourseStatus; date: string | null };
  pals: { status: CourseStatus; date: string | null; upcomingStart: string | null; upcomingEnd: string | null };
  cases: Array<{ date: string; title: string; room: string | null; result: 'pass' | 'needs_rep' | 'led' }>;
  comingUp: Array<{ date: string; title: string; startTime: string | null; kind: 'lab' | 'cert' }>;
}

const isCert = (d: StudentLabDayRow) => !!d.cert_course || /certification/i.test(d.title ?? '');
const norm = (v?: string | null) => v?.toLowerCase() ?? '';

function courseStatus(p: TeamLeadProgress['ACLS'], hasUpcoming: boolean): CourseStatus {
  if (p.testing.met) return 'passed';
  if (p.testing.attempts > 0) return 'needs_retest';
  return hasUpcoming ? 'coming_up' : 'not_yet';
}

export function buildStudentHome(
  leadRows: StudentLeadRow[], labDays: StudentLabDayRow[], today: string, maxCases = 12, maxUpcoming = 4,
): StudentHome {
  const prog = summarizeTeamLeads(leadRows);
  const sorted = [...leadRows].sort((a, b) => b.date.localeCompare(a.date));

  const upcoming = labDays
    .filter((d) => !d.is_archived && d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  // One entry per date: lab days carry one row per section.
  const seen = new Set<string>();
  const perDate = upcoming.filter((d) => (seen.has(d.date) ? false : (seen.add(d.date), true)));
  const palsDays = perDate.filter((d) => /pals/i.test(d.title ?? '') && isCert(d));
  const aclsDays = perDate.filter((d) => /acls/i.test(d.title ?? '') && isCert(d));

  const graded = leadRows.filter((r) => norm(r.result) === 'pass' || norm(r.result) === 'fail');
  const passed = (c: 'acls' | 'pals') => sorted.find((r) => norm(r.course) === c && norm(r.phase) === 'testing' && norm(r.result) === 'pass')?.date ?? null;

  return {
    leads: {
      total: leadRows.length,
      lab: prog.unclassified,
      acls: prog.ACLS.practice.count + prog.ACLS.testing.attempts,
      pals: prog.PALS.practice.count + prog.PALS.testing.attempts,
      lastDate: sorted[0]?.date ?? null,
      graded: {
        pass: graded.filter((r) => norm(r.result) === 'pass').length,
        needsRep: graded.filter((r) => norm(r.result) === 'fail').length,
      },
    },
    acls: { status: courseStatus(prog.ACLS, aclsDays.length > 0), date: passed('acls') },
    pals: {
      status: courseStatus(prog.PALS, palsDays.length > 0), date: passed('pals'),
      upcomingStart: palsDays[0]?.date ?? null, upcomingEnd: palsDays[palsDays.length - 1]?.date ?? null,
    },
    cases: sorted.slice(0, maxCases).map((r) => ({
      date: r.date, title: r.title ?? 'Scenario', room: r.room,
      result: norm(r.result) === 'pass' ? 'pass' : norm(r.result) === 'fail' ? 'needs_rep' : 'led',
    })),
    comingUp: perDate.slice(0, maxUpcoming).map((d) => ({
      date: d.date, title: d.title ?? 'Lab day', startTime: d.start_time, kind: isCert(d) ? 'cert' : 'lab',
    })),
  };
}
