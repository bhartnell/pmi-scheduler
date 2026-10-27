import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hubCourseOf, hubUrlFor, isAgendaBlock, type HubCourse } from '@/lib/hub-internal';
import { createLabDedupTracker, trackScheduleBlockForLabDedup, isLabDayDeduped } from '@/lib/calendar-lab-dedup';

export interface CalendarEvent {
  id: string;
  source: 'planner' | 'lab_day' | 'lvfr' | 'clinical' | 'shift' | 'meeting' | 'ride_along' | 'exam' | 'volunteer' | 'osce';
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  program?: 'paramedic' | 'emt' | 'aemt' | 'lvfr' | 'other';
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string;
  linked_id?: string;
  linked_url?: string;
  event_type: 'class' | 'lab' | 'exam' | 'clinical' | 'shift' | 'meeting' | 'volunteer' | 'osce' | 'other';
  status?: 'draft' | 'published' | 'cancelled';
  content_notes?: string;
  linked_lab_day_id?: string;
  metadata?: Record<string, unknown>;
}

const PROGRAM_COLORS: Record<string, string> = {
  paramedic: '#3B82F6',
  emt: '#22C55E',
  aemt: '#F59E0B',
  lvfr: '#F97316',
  clinical: '#8B5CF6',
  exam: '#EF4444',
  volunteer: '#14B8A6',
  osce: '#EAB308',
  other: '#6B7280',
  course: '#E11D48',
};

function mapProgramAbbr(abbr: string | undefined | null): CalendarEvent['program'] {
  if (!abbr) return 'other';
  const lower = abbr.toLowerCase();
  if (lower === 'pm' || lower === 'paramedic' || lower.includes('paramed')) return 'paramedic';
  if (lower === 'emt' || lower === 'em') return 'emt';
  if (lower === 'aemt' || lower === 'ae') return 'aemt';
  if (lower === 'lvfr' || lower === 'lv') return 'lvfr';
  return 'other';
}

/**
 * A lab day is a flagged course day (ACLS / PALS / NREMT / testing) when the
 * data says so: priority_flag set, cert_course set, or a testing title. Never
 * decided by date (HOME CAL 4).
 */
function isFlaggedCourseDay(ld: { priority_flag?: string | null; cert_course?: string | null; title?: string | null }): boolean {
  if (ld.cert_course) return true;
  if (ld.priority_flag && ld.priority_flag !== 'normal') return true;
  return /nremt|testing/i.test(ld.title ?? '');
}

function getColor(program: CalendarEvent['program'], eventType: CalendarEvent['event_type']): string {
  if (eventType === 'clinical') return PROGRAM_COLORS.clinical;
  if (eventType === 'exam') return PROGRAM_COLORS.exam;
  if (eventType === 'volunteer') return PROGRAM_COLORS.volunteer;
  if (eventType === 'osce') return PROGRAM_COLORS.osce;
  return PROGRAM_COLORS[program || 'other'] || PROGRAM_COLORS.other;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date') || searchParams.get('start');
    const endDate = searchParams.get('end_date') || searchParams.get('end');
    const includeParam = searchParams.get('include') || 'classes,labs,clinical,lvfr,shifts,ride_along,exams,volunteers';
    const include = new Set(includeParam.split(',').map(s => s.trim()));
    const programsParam = searchParams.get('programs');
    const programFilter = programsParam ? new Set(programsParam.split(',').map(s => s.trim())) : null;
    const instructorId = searchParams.get('instructor_id');
    const cohortId = searchParams.get('cohort_id');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const events: CalendarEvent[] = [];

    // Track linked lab day IDs from schedule blocks to avoid duplicate events.
    // See lib/calendar-lab-dedup.ts for the two dedup signals (explicit FK +
    // date/cohort/section fallback) shared with the ICS feed reader.
    const labDedup = createLabDedupTracker();

    // Hub-internal course rows (PALS P6 item 7): the ACLS / PALS hubs own their
    // section lab_days and agenda blocks. Every other view gets ONE entry per
    // course day (the umbrella planner block) that opens the hub. The hubs
    // themselves, and availability checks that must still see every
    // commitment, pass hub_internal=1 to get the full set.
    const hubInternal = searchParams.get('hub_internal') === '1';
    type CertDay = {
      course: HubCourse;
      cohortId: string | null;
      date: string;
      start: string | null;
      end: string | null;
      cohort: { id?: string; cohort_number?: number; is_test?: boolean; program?: { abbreviation?: string } | null } | null;
    };
    const certDays = new Map<string, CertDay>();
    if (!hubInternal && (include.has('classes') || include.has('labs'))) {
      try {
        let certQuery = supabase
          .from('lab_days')
          .select('id, date, cohort_id, start_time, end_time, cert_course, cohort:cohorts(id, cohort_number, is_test, program:programs(abbreviation))')
          .not('cert_course', 'is', null)
          .eq('is_archived', false)
          .gte('date', startDate)
          .lte('date', endDate);
        if (cohortId) certQuery = certQuery.eq('cohort_id', cohortId);
        const { data: certRows } = await certQuery;
        for (const r of certRows ?? []) {
          const course = hubCourseOf(r.cert_course as string | null);
          if (!course || !r.date) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cohortRaw = r.cohort as any;
          certDays.set(r.id as string, {
            course,
            cohortId: (r.cohort_id as string | null) ?? null,
            date: r.date as string,
            start: (r.start_time as string | null) ?? null,
            end: (r.end_time as string | null) ?? null,
            cohort: Array.isArray(cohortRaw) ? cohortRaw[0] ?? null : cohortRaw ?? null,
          });
        }
      } catch (err) {
        console.error('Error fetching hub course days:', err);
      }
    }
    // Course days that already have their one umbrella entry (planner block).
    const umbrellaKeys = new Set<string>();
    const courseDayKey = (course: string, cohort: string | null | undefined, date: string) => `${course}:${cohort ?? ''}:${date}`;

    // 1. Schedule blocks (classes/exams) from pmi_schedule_blocks
    if (include.has('classes')) {
      try {
        let query = supabase
          .from('pmi_schedule_blocks')
          .select(`
            id, date, start_time, end_time, block_type, title, course_name, color,
            content_notes, status, linked_lab_day_id, linked_section_number,
            instructor_id, additional_instructor_id, actual_start_time, is_parked,
            room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(id, name),
            program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
              id, label,
              cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
                id, cohort_number,
                program:programs(id, name, abbreviation)
              )
            ),
            instructors:pmi_block_instructors(
              instructor:lab_users!pmi_block_instructors_instructor_id_fkey(id, name)
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('start_time');

        if (cohortId) {
          query = query.eq('program_schedule.cohort.id', cohortId);
        }

        const { data: blocks } = await query;

        if (blocks) {
          for (const block of blocks) {
            if (!block.date || !block.start_time || !block.end_time) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ps = block.program_schedule as any;
            const cohort = ps?.cohort;
            // PostgREST's embedded-resource .eq() above does not drop parent rows
            // (no !inner), so other cohorts' blocks (e.g. the EMT Lecture on an ACLS
            // day) leak through with a null embed. Enforce the cohort scope here.
            // Display scope only: availability/conflict detection reads blocks
            // via find-conflicts/find-slots, not this cohort-scoped feed.
            if (cohortId && cohort?.id !== cohortId) continue;

            const progAbbr = cohort?.program?.abbreviation;
            const program = mapProgramAbbr(progAbbr);

            // Apply program filter
            if (programFilter && !programFilter.has(program!)) continue;

            // Apply instructor filter
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const instructors = (block.instructors || []) as any[];
            const instructorNames = instructors
              .map((i) => i.instructor?.name)
              .filter(Boolean) as string[];

            if (instructorId) {
              const hasInstructor = instructors.some((i) => i.instructor?.id === instructorId);
              if (!hasInstructor) continue;
            }

            // Agenda lines belong to the hub's internal schedule, not the calendar.
            if (!hubInternal && isAgendaBlock(block.content_notes as string | null)) continue;

            const blockType = (block.block_type || 'class') as string;
            const eventType: CalendarEvent['event_type'] =
              blockType === 'exam' ? 'exam' :
              blockType === 'lab' ? 'lab' :
              'class';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const roomData = block.room as any;
            const blockStatus = (block.status as CalendarEvent['status']) || 'draft';

            // Track this block for lab-day dedup (explicit FK + fallback
            // date/cohort/section key — see lib/calendar-lab-dedup.ts).
            trackScheduleBlockForLabDedup(labDedup, {
              linked_lab_day_id: block.linked_lab_day_id as string | null,
              linked_section_number: block.linked_section_number as number | null,
              block_type: blockType,
              title: block.title,
              date: block.date,
              cohortId: cohort?.id,
            });

            // The one entry per course day: a planner block linked to a hub
            // section lab day opens the hub, never a lab day page.
            const hubDay = block.linked_lab_day_id ? certDays.get(block.linked_lab_day_id as string) : undefined;
            if (hubDay) umbrellaKeys.add(courseDayKey(hubDay.course, hubDay.cohortId, hubDay.date));

            events.push({
              id: `planner-${block.id}`,
              source: 'planner',
              title: block.title || block.course_name || ps?.label || 'Class Block',
              date: block.date,
              start_time: block.start_time,
              end_time: block.end_time,
              program,
              color: block.color || getColor(program, eventType),
              cohort_number: cohort?.cohort_number,
              instructor_names: instructorNames,
              room: roomData?.name,
              linked_id: block.id,
              linked_url: hubDay ? hubUrlFor(hubDay.course, hubDay.cohortId, hubDay.date) : '/scheduling/planner',
              event_type: eventType,
              status: blockStatus,
              content_notes: (block.content_notes as string) || undefined,
              linked_lab_day_id: (block.linked_lab_day_id as string) || undefined,
              metadata: {
                block_type: block.block_type,
                program_label: ps?.label,
                instructor_id: block.instructor_id ?? null,
                additional_instructor_id: block.additional_instructor_id ?? null,
                actual_start_time: (block.actual_start_time as string | null) ?? null,
                is_parked: (block.is_parked as boolean | null) ?? false,
                linked_section_number: (block.linked_section_number as number | null) ?? null,
                ...(hubDay ? { hub_url: hubUrlFor(hubDay.course, hubDay.cohortId, hubDay.date), hub_course: hubDay.course } : {}),
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching schedule blocks:', err);
      }
    }

    // 2. Lab days — filter out any that are already linked from schedule blocks
    if (include.has('labs')) {
      try {
        let query = supabase
          .from('lab_days')
          .select(`
            id, date, title, start_time, end_time, section_number, section_label,
            priority_flag, cert_course,
            cohort:cohorts(
              id, cohort_number, is_test,
              program:programs(id, name, abbreviation)
            ),
            stations:lab_stations(id, instructor_name)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date');

        if (cohortId) {
          query = query.eq('cohort_id', cohortId);
        }

        const { data: labDays } = await query;

        if (labDays) {
          // Hide the monolithic section-1 fallback on dates that have real
          // sections (2+) — mirrors the ACLS Hub. Keeps the old one-lab-per-day
          // record as the grading fallback without showing it as a duplicate.
          const sectionedDates = new Set(
            (labDays as Array<{ date?: string | null; section_number?: number | null }>)
              .filter((d) => (d.section_number ?? 1) > 1)
              .map((d) => d.date)
          );
          for (const ld of labDays) {
            if (!ld.date) continue;
            // Hub-internal section lab days never appear as calendar events.
            if (certDays.has(ld.id)) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (((ld as any).section_number ?? 1) === 1 && sectionedDates.has(ld.date)) continue;

            // Skip lab days already represented on the calendar by a
            // matching schedule block (either FK-linked or covered by
            // the fallback date+cohort match built during the planner
            // pass above).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ldCohortId = (ld.cohort as any)?.id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ldSection = ((ld as any).section_number as number | null) ?? 1;
            if (isLabDayDeduped(labDedup, ld.id, ld.date, ldCohortId, ldSection)) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cohort = ld.cohort as any;
            const progAbbr = cohort?.program?.abbreviation;
            const program = mapProgramAbbr(progAbbr);

            if (programFilter && !programFilter.has(program!)) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stations = (ld.stations || []) as any[];
            const instructorNames = [...new Set(
              stations.map(s => s.instructor_name).filter(Boolean) as string[]
            )];

            if (instructorId && !instructorNames.length) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ldSec = ((ld as any).section_number as number | null) ?? 1;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ldSecLabel = (ld as any).section_label as string | null;
            // Suffix a section tag only for section 2+ so single-section days
            // (the overwhelming majority) read unchanged.
            const sectionSuffix = ldSec > 1 ? ` · ${ldSecLabel || `Section ${ldSec}`}` : '';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const courseDay = isFlaggedCourseDay(ld as any);
            const openStationCount = stations.filter(s => !s.instructor_name).length;
            events.push({
              id: `lab-${ld.id}`,
              source: 'lab_day',
              title: (ld.title || `Lab Day - C${cohort?.cohort_number || '?'}`) + sectionSuffix,
              date: ld.date,
              start_time: ld.start_time ?? null,
              end_time: ld.end_time ?? null,
              program,
              color: courseDay ? PROGRAM_COLORS.course : getColor(program, 'lab'),
              cohort_number: cohort?.cohort_number,
              instructor_names: instructorNames,
              linked_id: ld.id,
              linked_url: `/labs/schedule/${ld.id}`,
              event_type: 'lab',
              metadata: {
                station_count: stations.length,
                // A flagged course day with nobody on it still needs instructors
                // even when it has no stations (NREMT testing day).
                open_station_count: courseDay && instructorNames.length === 0 ? Math.max(openStationCount, 1) : openStationCount,
                ...(courseDay ? { course_day: true } : {}),
                section_number: ldSec,
                section_label: ldSecLabel || undefined,
                ...(cohort?.is_test ? { is_test: true } : {}),
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching lab days:', err);
      }
    }

    // 2b. A hub course day with no umbrella planner block still gets its one
    // entry, built from the real section rows (earliest start, latest end).
    if (certDays.size > 0 && include.has('labs') && !instructorId) {
      try {
        const groups = new Map<string, CertDay[]>();
        for (const d of certDays.values()) {
          const k = courseDayKey(d.course, d.cohortId, d.date);
          if (umbrellaKeys.has(k)) continue;
          groups.set(k, [...(groups.get(k) ?? []), d]);
        }
        for (const [, rows] of groups) {
          const first = rows[0];
          const program = mapProgramAbbr(first.cohort?.program?.abbreviation);
          if (programFilter && !programFilter.has(program!)) continue;
          const starts = rows.map(r => r.start).filter(Boolean).sort() as string[];
          const ends = rows.map(r => r.end).filter(Boolean).sort() as string[];
          // Day n of N = position among this cohort's course dates.
          let dayLabel = '';
          if (first.cohortId) {
            const { data: allDays } = await supabase
              .from('lab_days')
              .select('date')
              .eq('cohort_id', first.cohortId)
              .eq('cert_course', first.course)
              .eq('is_archived', false);
            const dates = [...new Set((allDays ?? []).map(r => r.date as string))].sort();
            const idx = dates.indexOf(first.date);
            if (idx >= 0) dayLabel = ` (Day ${idx + 1} of ${dates.length})`;
          }
          const hubUrl = hubUrlFor(first.course, first.cohortId, first.date);
          events.push({
            id: `course-day-${first.course}-${first.cohortId ?? 'x'}-${first.date}`,
            source: 'planner',
            title: `${first.course.toUpperCase()}${dayLabel}`,
            date: first.date,
            start_time: starts[0] ?? null,
            end_time: ends[ends.length - 1] ?? null,
            program,
            color: PROGRAM_COLORS.course,
            cohort_number: first.cohort?.cohort_number,
            instructor_names: [],
            linked_url: hubUrl,
            event_type: 'lab',
            metadata: {
              course_day: true,
              hub_url: hubUrl,
              hub_course: first.course,
              ...(first.cohort?.is_test ? { is_test: true } : {}),
            },
          });
        }
      } catch (err) {
        console.error('Error building hub course-day entries:', err);
      }
    }

    // 3. LVFR/AEMT plan placements
    if (include.has('lvfr')) {
      try {
        const { data: placements } = await supabase
          .from('lvfr_aemt_plan_placements')
          .select(`
            id, date, start_time, end_time, custom_title, instructor_name,
            content_block:lvfr_aemt_content_blocks!lvfr_aemt_plan_placements_content_block_id_fkey(
              id, name, block_type, color
            ),
            instance:lvfr_aemt_plan_instances!lvfr_aemt_plan_placements_instance_id_fkey(
              id, name, status
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('start_time');

        if (placements) {
          for (const p of placements) {
            if (!p.date || !p.start_time) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const block = p.content_block as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const instance = p.instance as any;

            // Only PUBLISHED plan instances render on the master calendar.
            // The status was always fetched here but never checked — which
            // let a stale DRAFT plan (Jul 7 start, abandoned 2026-03) render
            // as if real while the actual course runs Jul 14 → Sep 17.
            // Draft plans are planner working data, not schedule truth.
            if (instance?.status !== 'published') continue;

            if (programFilter && !programFilter.has('lvfr')) continue;

            if (instructorId && !p.instructor_name) continue;

            events.push({
              id: `lvfr-${p.id}`,
              source: 'lvfr',
              title: p.custom_title || block?.name || 'LVFR Block',
              date: p.date,
              start_time: p.start_time,
              end_time: p.end_time || p.start_time,
              program: 'lvfr',
              color: block?.color || PROGRAM_COLORS.lvfr,
              instructor_names: p.instructor_name ? [p.instructor_name] : [],
              linked_id: p.id,
              linked_url: '/lvfr-aemt/planner',
              event_type: block?.block_type === 'exam' ? 'exam' : 'class',
              metadata: {
                instance_name: instance?.name,
                instance_status: instance?.status,
                block_type: block?.block_type,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching LVFR placements:', err);
      }
    }

    // 4. Clinical site visits
    if (include.has('clinical')) {
      try {
        let query = supabase
          .from('clinical_site_visits')
          .select(`
            id, visit_date, visit_time, comments,
            site:clinical_sites(id, name, abbreviation),
            cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
            visitor:lab_users(id, name)
          `)
          .gte('visit_date', startDate)
          .lte('visit_date', endDate)
          .order('visit_date');

        if (cohortId) {
          query = query.eq('cohort_id', cohortId);
        }

        const { data: visits } = await query;

        if (visits) {
          for (const v of visits) {
            if (!v.visit_date) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cohort = v.cohort as any;
            const program = mapProgramAbbr(cohort?.program?.abbreviation);

            if (programFilter && !programFilter.has(program!)) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const visitor = v.visitor as any;
            if (instructorId && visitor?.id !== instructorId) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const site = v.site as any;

            events.push({
              id: `clinical-${v.id}`,
              source: 'clinical',
              title: `Clinical: ${site?.name || site?.abbreviation || 'Site Visit'}`,
              date: v.visit_date,
              start_time: v.visit_time || '06:00:00',
              end_time: v.visit_time || '18:00:00',
              program,
              color: PROGRAM_COLORS.clinical,
              cohort_number: cohort?.cohort_number,
              instructor_names: visitor?.name ? [visitor.name] : [],
              linked_id: v.id,
              linked_url: '/clinical/site-visits',
              event_type: 'clinical',
              metadata: {
                site_name: site?.name,
                comments: v.comments,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching clinical visits:', err);
      }
    }

    // 5. Open shifts.
    //
    // Lab-coverage shifts (open_shifts.lab_day_id IS NOT NULL) are
    // intentionally EXCLUDED from the master calendar. They exist for
    // the part-timer signup flow at /scheduling; surfacing them on the
    // master calendar produced a confusing third tile per lab day on
    // top of the existing schedule block + lab_day event. The master
    // calendar is "what's happening" (classes, labs); the shift signup
    // surface is "open staffing slots" — different audiences, different
    // pages. Part-timers continue to see these via /scheduling/shifts.
    if (include.has('shifts')) {
      try {
        const query = supabase
          .from('open_shifts')
          .select(`
            id, title, date, start_time, end_time, location, department,
            is_filled, is_cancelled, lab_day_id,
            signups:shift_signups(
              instructor:instructor_id(id, name),
              status
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('is_cancelled', false)
          .is('lab_day_id', null)
          .order('date')
          .order('start_time');

        const { data: shifts } = await query;

        if (shifts) {
          for (const s of shifts) {
            if (!s.date) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const signups = (s.signups || []) as any[];
            const confirmedInstructors = signups
              .filter(su => su.status === 'confirmed' || su.status === 'signed_up')
              .map(su => su.instructor?.name)
              .filter(Boolean) as string[];

            if (instructorId) {
              const hasInstructor = signups.some(su => su.instructor?.id === instructorId);
              if (!hasInstructor) continue;
            }

            events.push({
              id: `shift-${s.id}`,
              source: 'shift',
              title: s.title || 'Open Shift',
              date: s.date,
              start_time: s.start_time || '08:00:00',
              end_time: s.end_time || '17:00:00',
              program: 'other',
              color: s.is_filled ? '#10B981' : '#F59E0B',
              instructor_names: confirmedInstructors,
              room: s.location || undefined,
              linked_id: s.id,
              linked_url: '/scheduling/shifts',
              event_type: 'shift',
              metadata: {
                department: s.department,
                is_filled: s.is_filled,
                signup_count: signups.length,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching shifts:', err);
      }
    }

    // 6. Ride-along shifts
    if (include.has('ride_along')) {
      try {
        let query = supabase
          .from('ride_along_shifts')
          .select(`
            id, shift_date, start_time, end_time, shift_type, location,
            unit_number, preceptor_name, status, agency_id, cohort_id,
            assignments:ride_along_assignments(id, student_id, status)
          `)
          .gte('shift_date', startDate)
          .lte('shift_date', endDate)
          .neq('status', 'cancelled')
          .order('shift_date')
          .order('start_time');

        if (cohortId) {
          query = query.eq('cohort_id', cohortId);
        }

        const { data: raShifts } = await query;

        if (raShifts) {
          for (const s of raShifts) {
            if (!s.shift_date) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assignments = (s.assignments || []) as any[];
            const activeCount = assignments.filter(
              (a: { status: string }) => a.status !== 'cancelled'
            ).length;

            const shiftLabel = s.shift_type
              ? `${s.shift_type.charAt(0).toUpperCase() + s.shift_type.slice(1)} Shift`
              : 'Shift';

            events.push({
              id: `ride-along-${s.id}`,
              source: 'ride_along',
              title: `Ride-Along: ${shiftLabel}${s.unit_number ? ` (${s.unit_number})` : ''}`,
              date: s.shift_date,
              start_time: s.start_time || '08:00:00',
              end_time: s.end_time || '16:00:00',
              program: 'emt',
              color: PROGRAM_COLORS.clinical,
              instructor_names: s.preceptor_name ? [s.preceptor_name] : [],
              room: s.location || undefined,
              linked_id: s.id,
              linked_url: '/clinical/ride-alongs/shifts',
              event_type: 'clinical',
              metadata: {
                shift_type: s.shift_type,
                unit_number: s.unit_number,
                status: s.status,
                assigned_count: activeCount,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching ride-along shifts:', err);
      }
    }

    // 7. Exam sessions (self-scheduler written exam). Own store, previously
    //    absent from every calendar — so an exam day showed nothing.
    if (include.has('exams')) {
      try {
        const { data: exams } = await supabase
          .from('exam_sessions')
          .select('id, date, start_time, end_time, total_spots, status')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('start_time');

        if (exams) {
          for (const e of exams) {
            if (!e.date) continue;
            // exam sessions aren't cohort-tagged; honor a cohort filter by
            // hiding them only when the caller scoped to a specific cohort.
            if (cohortId) continue;
            if (programFilter && !programFilter.has('other')) continue;

            events.push({
              id: `exam-${e.id}`,
              source: 'exam',
              title: 'Written Exam (self-scheduled)',
              date: e.date,
              start_time: e.start_time ?? null,
              end_time: e.end_time ?? null,
              program: 'other',
              color: getColor('other', 'exam'),
              linked_id: e.id,
              linked_url: '/exam-scheduling',
              event_type: 'exam',
              metadata: {
                total_spots: e.total_spots,
                session_status: e.status,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching exam sessions:', err);
      }
    }

    // 8. Volunteer events (recruitment for NREMT testing / lab days / other).
    //    Own store, previously absent from every calendar.
    if (include.has('volunteers')) {
      try {
        const { data: vols } = await supabase
          .from('volunteer_events')
          .select('id, name, date, start_time, end_time, event_type, description, location, max_volunteers, is_active, linked_lab_day_id')
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('is_active', true)
          .order('date')
          .order('start_time');

        if (vols) {
          for (const v of vols) {
            if (!v.date) continue;
            if (cohortId) continue; // volunteer events aren't cohort-scoped
            if (programFilter && !programFilter.has('other')) continue;

            const vType = (v.event_type as string) || 'other';
            const label = vType === 'nremt_testing' ? 'NREMT Testing' : vType === 'lab_day' ? 'Lab Day' : 'Event';

            events.push({
              id: `volunteer-${v.id}`,
              source: 'volunteer',
              title: `Volunteers: ${(v.name as string) || v.description || label}`,
              date: v.date,
              start_time: v.start_time ?? null,
              end_time: v.end_time ?? null,
              program: 'other',
              color: getColor('other', 'volunteer'),
              room: (v.location as string) || undefined,
              linked_id: v.id,
              linked_url: '/admin/volunteer-events',
              event_type: 'volunteer',
              linked_lab_day_id: (v.linked_lab_day_id as string) || undefined,
              metadata: {
                volunteer_event_type: vType,
                max_volunteers: v.max_volunteers,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching volunteer events:', err);
      }
    }

    // 9. OSCE time blocks. Admin+ see every block; anyone else sees only the
    //    blocks of events they host (created_by) or are an assigned observer on.
    //    Opt-in via include=osce (the home calendar asks for it).
    if (include.has('osce')) {
      try {
        if (cohortId || (programFilter && !programFilter.has('other'))) throw 'skip';
        const isAdmin = hasMinRole(auth.user.role, 'admin');
        const myEmail = auth.user.email.toLowerCase();
        const { data: blocks } = await supabase
          .from('osce_time_blocks')
          .select('id, label, date, start_time, end_time, event_id, osce_events!osce_time_blocks_event_id_fkey(id, title, slug, location, status, created_by)')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('start_time');

        const live = (blocks || []).filter(b => {
          const ev = b.osce_events as unknown as { status?: string } | null;
          return ev && ev.status !== 'archived';
        });
        const blockIds = live.map(b => b.id as string);
        const observersByBlock = new Map<string, { name: string; emails: string[] }[]>();
        if (blockIds.length > 0) {
          const { data: links } = await supabase
            .from('osce_observer_blocks')
            .select('block_id, osce_observers!osce_observer_blocks_observer_id_fkey(name, email, contact_email)')
            .in('block_id', blockIds);
          for (const l of links || []) {
            const o = l.osce_observers as unknown as { name?: string; email?: string; contact_email?: string } | null;
            if (!o) continue;
            const list = observersByBlock.get(l.block_id as string) || [];
            list.push({ name: o.name || o.email || '', emails: [o.email, o.contact_email].filter(Boolean).map(x => (x as string).toLowerCase()) });
            observersByBlock.set(l.block_id as string, list);
          }
        }

        for (const b of live) {
          const ev = b.osce_events as unknown as { id: string; title: string; slug: string; location: string | null; created_by: string | null };
          const observers = observersByBlock.get(b.id as string) || [];
          const isHost = (ev.created_by || '').toLowerCase() === myEmail;
          const isObserver = observers.some(o => o.emails.includes(myEmail));
          if (!isAdmin && !isHost && !isObserver) continue;
          events.push({
            id: `osce-${b.id}`,
            source: 'osce',
            title: `OSCE: ${ev.title} - ${b.label}`,
            date: b.date as string,
            start_time: (b.start_time as string) ?? null,
            end_time: (b.end_time as string) ?? null,
            program: 'other',
            color: getColor('other', 'osce'),
            room: ev.location || undefined,
            instructor_names: observers.map(o => o.name).filter(Boolean),
            linked_id: ev.id,
            linked_url: isAdmin ? `/admin/osce-events/${ev.id}` : `/osce/${ev.slug}`,
            event_type: 'osce',
            metadata: { osce_block_id: b.id, is_host: isHost, is_observer: isObserver },
          });
        }
      } catch (err) {
        if (err !== 'skip') console.error('Error fetching OSCE blocks:', err);
      }
    }

    // Sort all events by date, then start_time
    events.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

    return NextResponse.json({ events });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Unified calendar error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
