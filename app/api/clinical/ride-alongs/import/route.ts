import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────────────

function excelDateToDate(serial: number | string): Date | null {
  if (typeof serial === 'string') {
    const d = new Date(serial);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof serial !== 'number') return null;
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400000);
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseTimeRange(timeStr: string): { start: string | null; end: string | null } {
  if (!timeStr) return { start: null, end: null };
  const m = timeStr.match(/(\d{4})-(\d{4})/);
  if (!m) return { start: null, end: null };
  const fmt = (t: string) => t.substring(0, 2) + ':' + t.substring(2, 4);
  return { start: fmt(m[1]), end: fmt(m[2]) };
}

function classifyShiftType(startTime: string | null): string | null {
  if (!startTime) return null;
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour >= 3 && hour < 12) return 'day';
  if (hour >= 12 && hour <= 16) return 'swing';
  if (hour >= 17 && hour <= 23) return 'night';
  return 'night';
}

const PRECEPTOR_MAP: Record<string, string> = {
  '203A': 'AEMT Dolane',
  '210B': 'AEMT Dylan',
  '211B': 'AEMT Phoenix',
  '302B': 'Medic Ashli',
  '315A': 'Medic Phil',
  '319A': 'Medic Michael',
  '332B': 'Medic Charles',
};

interface ParsedTemplate {
  name: string;
  unit_number: string;
  day_of_week: number;
  shift_type: string;
  start_time: string;
  end_time: string;
  preceptor_name: string;
}

interface ParsedAvailability {
  email: string;
  firstName: string;
  lastName: string;
  available_days: Record<string, boolean>;
  preferred_shift_type: string[];
  notes: string | null;
}

interface ParsedShift {
  date: string;
  dayName: string;
  unit: string;
  preceptor: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  studentName: string;
  notes: string | null;
}

interface ParseResult {
  templates: ParsedTemplate[];
  availability: ParsedAvailability[];
  shifts: ParsedShift[];
  warnings: string[];
}

function parseWorkbook(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];

  // Parse Units tab for templates
  const templates: ParsedTemplate[] = [];
  const unitsSheet = wb.Sheets['Units'];
  if (unitsSheet) {
    const unitsData = XLSX.utils.sheet_to_json(unitsSheet, { header: 1 }) as unknown[][];
    // Parse the structured columns: Fri (cols 0-1), Sat (cols 2-3), Sun (cols 4-5)
    const dayMapping: [number, number, string][] = [[0, 1, 'Friday'], [2, 3, 'Saturday'], [4, 5, 'Sunday']];
    const dayInt: Record<string, number> = { Friday: 5, Saturday: 6, Sunday: 0 };

    for (let rowIdx = 3; rowIdx < unitsData.length; rowIdx++) {
      const row = unitsData[rowIdx];
      for (const [unitCol, timeCol, dayName] of dayMapping) {
        const unit = (row[unitCol] || '').toString().trim();
        const time = (row[timeCol] || '').toString().trim();
        if (!unit || !time) continue;
        const { start, end } = parseTimeRange(time);
        if (!start || !end) continue;
        const preceptor = PRECEPTOR_MAP[unit] || unit;
        const dayNames: Record<number, string> = { 0: 'Sun', 5: 'Fri', 6: 'Sat' };
        templates.push({
          name: `${unit} ${dayNames[dayInt[dayName]]} ${time}`,
          unit_number: unit,
          day_of_week: dayInt[dayName],
          shift_type: classifyShiftType(start) || 'day',
          start_time: start,
          end_time: end,
          preceptor_name: preceptor,
        });
      }
    }
  }

  // Parse Form Responses for availability
  const availability: ParsedAvailability[] = [];
  const formSheet = wb.Sheets['Form Responses 1'];
  if (formSheet) {
    const formData = XLSX.utils.sheet_to_json(formSheet, { header: 1 }) as unknown[][];
    const latestByName = new Map<string, ParsedAvailability & { timestamp: number }>();

    for (let i = 1; i < formData.length; i++) {
      const row = formData[i];
      if (!row || !row[1]) continue;
      const email = (row[1] || '').toString().trim().toLowerCase();
      const firstName = (row[2] || '').toString().trim();
      const lastName = (row[3] || '').toString().trim();
      const dayPref = (row[4] || '').toString();
      const shiftPref = (row[5] || '').toString();
      const comments = (row[6] || '').toString().trim();
      const timestamp = row[0] as number;

      const available_days: Record<string, boolean> = {};
      const dayNames = ['friday', 'saturday', 'sunday'];
      if (dayPref.toLowerCase().includes('no preference')) {
        dayNames.forEach(d => available_days[d] = true);
      } else {
        for (const d of dayNames) {
          if (dayPref.toLowerCase().includes(d)) available_days[d] = true;
        }
      }

      let preferred_shift_type: string[] = [];
      if (shiftPref.toLowerCase().includes('no preference')) {
        preferred_shift_type = ['day', 'swing', 'night'];
      } else {
        if (shiftPref.toLowerCase().includes('day shift')) preferred_shift_type.push('day');
        if (shiftPref.toLowerCase().includes('swing shift')) preferred_shift_type.push('swing');
        if (shiftPref.toLowerCase().includes('night shift')) preferred_shift_type.push('night');
      }

      const nameKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
      const existing = latestByName.get(nameKey);
      const entry = {
        email, firstName, lastName,
        available_days, preferred_shift_type,
        notes: comments || null,
        timestamp,
      };
      if (!existing || (timestamp && existing.timestamp && timestamp > existing.timestamp)) {
        if (existing && existing.email.endsWith('@my.pmi.edu') && !email.endsWith('@my.pmi.edu')) {
          entry.email = existing.email;
        }
        latestByName.set(nameKey, entry);
      }
    }
    availability.push(...latestByName.values());
  }

  // Parse Master Schedule for shifts
  const shifts: ParsedShift[] = [];
  const masterSheet = wb.Sheets['Master Schedule'];
  if (masterSheet) {
    const masterData = XLSX.utils.sheet_to_json(masterSheet, { header: 1 }) as unknown[][];
    for (let i = 2; i < masterData.length; i++) {
      const row = masterData[i];
      if (!row || row[0] == null) continue;
      if (typeof row[0] === 'string' && (row[0].startsWith('Legend') || row[0].startsWith('EMT') || row[0] === 'Date')) continue;

      const unit = (row[2] || '').toString().trim();
      const preceptor = (row[3] || '').toString().trim();
      const timeRange = (row[4] || '').toString().trim();
      const studentName = (row[5] || '').toString().trim();
      const notes = (row[6] || '').toString().trim() || null;

      if (!unit || !studentName) continue;

      const date = excelDateToDate(row[0] as number | string);
      if (!date) {
        warnings.push(`Could not parse date for row ${i}: ${row[0]}`);
        continue;
      }

      const { start, end } = parseTimeRange(timeRange);
      shifts.push({
        date: formatDate(date) || '',
        dayName: (row[1] || '').toString().trim(),
        unit,
        preceptor,
        startTime: start || '',
        endTime: end || '',
        shiftType: classifyShiftType(start) || 'day',
        studentName,
        notes,
      });
    }
  }

  return { templates, availability, shifts, warnings };
}

// POST /api/clinical/ride-alongs/import — preview or execute import
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const action = formData.get('action') as string; // 'preview' or 'import'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseWorkbook(buffer);

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        preview: {
          templates: parsed.templates,
          availability: parsed.availability,
          shifts: parsed.shifts,
          warnings: parsed.warnings,
        },
      });
    }

    // Execute import
    const supabase = getSupabaseAdmin();
    const results = {
      templatesCreated: 0,
      templatesUpdated: 0,
      availabilityImported: 0,
      availabilitySkipped: 0,
      shiftsCreated: 0,
      assignmentsCreated: 0,
      assignmentsSkipped: 0,
      warnings: [...parsed.warnings],
    };

    // Load students for matching
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .order('last_name');

    if (!students) {
      return NextResponse.json({ success: false, error: 'Failed to load students' }, { status: 500 });
    }

    const matchStudent = (name: string, email?: string) => {
      if (email) {
        const byEmail = students.find(s => s.email?.toLowerCase() === email.toLowerCase());
        if (byEmail) return byEmail;
      }
      if (!name) return null;
      const parts = name.trim().split(/\s+/);
      if (parts.length < 2) return null;
      const firstName = parts[0].toLowerCase();
      const lastName = parts.slice(1).join(' ').toLowerCase();

      return students.find(s =>
        s.first_name.toLowerCase() === firstName && s.last_name.toLowerCase() === lastName
      ) || students.find(s =>
        s.first_name.toLowerCase() === firstName &&
        (s.last_name.toLowerCase().includes(lastName) || lastName.includes(s.last_name.toLowerCase()))
      ) || null;
    };

    // 1. Import templates
    for (const t of parsed.templates) {
      const { data: existing } = await supabase
        .from('ride_along_templates')
        .select('id')
        .eq('unit_number', t.unit_number)
        .eq('day_of_week', t.day_of_week);

      if (existing && existing.length > 0) {
        await supabase.from('ride_along_templates').update({
          name: t.name, shift_type: t.shift_type, start_time: t.start_time,
          end_time: t.end_time, preceptor_name: t.preceptor_name, is_active: true,
        }).eq('id', existing[0].id);
        results.templatesUpdated++;
      } else {
        await supabase.from('ride_along_templates').insert({
          name: t.name, unit_number: t.unit_number, day_of_week: t.day_of_week,
          shift_type: t.shift_type, start_time: t.start_time, end_time: t.end_time,
          max_students: 1, preceptor_name: t.preceptor_name, is_active: true,
        });
        results.templatesCreated++;
      }
    }

    // 2. Import availability
    for (const a of parsed.availability) {
      const student = matchStudent(`${a.firstName} ${a.lastName}`, a.email);
      if (!student) {
        results.warnings.push(`No student match for ${a.firstName} ${a.lastName} (${a.email})`);
        results.availabilitySkipped++;
        continue;
      }

      const { data: existing } = await supabase
        .from('ride_along_availability')
        .select('id')
        .eq('student_id', student.id);

      if (existing && existing.length > 0) {
        await supabase.from('ride_along_availability').update({
          available_days: a.available_days,
          preferred_shift_type: a.preferred_shift_type,
          notes: a.notes,
        }).eq('student_id', student.id);
      } else {
        await supabase.from('ride_along_availability').insert({
          student_id: student.id,
          available_days: a.available_days,
          preferred_shift_type: a.preferred_shift_type,
          notes: a.notes,
        });
      }
      results.availabilityImported++;
    }

    // 3. Import shifts + assignments
    const shiftIdMap = new Map<string, string>();

    for (const s of parsed.shifts) {
      const key = `${s.date}_${s.unit}`;

      if (!shiftIdMap.has(key)) {
        const { data: existing } = await supabase
          .from('ride_along_shifts')
          .select('id')
          .eq('shift_date', s.date)
          .eq('unit_number', s.unit);

        if (existing && existing.length > 0) {
          shiftIdMap.set(key, existing[0].id);
        } else {
          const { data: newShift } = await supabase
            .from('ride_along_shifts')
            .insert({
              shift_date: s.date, shift_type: s.shiftType,
              start_time: s.startTime, end_time: s.endTime,
              unit_number: s.unit, preceptor_name: s.preceptor,
              status: 'filled', location: 'LVFR',
            })
            .select('id')
            .single();
          if (newShift) {
            shiftIdMap.set(key, newShift.id);
            results.shiftsCreated++;
          }
        }
      }

      const shiftId = shiftIdMap.get(key);
      if (!shiftId) continue;

      const student = matchStudent(s.studentName);
      if (!student) {
        results.warnings.push(`No student match for "${s.studentName}"`);
        results.assignmentsSkipped++;
        continue;
      }

      const { data: existingAssign } = await supabase
        .from('ride_along_assignments')
        .select('id')
        .eq('shift_id', shiftId)
        .eq('student_id', student.id);

      if (!existingAssign || existingAssign.length === 0) {
        await supabase.from('ride_along_assignments').insert({
          shift_id: shiftId, student_id: student.id,
          status: 'assigned', preceptor_name: s.preceptor, notes: s.notes,
        });
        results.assignmentsCreated++;
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error importing ride-along data:', error);
    return NextResponse.json(
      { success: false, error: 'Import failed' },
      { status: 500 }
    );
  }
}
