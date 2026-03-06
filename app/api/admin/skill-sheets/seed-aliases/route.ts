import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// Common station skill name aliases → skill_sheet_assignments
//
// Maps the short names instructors use in station configurations to the actual
// imported skill sheets. Uses upsert on (skill_name, skill_sheet_id, program)
// so this is idempotent — safe to re-run.
// ---------------------------------------------------------------------------

// Each alias maps a station name → one or more { sheetName, source } targets.
// We look up the actual skill_sheet.id at runtime by matching skill_name + source.
interface AliasMapping {
  stationName: string;
  programs: string[]; // which programs this alias applies to
  targets: { skillName: string; source: string }[];
}

const ALIASES: AliasMapping[] = [
  // ── ASSESSMENT ──
  {
    stationName: 'Medical Assessment',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Patient assessment and management — medical', source: 'nremt' },
      { skillName: 'Perform a Comprehensive Physical Assessment', source: 'platinum' },
    ],
  },
  {
    stationName: 'Trauma Assessment',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Patient assessment and management — trauma', source: 'nremt' },
      { skillName: 'Perform a Comprehensive Physical Assessment', source: 'platinum' },
    ],
  },
  {
    stationName: 'Patient Assessment',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Patient assessment and management — medical', source: 'nremt' },
      { skillName: 'Patient assessment and management — trauma', source: 'nremt' },
      { skillName: 'Perform a Comprehensive Physical Assessment', source: 'platinum' },
    ],
  },
  {
    stationName: 'Vitals',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Assess Vital Signs', source: 'platinum' },
    ],
  },

  // ── VASCULAR ACCESS ──
  {
    stationName: 'IV Access',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Establish IV access', source: 'platinum' },
      { skillName: 'Obtaining Vascular Access', source: 'publisher' },
    ],
  },
  {
    stationName: 'IV Start',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Establish IV access', source: 'platinum' },
      { skillName: 'Obtaining Vascular Access', source: 'publisher' },
    ],
  },
  {
    stationName: 'IV',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Establish IV access', source: 'platinum' },
      { skillName: 'Obtaining Vascular Access', source: 'publisher' },
    ],
  },
  {
    stationName: 'IO Access',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Establish IO access', source: 'platinum' },
    ],
  },
  {
    stationName: 'IO',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Establish IO access', source: 'platinum' },
    ],
  },

  // ── AIRWAY ──
  {
    stationName: 'BVM',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'BVM ventilation of an apneic adult patient', source: 'nremt' },
      { skillName: 'Perform PPV with BVM', source: 'platinum' },
      { skillName: 'Ventilate an Adult Patient with a BVM', source: 'platinum' },
    ],
  },
  {
    stationName: 'BVM Ventilation',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'BVM ventilation of an apneic adult patient', source: 'nremt' },
      { skillName: 'Perform PPV with BVM', source: 'platinum' },
      { skillName: 'Ventilate an Adult Patient with a BVM', source: 'platinum' },
    ],
  },
  {
    stationName: 'Intubation',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform oral endotracheal intubation', source: 'platinum' },
    ],
  },
  {
    stationName: 'ETI',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform oral endotracheal intubation', source: 'platinum' },
    ],
  },
  {
    stationName: 'Endotracheal Intubation',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform oral endotracheal intubation', source: 'platinum' },
    ],
  },
  {
    stationName: 'Airway Management',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Insert supraglottic airway', source: 'platinum' },
      { skillName: 'Perform oral endotracheal intubation', source: 'platinum' },
    ],
  },
  {
    stationName: 'SGA',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Insert supraglottic airway', source: 'platinum' },
    ],
  },
  {
    stationName: 'King Airway',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Insert supraglottic airway', source: 'platinum' },
    ],
  },
  {
    stationName: 'Suctioning',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform Oral Suctioning', source: 'platinum' },
      { skillName: 'Perform endotracheal suctioning', source: 'platinum' },
    ],
  },
  {
    stationName: 'CPAP',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Using CPAP', source: 'publisher' },
    ],
  },
  {
    stationName: 'Cricothyrotomy',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform cricothyrotomy', source: 'platinum' },
    ],
  },
  {
    stationName: 'Cric',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform cricothyrotomy', source: 'platinum' },
    ],
  },

  // ── IMMOBILIZATION ──
  {
    stationName: 'Spinal Immobilization',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
      { skillName: 'Perform Spine Motion Restriction', source: 'platinum' },
    ],
  },
  {
    stationName: 'SMR',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform Spine Motion Restriction', source: 'platinum' },
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Spine Motion Restriction',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform Spine Motion Restriction', source: 'platinum' },
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'KED',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Short Board',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'KED / Short Board',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Seated Spinal',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Seated Immobilization',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Helmet Removal',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Removing a Helmet', source: 'publisher' },
    ],
  },
  {
    stationName: 'Football Helmet Removal',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Removing a Helmet', source: 'publisher' },
    ],
  },
  {
    stationName: 'Helmet Remove',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Removing a Helmet', source: 'publisher' },
    ],
  },
  // ── SPINAL MOTION RESTRICTION (seated → NREMT seated, supine → NREMT supine) ──
  {
    stationName: 'Short Board Spinal Motion Restriction',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Short Board SMR',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Spinal Motion Restriction',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'SMR',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Spinal Motion Restriction — Seated',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'SMR Seated',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — seated patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Spinal Motion Restriction — Supine',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'SMR Supine',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Long Board',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Long Board SMR',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Spinal immobilization — supine patient', source: 'nremt' },
    ],
  },
  {
    stationName: 'Splinting',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Joint immobilization', source: 'nremt' },
      { skillName: 'Long bone immobilization', source: 'nremt' },
      { skillName: 'Splint a Suspected Joint Injury', source: 'platinum' },
      { skillName: 'Splint a Suspected Long Bone Injury', source: 'platinum' },
    ],
  },
  {
    stationName: 'C-Collar',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Apply a Cervical Collar', source: 'platinum' },
    ],
  },
  {
    stationName: 'Cervical Collar',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Apply a Cervical Collar', source: 'platinum' },
    ],
  },

  // ── TRAUMA / BLEEDING ──
  {
    stationName: 'Bleeding Control',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Bleeding control and shock management', source: 'nremt' },
      { skillName: 'Apply a Tourniquet', source: 'platinum' },
    ],
  },
  {
    stationName: 'Hemorrhage Control',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Bleeding control and shock management', source: 'nremt' },
      { skillName: 'Apply a Tourniquet', source: 'platinum' },
    ],
  },
  {
    stationName: 'Tourniquet',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Bleeding control and shock management', source: 'nremt' },
      { skillName: 'Apply a Tourniquet', source: 'platinum' },
    ],
  },
  {
    stationName: 'Wound Packing',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Bleeding control and shock management', source: 'nremt' },
    ],
  },
  {
    stationName: 'Needle Decompression',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform needle decompression of the chest', source: 'platinum' },
    ],
  },
  {
    stationName: 'Chest Decompression',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform needle decompression of the chest', source: 'platinum' },
    ],
  },

  // ── CARDIAC ──
  {
    stationName: 'CPR',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Cardiac arrest management with AED', source: 'nremt' },
      { skillName: 'Perform CPR - Adult', source: 'platinum' },
    ],
  },
  {
    stationName: 'Cardiac Arrest',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Cardiac arrest management with AED', source: 'nremt' },
      { skillName: 'Perform CPR - Adult', source: 'platinum' },
    ],
  },
  {
    stationName: 'AED',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Cardiac arrest management with AED', source: 'nremt' },
      { skillName: 'Perform defibrillation', source: 'platinum' },
    ],
  },
  {
    stationName: 'Defibrillation',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform defibrillation', source: 'platinum' },
    ],
  },
  {
    stationName: 'Cardioversion',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform synchronized cardioversion', source: 'platinum' },
    ],
  },
  {
    stationName: 'Pacing',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform transcutaneous pacing', source: 'platinum' },
    ],
  },
  {
    stationName: 'TCP',
    programs: ['paramedic'],
    targets: [
      { skillName: 'Perform transcutaneous pacing', source: 'platinum' },
    ],
  },

  // ── MEDICATION ──
  {
    stationName: 'IM Injection',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Administer IM injection', source: 'platinum' },
    ],
  },
  {
    stationName: 'IV Push',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Administer IV bolus medication', source: 'platinum' },
    ],
  },
  {
    stationName: 'IV Bolus',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Administer IV bolus medication', source: 'platinum' },
    ],
  },
  {
    stationName: 'Med Admin',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Administer IV bolus medication', source: 'platinum' },
      { skillName: 'Administer IM injection', source: 'platinum' },
    ],
  },
  {
    stationName: 'Medication Administration',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Administer IV bolus medication', source: 'platinum' },
      { skillName: 'Administer IM injection', source: 'platinum' },
    ],
  },
  {
    stationName: 'Nebulizer',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Assisting a Patient With a Metered-Dose Inhaler', source: 'publisher' },
    ],
  },

  // ── OB ──
  {
    stationName: 'OB Delivery',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform Uncomplicated Delivery', source: 'platinum' },
      { skillName: 'Delivering a Newborn', source: 'publisher' },
    ],
  },
  {
    stationName: 'Childbirth',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform Uncomplicated Delivery', source: 'platinum' },
      { skillName: 'Delivering a Newborn', source: 'publisher' },
    ],
  },

  // ── OXYGEN ──
  {
    stationName: 'O2 Administration',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Oxygen administration by non-rebreather mask', source: 'nremt' },
      { skillName: 'Administer Oxygen by Nasal Cannula', source: 'platinum' },
    ],
  },
  {
    stationName: 'Oxygen',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Oxygen administration by non-rebreather mask', source: 'nremt' },
      { skillName: 'Administer Oxygen by Nasal Cannula', source: 'platinum' },
    ],
  },

  // ── ASSESSMENT TOOLS ──
  {
    stationName: 'Blood Glucose',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Assessing Blood Glucose Level', source: 'publisher' },
    ],
  },
  {
    stationName: 'Glucometer',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Assessing Blood Glucose Level', source: 'publisher' },
    ],
  },
  {
    stationName: '12-Lead',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Performing 12-Lead ECG', source: 'publisher' },
    ],
  },
  {
    stationName: 'ECG',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Performing 12-Lead ECG', source: 'publisher' },
    ],
  },

  // ── FBAO ──
  {
    stationName: 'Choking',
    programs: ['aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform FBAO - Adult', source: 'platinum' },
      { skillName: 'Perform FBAO - Infant', source: 'platinum' },
    ],
  },
  {
    stationName: 'FBAO',
    programs: ['emt', 'aemt', 'paramedic'],
    targets: [
      { skillName: 'Perform FBAO - Adult', source: 'platinum' },
    ],
  },
];

// ---------------------------------------------------------------------------
// POST /api/admin/skill-sheets/seed-aliases
// ---------------------------------------------------------------------------
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin role
  const supabase = getSupabaseAdmin();
  const { data: currentUser } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', user.email)
    .single();

  if (!currentUser || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const alias of ALIASES) {
    for (const target of alias.targets) {
      // Look up the skill sheet by name + source
      const { data: sheet } = await supabase
        .from('skill_sheets')
        .select('id')
        .ilike('skill_name', target.skillName)
        .eq('source', target.source)
        .limit(1)
        .maybeSingle();

      if (!sheet) {
        // Try partial match
        const { data: partialSheet } = await supabase
          .from('skill_sheets')
          .select('id')
          .ilike('skill_name', `%${target.skillName}%`)
          .eq('source', target.source)
          .limit(1)
          .maybeSingle();

        if (!partialSheet) {
          errors.push(`Sheet not found: "${target.skillName}" [${target.source}]`);
          continue;
        }

        // Use partial match
        for (const program of alias.programs) {
          try {
            const { error: upsertError } = await supabase
              .from('skill_sheet_assignments')
              .upsert(
                {
                  skill_name: alias.stationName,
                  skill_sheet_id: partialSheet.id,
                  program,
                },
                { onConflict: 'skill_name,skill_sheet_id,program' }
              );

            if (upsertError) {
              // If unique constraint doesn't exist, try insert with conflict check
              if (upsertError.message?.includes('constraint')) {
                // Check if already exists
                const { data: existing } = await supabase
                  .from('skill_sheet_assignments')
                  .select('id')
                  .eq('skill_name', alias.stationName)
                  .eq('skill_sheet_id', partialSheet.id)
                  .eq('program', program)
                  .maybeSingle();

                if (existing) {
                  skipped++;
                } else {
                  const { error: insertError } = await supabase
                    .from('skill_sheet_assignments')
                    .insert({
                      skill_name: alias.stationName,
                      skill_sheet_id: partialSheet.id,
                      program,
                    });
                  if (insertError) throw insertError;
                  inserted++;
                }
              } else {
                throw upsertError;
              }
            } else {
              inserted++;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${alias.stationName} → ${target.skillName} [${program}]: ${msg}`);
          }
        }
        continue;
      }

      // Insert assignment for each program
      for (const program of alias.programs) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from('skill_sheet_assignments')
            .select('id')
            .eq('skill_name', alias.stationName)
            .eq('skill_sheet_id', sheet.id)
            .eq('program', program)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          const { error: insertError } = await supabase
            .from('skill_sheet_assignments')
            .insert({
              skill_name: alias.stationName,
              skill_sheet_id: sheet.id,
              program,
            });

          if (insertError) throw insertError;
          inserted++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${alias.stationName} → ${target.skillName} [${program}]: ${msg}`);
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    skipped,
    total_aliases: ALIASES.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
