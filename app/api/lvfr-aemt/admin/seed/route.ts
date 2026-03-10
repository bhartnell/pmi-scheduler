import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/admin/seed
//
// Master seed endpoint — reads JSON data files from /data/lvfr-aemt/ and
// upserts into all LVFR AEMT reference tables. Requires admin+ role.
// Idempotent: safe to run multiple times.
// ---------------------------------------------------------------------------

interface ModuleJson {
  id: string;
  number: number;
  name: string;
  chapters: string[];
  teaching_days?: number[];
  exam_day?: number;
  week_range?: string;
  note?: string;
}

interface CourseDayJson {
  day_number: number;
  date: string;
  day_of_week: string;
  week: number;
  module_id: string;
  day_type: string;
  chapters_covered?: string[];
  title?: string;
  has_lab?: boolean;
  lab_name?: string;
  has_exam?: boolean;
  exam_name?: string;
  exam_module?: string;
  has_quiz?: boolean;
  quiz_chapters?: string[];
  time_blocks?: unknown[];
  reinforcement_activities?: unknown[];
}

interface SupplementaryDayJson {
  date: string;
  week: number;
  content: string;
  instructor?: string;
}

interface ChapterJson {
  id: string;
  number: number;
  title: string;
  module_id: string;
  teaching_day?: number | number[];
  estimated_lecture_min?: number;
  estimated_lab_min?: number;
  key_topics?: string[];
  note?: string;
}

interface MedicationJson {
  id: string;
  generic_name: string;
  brand_names?: string[];
  drug_class?: string;
  mechanism_of_action?: string;
  indications?: string[];
  contraindications?: string[];
  dose_adult?: string;
  dose_pediatric?: string;
  route?: string[];
  onset?: string;
  duration?: string;
  side_effects?: string[];
  special_considerations?: string;
  snhd_formulary?: boolean;
  checkpoint_blanks?: string[];
}

interface SkillJson {
  id: string;
  name: string;
  description?: string;
  nremt_tested?: boolean;
  introduced_day?: number;
  practice_days?: number[];
  evaluation_day?: number | null;
  min_practice_attempts?: number;
  equipment_needed?: string[];
  safety_note?: string;
}

interface SkillCategoryJson {
  id: string;
  name: string;
  skills: SkillJson[];
}

interface AssessmentJson {
  id: string;
  category: string;
  day?: number;
  date?: string;
  title: string;
  questions?: number;
  chapters?: string[] | string;
  pass_score?: number;
  note?: string;
}

interface DailyAssignmentJson {
  day: number;
  date: string;
  primary?: string | null;
  secondary?: string | null;
  ben_status?: string;
  min_instructors?: number;
  notes?: string;
}

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(process.cwd(), 'data', 'lvfr-aemt', filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function POST() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const counts: Record<string, number> = {};

    // -----------------------------------------------------------------------
    // 1. Modules — from course_calendar.json
    // -----------------------------------------------------------------------
    const calendarData = readJsonFile<{
      modules: ModuleJson[];
      days: CourseDayJson[];
      supplementary_days: SupplementaryDayJson[];
    }>('course_calendar.json');

    const moduleRows = calendarData.modules.map((m) => ({
      id: m.id,
      number: m.number,
      name: m.name,
      chapters: m.chapters || [],
      exam_day: m.exam_day ?? null,
      week_range: m.week_range || null,
    }));

    const { error: modErr } = await supabase
      .from('lvfr_aemt_modules')
      .upsert(moduleRows, { onConflict: 'id' });
    if (modErr) throw new Error(`Modules: ${modErr.message}`);
    counts.modules = moduleRows.length;

    // -----------------------------------------------------------------------
    // 2. Course Days — from course_calendar.json
    // -----------------------------------------------------------------------
    const dayRows = calendarData.days.map((d) => ({
      day_number: d.day_number,
      date: d.date,
      day_of_week: d.day_of_week,
      week_number: d.week,
      module_id: d.module_id,
      day_type: d.day_type,
      title: d.title || null,
      chapters_covered: d.chapters_covered || [],
      has_lab: d.has_lab || false,
      lab_name: d.lab_name || null,
      has_exam: d.has_exam || false,
      exam_name: d.exam_name || null,
      exam_module: d.exam_module || null,
      has_quiz: d.has_quiz || false,
      quiz_chapters: d.quiz_chapters || [],
      time_blocks: d.time_blocks || null,
      reinforcement_activities: d.reinforcement_activities || null,
    }));

    // Use day_number as the conflict key (UNIQUE constraint)
    const { error: dayErr } = await supabase
      .from('lvfr_aemt_course_days')
      .upsert(dayRows, { onConflict: 'day_number' });
    if (dayErr) throw new Error(`Course days: ${dayErr.message}`);
    counts.course_days = dayRows.length;

    // -----------------------------------------------------------------------
    // 3. Supplementary Days — from course_calendar.json
    // -----------------------------------------------------------------------
    const suppRows = calendarData.supplementary_days.map((s, idx) => ({
      day_number: 100 + idx + 1, // Use 101+ to avoid collision with main days
      date: s.date,
      day_of_week: 'Monday',
      week_number: s.week,
      title: s.content,
      instructor: s.instructor || null,
    }));

    const { error: suppErr } = await supabase
      .from('lvfr_aemt_supplementary_days')
      .upsert(suppRows, { onConflict: 'day_number' });
    if (suppErr) throw new Error(`Supplementary days: ${suppErr.message}`);
    counts.supplementary_days = suppRows.length;

    // -----------------------------------------------------------------------
    // 4. Chapters — from chapters.json
    // -----------------------------------------------------------------------
    const chaptersData = readJsonFile<{ chapters: ChapterJson[] }>('chapters.json');

    const chapterRows = chaptersData.chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      module_id: c.module_id,
      teaching_day: c.teaching_day ?? null, // JSONB — int or array of ints
      estimated_lecture_min: c.estimated_lecture_min || 0,
      estimated_lab_min: c.estimated_lab_min || 0,
      key_topics: c.key_topics || [],
      note: c.note || null,
    }));

    const { error: chErr } = await supabase
      .from('lvfr_aemt_chapters')
      .upsert(chapterRows, { onConflict: 'id' });
    if (chErr) throw new Error(`Chapters: ${chErr.message}`);
    counts.chapters = chapterRows.length;

    // -----------------------------------------------------------------------
    // 5. Medications — from medication_cards.json
    // -----------------------------------------------------------------------
    const medsData = readJsonFile<{ medication_cards: MedicationJson[] }>('medication_cards.json');

    const medRows = medsData.medication_cards.map((m) => ({
      id: m.id,
      generic_name: m.generic_name,
      brand_names: m.brand_names || [],
      drug_class: m.drug_class || null,
      mechanism_of_action: m.mechanism_of_action || null,
      indications: m.indications || [],
      contraindications: m.contraindications || [],
      dose_adult: m.dose_adult || null,
      dose_pediatric: m.dose_pediatric || null,
      route: m.route || [],
      onset: m.onset || null,
      duration: m.duration || null,
      side_effects: m.side_effects || [],
      special_considerations: m.special_considerations || null,
      snhd_formulary: m.snhd_formulary || false,
      checkpoint_blanks: m.checkpoint_blanks || [],
    }));

    const { error: medErr } = await supabase
      .from('lvfr_aemt_medications')
      .upsert(medRows, { onConflict: 'id' });
    if (medErr) throw new Error(`Medications: ${medErr.message}`);
    counts.medications = medRows.length;

    // -----------------------------------------------------------------------
    // 6. Skills — from skills_tracking.json (flatten categories → skills)
    // -----------------------------------------------------------------------
    const skillsData = readJsonFile<{
      skills_tracking: { skill_categories: SkillCategoryJson[] };
    }>('skills_tracking.json');

    const skillRows: Array<Record<string, unknown>> = [];
    for (const cat of skillsData.skills_tracking.skill_categories) {
      for (const s of cat.skills) {
        skillRows.push({
          id: s.id,
          category: cat.name,
          name: s.name,
          description: s.description || null,
          nremt_tested: s.nremt_tested || false,
          introduced_day: s.introduced_day ?? null,
          practice_days: s.practice_days || [],
          evaluation_day: s.evaluation_day ?? null,
          min_practice_attempts: s.min_practice_attempts || 1,
          equipment_needed: s.equipment_needed || [],
          safety_note: s.safety_note || null,
        });
      }
    }

    const { error: skillErr } = await supabase
      .from('lvfr_aemt_skills')
      .upsert(skillRows, { onConflict: 'id' });
    if (skillErr) throw new Error(`Skills: ${skillErr.message}`);
    counts.skills = skillRows.length;

    // -----------------------------------------------------------------------
    // 7. Assessments — from gradebook.json
    // -----------------------------------------------------------------------
    const gradeData = readJsonFile<{
      gradebook: { assessments: AssessmentJson[] };
    }>('gradebook.json');

    const assessmentRows = gradeData.gradebook.assessments.map((a) => ({
      id: a.id,
      category: a.category,
      day_number: a.day ?? null,
      date: a.date || null,
      title: a.title,
      question_count: a.questions ?? null,
      chapters: Array.isArray(a.chapters) ? a.chapters : a.chapters === 'all' ? [] : [],
      pass_score: a.pass_score || 80,
      note: a.note || null,
    }));

    const { error: assessErr } = await supabase
      .from('lvfr_aemt_assessments')
      .upsert(assessmentRows, { onConflict: 'id' });
    if (assessErr) throw new Error(`Assessments: ${assessErr.message}`);
    counts.assessments = assessmentRows.length;

    // -----------------------------------------------------------------------
    // 8. Instructor Assignments — from instructor_scheduling.json
    //    NOTE: primary/secondary fields are instructor JSON IDs (e.g., "inst_ben"),
    //    not UUIDs — we store them as notes since we don't have UUID mappings yet.
    //    Task 105 will establish the UUID mapping.
    // -----------------------------------------------------------------------
    const schedData = readJsonFile<{
      daily_assignments: DailyAssignmentJson[];
    }>('instructor_scheduling.json');

    const assignmentRows = schedData.daily_assignments.map((a) => ({
      day_number: a.day,
      date: a.date,
      min_instructors: a.min_instructors || 1,
      notes: [
        a.primary ? `primary: ${a.primary}` : null,
        a.secondary ? `secondary: ${a.secondary}` : null,
        a.ben_status ? `ben_status: ${a.ben_status}` : null,
        a.notes || null,
      ]
        .filter(Boolean)
        .join(' | ') || null,
    }));

    const { error: assignErr } = await supabase
      .from('lvfr_aemt_instructor_assignments')
      .upsert(assignmentRows, { onConflict: 'day_number' });
    if (assignErr) throw new Error(`Instructor assignments: ${assignErr.message}`);
    counts.instructor_assignments = assignmentRows.length;

    return NextResponse.json({
      success: true,
      message: 'LVFR AEMT data seeded successfully',
      counts,
    });
  } catch (error) {
    console.error('Error seeding LVFR AEMT data:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
