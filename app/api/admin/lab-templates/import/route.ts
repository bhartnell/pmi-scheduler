import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Type definitions for import JSON.
//
// This endpoint accepts TWO shapes and routes them to two different
// tables based on top-level keys. Single import URL keeps the admin
// UI simple ("upload your file"); shape detection prevents the
// "uploaded paramedic_s2_courses.json into lab_day_templates"
// class of bug that wedged template apply silently.
//
//   Lab template shape  → lab_day_templates + lab_template_stations
//     {
//       "program": "paramedic",
//       "semester": 2,
//       "templates": [{ "week_number": 1, "stations": [...] }]
//     }
//
//   Course template shape → pmi_course_templates
//     {
//       "program_type": "paramedic",
//       "semester_number": 1,
//       "courses": [
//         { "course_code": "EMS 121",
//           "course_name": "Pharmacology",
//           "day_index": 1,
//           "start_time": "08:30:00",
//           "end_time": "10:30:00",
//           "block_type": "lecture",
//           ... }
//       ]
//     }
//
// Both paths UPSERT on a stable composite key so re-importing the
// same file is idempotent.
// ---------------------------------------------------------------------------
interface SkillDef {
  name: string;
  platinum_skill?: boolean;
  min_attempts?: number;
}

interface StationDef {
  station_type: string;
  station_name: string;
  skills?: SkillDef[];
  scenario_title?: string;
  difficulty?: string;
  format_notes?: string;
}

interface TemplateDef {
  week_number: number;
  day_number: number;
  // Some upstream JSON files use `title`, others use `name`.
  // Both are accepted; the import resolves them via resolveName()
  // below so a missing field doesn't write NULL into
  // lab_day_templates.name (which the schema permits but the UI
  // renders as a blank label).
  title?: string;
  name?: string;
  category: string;
  instructor_count: number;
  is_anchor: boolean;
  anchor_type: string | null;
  requires_review: boolean;
  review_notes: string | null;
  stations: StationDef[];
}

// Field-name fallback for the lab_day_templates.name column.
// Order: explicit `title` → explicit `name` → sentinel placeholder
// "Content Pending" so the row always lands with a non-empty label.
function resolveName(t: TemplateDef): string {
  return t.title || t.name || 'Content Pending';
}

// Convert any thrown error into a readable string. Supabase's
// PostgrestError is a plain object with { message, details, hint,
// code } — calling String() on it produced "[object Object]" and
// hid the real DB error (e.g. "violates check constraint
// lab_day_templates_category_check"). This helper returns the
// richest available text instead.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.details === 'string' && e.details) parts.push(`details=${e.details}`);
    if (typeof e.hint === 'string' && e.hint) parts.push(`hint=${e.hint}`);
    if (typeof e.code === 'string' && e.code) parts.push(`code=${e.code}`);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(err);
    } catch {
      return '[unserializable error]';
    }
  }
  return String(err);
}

// Allowed station_type values are NOT enforced by a DB CHECK; the
// import accepts whatever the upstream JSON ships and stores it
// verbatim. Known-good values (used by the planner UI) include:
//   scenario, skills, skill_drill, briefing, debrief, break, warmup,
//   flex, osce, special_event, extended_block,
//   field_experience  ← e.g. paramedic S2 Week 12 Day 2
// Treat unknown station_type strings as opaque labels rather than
// rejecting them — the operator decides what's meaningful per cohort.

interface ImportPayload {
  program: string;
  semester: number;
  templates: TemplateDef[];
}

interface CourseDef {
  course_code: string;
  course_name: string;
  day_index: number;
  start_time: string;
  end_time: string;
  block_type?: string;
  is_online?: boolean;
  duration_type?: string;
  color?: string | null;
  notes?: string | null;
  sort_order?: number;
  default_instructor_id?: string | null;
  default_instructor_name?: string | null;
  default_instructor_ids?: string[];
}

interface CourseImportPayload {
  program_type: string;
  semester_number?: number;
  courses: CourseDef[];
}

// Detection helper. Returns 'lab' for lab-template payloads, 'course'
// for course-template payloads, or 'unknown' for anything else.
function detectShape(body: unknown): 'lab' | 'course' | 'unknown' {
  if (!body || typeof body !== 'object') return 'unknown';
  const b = body as Record<string, unknown>;
  if (typeof b.program === 'string' && Array.isArray(b.templates)) return 'lab';
  if (typeof b.program_type === 'string' && Array.isArray(b.courses)) return 'course';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// POST /api/admin/lab-templates/import
//
// Accepts JSON body with structure:
//   { program, semester, templates: [ { week_number, day_number, title, category, ... stations: [...] } ] }
//
// Handles duplicates via upsert by (program, semester, week_number, day_number):
//   - If template exists, updates it and replaces stations
//   - If template doesn't exist, creates it
//
// Returns count of templates and stations created/updated.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const rawBody = await request.json();
    const shape = detectShape(rawBody);

    if (shape === 'unknown') {
      return NextResponse.json(
        {
          error:
            'Unrecognised import shape. Expected either ' +
            '{program, semester, templates[]} (lab templates) or ' +
            '{program_type, semester_number, courses[]} (course templates).',
        },
        { status: 400 }
      );
    }

    if (shape === 'course') {
      return await importCourses(rawBody as CourseImportPayload);
    }

    // shape === 'lab' — original lab-template import path.
    const body = rawBody as ImportPayload;
    const { program, semester, templates } = body;

    if (!program || semester === undefined || !templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'program, semester, and templates[] are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let templatesCreated = 0;
    let templatesUpdated = 0;
    let stationsCreated = 0;
    const errors: string[] = [];

    for (const tmpl of templates) {
      try {
        // Check if template already exists for this (program, semester, week_number, day_number)
        const { data: existing } = await supabase
          .from('lab_day_templates')
          .select('id')
          .eq('program', program)
          .eq('semester', semester)
          .eq('week_number', tmpl.week_number)
          .eq('day_number', tmpl.day_number)
          .maybeSingle();

        let templateId: string;

        if (existing) {
          // Update existing template
          const { error: updateError } = await supabase
            .from('lab_day_templates')
            .update({
              name: resolveName(tmpl),
              category: tmpl.category,
              day_number: tmpl.day_number,
              instructor_count: tmpl.instructor_count,
              is_anchor: tmpl.is_anchor,
              anchor_type: tmpl.anchor_type,
              requires_review: tmpl.requires_review,
              review_notes: tmpl.review_notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          templateId = existing.id;

          // Delete old stations before re-inserting
          await supabase
            .from('lab_template_stations')
            .delete()
            .eq('template_id', templateId);

          templatesUpdated++;
        } else {
          // Insert new template
          const { data: newTemplate, error: insertError } = await supabase
            .from('lab_day_templates')
            .insert({
              name: resolveName(tmpl),
              program,
              semester,
              week_number: tmpl.week_number,
              day_number: tmpl.day_number,
              category: tmpl.category,
              instructor_count: tmpl.instructor_count,
              is_anchor: tmpl.is_anchor,
              anchor_type: tmpl.anchor_type,
              requires_review: tmpl.requires_review,
              review_notes: tmpl.review_notes,
              template_data: {},
              is_shared: true,
              created_by: user.email,
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          templateId = newTemplate.id;
          templatesCreated++;
        }

        // Insert stations
        if (tmpl.stations && tmpl.stations.length > 0) {
          const stationRows = tmpl.stations.map((s, idx) => ({
            template_id: templateId,
            sort_order: idx + 1,
            station_type: s.station_type,
            station_name: s.station_name || null,
            skills: s.skills && s.skills.length > 0 ? s.skills : null,
            scenario_title: s.scenario_title || null,
            difficulty: s.difficulty || null,
            notes: s.format_notes || null,
          }));

          const { error: stationError } = await supabase
            .from('lab_template_stations')
            .insert(stationRows);

          if (stationError) throw stationError;
          stationsCreated += stationRows.length;
        }
      } catch (err: unknown) {
        errors.push(
          `Week ${tmpl.week_number} Day ${tmpl.day_number}: ${describeError(err)}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        program,
        semester,
        templates_created: templatesCreated,
        templates_updated: templatesUpdated,
        stations_created: stationsCreated,
        total_templates: templates.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error importing lab templates:', error);
    return NextResponse.json({ error: 'Failed to import lab templates' }, { status: 500 });
  }
}

/**
 * Course-template import path. Writes to pmi_course_templates with
 * UPSERT keyed on (program_type, semester_number, course_code,
 * day_index, start_time) — same composite that uniquely identifies
 * a course block in the planner.
 *
 * Skips rows missing the minimum required fields (course_code,
 * day_index, start_time, end_time) and reports them in errors[]
 * rather than failing the whole import. Idempotent on re-import.
 */
async function importCourses(body: CourseImportPayload): Promise<NextResponse> {
  const programType = (body.program_type || '').trim().toLowerCase();
  const semesterNumber = body.semester_number ?? null;
  const courses = body.courses;

  if (!programType || !Array.isArray(courses)) {
    return NextResponse.json(
      { error: 'program_type and courses[] are required for course-template imports' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  let coursesCreated = 0;
  let coursesUpdated = 0;
  const errors: string[] = [];

  for (const c of courses) {
    if (!c.course_code || c.day_index === undefined || !c.start_time || !c.end_time) {
      errors.push(
        `Skipped course (missing required field): code=${c.course_code ?? '?'} day=${c.day_index ?? '?'} start=${c.start_time ?? '?'}`
      );
      continue;
    }
    try {
      const lookup = supabase
        .from('pmi_course_templates')
        .select('id')
        .eq('program_type', programType)
        .eq('course_code', c.course_code)
        .eq('day_index', c.day_index)
        .eq('start_time', c.start_time);
      // Match the semester filter the planner uses when fetching —
      // including a NULL-safe match here so two semesters don't
      // collide on the same course/day/time.
      const lookupQ = semesterNumber === null
        ? lookup.is('semester_number', null)
        : lookup.eq('semester_number', semesterNumber);
      const { data: existing } = await lookupQ.maybeSingle();

      const row: Record<string, unknown> = {
        program_type: programType,
        semester_number: semesterNumber,
        course_code: c.course_code,
        course_name: c.course_name ?? c.course_code,
        duration_type: c.duration_type || 'full',
        day_index: c.day_index,
        start_time: c.start_time,
        end_time: c.end_time,
        block_type: c.block_type || 'lecture',
        is_online: c.is_online ?? false,
        color: c.color ?? null,
        notes: c.notes ?? null,
        sort_order: c.sort_order ?? 0,
        default_instructor_id: c.default_instructor_id ?? null,
        default_instructor_name: c.default_instructor_name ?? null,
        default_instructor_ids: Array.isArray(c.default_instructor_ids)
          ? c.default_instructor_ids
          : [],
      };

      if (existing) {
        const { error: updErr } = await supabase
          .from('pmi_course_templates')
          .update(row)
          .eq('id', existing.id);
        if (updErr) throw updErr;
        coursesUpdated++;
      } else {
        const { error: insErr } = await supabase
          .from('pmi_course_templates')
          .insert(row);
        if (insErr) throw insErr;
        coursesCreated++;
      }
    } catch (err) {
      errors.push(
        `${c.course_code} day=${c.day_index} start=${c.start_time}: ${describeError(err)}`
      );
    }
  }

  return NextResponse.json({
    success: true,
    target: 'course_templates',
    summary: {
      program_type: programType,
      semester_number: semesterNumber,
      courses_created: coursesCreated,
      courses_updated: coursesUpdated,
      total_courses: courses.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}
