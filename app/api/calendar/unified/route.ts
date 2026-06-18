import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export interface CalendarEvent {
  id: string;
  source: 'planner' | 'lab_day' | 'lvfr' | 'clinical' | 'shift' | 'meeting' | 'ride_along' | 'exam' | 'volunteer';
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
  event_type: 'class' | 'lab' | 'exam' | 'clinical' | 'shift' | 'meeting' | 'volunteer' | 'other';
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
  other: '#6B7280',
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

function getColor(program: CalendarEvent['program'], eventType: CalendarEvent['event_type']): string {
  if (eventType === 'clinical') return PROGRAM_COLORS.clinical;
  if (eventType === 'exam') return PROGRAM_COLORS.exam;
  if (eventType === 'volunteer') return PROGRAM_COLORS.volunteer;
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
    // Two dedup signals:
    //   1. Explicit FK: pmi_schedule_blocks.linked_lab_day_id
    //   2. Fallback (date, cohort_id) when a lab-typed schedule block
    //      exists for the same date + cohort but isn't FK-linked. This
    //      catches the user-reported "two blue blocks per lab day"
    //      issue where the planner created a 'lab' block without
    //      stamping the FK back onto the lab_day. The schedule block
    //      already carries the visible title ("Day 1 S2 Lab") so the
    //      lab_day event would just be a redundant tile.
    const linkedLabDayIds = new Set<string>();
    const labBlockDateCohortKeys = new Set<string>();
    // Section-aware dedup key: a lab block only suppresses the lab_day SECTION
    // it represents (block target section = COALESCE(linked_section_number, 1)),
    // so additional sections on the same (date, cohort) stay visible.
    const dateCohortSectionKey = (
      date: string,
      cohortId: string | null | undefined,
      section: number | null | undefined,
    ) => `${date}|${cohortId ?? ''}|${section ?? 1}`;

    // 1. Schedule blocks (classes/exams) from pmi_schedule_blocks
    if (include.has('classes')) {
      try {
        let query = supabase
          .from('pmi_schedule_blocks')
          .select(`
            id, date, start_time, end_time, block_type, title, course_name, color,
            content_notes, status, linked_lab_day_id, linked_section_number,
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

            const blockType = (block.block_type || 'class') as string;
            const eventType: CalendarEvent['event_type'] =
              blockType === 'exam' ? 'exam' :
              blockType === 'lab' ? 'lab' :
              'class';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const roomData = block.room as any;
            const blockStatus = (block.status as CalendarEvent['status']) || 'draft';

            // Track linked lab day IDs so we don't duplicate them
            if (block.linked_lab_day_id) {
              linkedLabDayIds.add(block.linked_lab_day_id as string);
            }
            // Fallback dedup: any 'lab' block (or block with "lab" in
            // its title) on a given date+cohort suppresses the matching
            // lab_day event. Catches lab schedule blocks that weren't
            // explicitly FK-linked.
            const titleLower = (block.title || '').toLowerCase();
            if (
              blockType === 'lab' ||
              titleLower.includes('lab')
            ) {
              // Only suppresses the matching SECTION (block linked_section_number,
              // NULL = section 1) so extra sections that day remain visible.
              const blockSection = (block.linked_section_number as number | null) ?? 1;
              labBlockDateCohortKeys.add(dateCohortSectionKey(block.date, cohort?.id, blockSection));
            }

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
              linked_url: '/scheduling/planner',
              event_type: eventType,
              status: blockStatus,
              content_notes: (block.content_notes as string) || undefined,
              linked_lab_day_id: (block.linked_lab_day_id as string) || undefined,
              metadata: {
                block_type: block.block_type,
                program_label: ps?.label,
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
            cohort:cohorts(
              id, cohort_number,
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (((ld as any).section_number ?? 1) === 1 && sectionedDates.has(ld.date)) continue;

            // Skip lab days already represented on the calendar by a
            // matching schedule block (either FK-linked or covered by
            // the fallback date+cohort match built during the planner
            // pass above).
            if (linkedLabDayIds.has(ld.id)) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ldCohortId = (ld.cohort as any)?.id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ldSection = ((ld as any).section_number as number | null) ?? 1;
            if (labBlockDateCohortKeys.has(dateCohortSectionKey(ld.date, ldCohortId, ldSection))) continue;

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

            events.push({
              id: `lab-${ld.id}`,
              source: 'lab_day',
              title: (ld.title || `Lab Day - C${cohort?.cohort_number || '?'}`) + sectionSuffix,
              date: ld.date,
              start_time: ld.start_time ?? null,
              end_time: ld.end_time ?? null,
              program,
              color: getColor(program, 'lab'),
              cohort_number: cohort?.cohort_number,
              instructor_names: instructorNames,
              linked_id: ld.id,
              linked_url: `/labs/schedule/${ld.id}`,
              event_type: 'lab',
              metadata: {
                station_count: stations.length,
                section_number: ldSec,
                section_label: ldSecLabel || undefined,
              },
            });
          }
        }
      } catch (err) {
        console.error('Error fetching lab days:', err);
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
            id, visit_date, start_time, end_time, status, notes,
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
              start_time: v.start_time || '06:00:00',
              end_time: v.end_time || '18:00:00',
              program,
              color: PROGRAM_COLORS.clinical,
              cohort_number: cohort?.cohort_number,
              instructor_names: visitor?.name ? [visitor.name] : [],
              linked_id: v.id,
              linked_url: '/clinical/site-visits',
              event_type: 'clinical',
              metadata: {
                site_name: site?.name,
                status: v.status,
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
