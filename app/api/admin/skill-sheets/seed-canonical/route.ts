import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// Helper – resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// Canonical skills seed data (41 entries)
// ---------------------------------------------------------------------------
const canonicalSkills = [
  // ── AIRWAY ──
  {
    canonical_name: "OPA Insertion",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Same technique at AEMT and Paramedic. Pediatric variation is separate canonical skill.",
    paramedic_only: false
  },
  {
    canonical_name: "OPA Insertion — Pediatric",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Pediatric insertion uses tongue depressor method — not rotation technique.",
    paramedic_only: false
  },
  {
    canonical_name: "NPA Insertion",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Same technique at AEMT and Paramedic. Pediatric variation is separate.",
    paramedic_only: false
  },
  {
    canonical_name: "NPA Insertion — Pediatric",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Same technique as adult. Sizing from Broselow tape.",
    paramedic_only: false
  },
  {
    canonical_name: "Oral Suctioning",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Same technique at both levels. EMT performs this skill but no NREMT sheet exists.",
    paramedic_only: false
  },
  {
    canonical_name: "BVM Ventilation — Adult",
    skill_category: "airway",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "Core skill at all three levels. EMT: NREMT sheet e203. AEMT/Paramedic: same technique, adds ETCO2 confirmation and RSI context at Paramedic.",
    paramedic_only: false
  },
  {
    canonical_name: "BVM Ventilation — Pediatric",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Pediatric BVM uses EC-clamp one-person technique. Sizing from Broselow.",
    paramedic_only: false
  },
  {
    canonical_name: "BVM Ventilation — Neonate",
    skill_category: "airway",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. Rate 40-60/min, gentle tidal volume, avoid overventilation.",
    paramedic_only: true
  },
  {
    canonical_name: "Oxygen Administration",
    skill_category: "airway",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT sheet e204 covers NRB mask. AEMT/Paramedic: also covers nasal cannula, face mask, cylinder setup.",
    paramedic_only: false
  },
  {
    canonical_name: "Supraglottic Airway",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT ceiling: King LT, LMA, i-gel. Paramedic: same devices plus RSI context. No ETI at AEMT level.",
    paramedic_only: false
  },
  {
    canonical_name: "CPAP Application",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT has Publisher sheet. Paramedic: same technique, may include BiPAP.",
    paramedic_only: false
  },
  {
    canonical_name: "Endotracheal Suctioning",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT: suctioning via SGA or stoma. Paramedic: adds in-line ETT suctioning post-intubation.",
    paramedic_only: false
  },
  {
    canonical_name: "Oral Endotracheal Intubation",
    skill_category: "airway",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. CoAEMSP minimum 10 attempts. SNHD: 2 attempt limit before alternative airway.",
    paramedic_only: true
  },
  {
    canonical_name: "Cricothyrotomy",
    skill_category: "airway",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. Surgical and needle cric. High-stakes skill — failure to perform when indicated is automatic fail.",
    paramedic_only: true
  },
  {
    canonical_name: "FBAO — Adult",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT: Heimlich and chest thrusts. Paramedic: adds Magill forceps for ALS FBAO removal.",
    paramedic_only: false
  },
  {
    canonical_name: "FBAO — Infant",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "5 back blows, 5 chest thrusts technique. Same at AEMT and Paramedic.",
    paramedic_only: false
  },
  {
    canonical_name: "FBAO — Magill Forceps",
    skill_category: "airway",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. Direct laryngoscopy with Magill forceps to remove visible obstruction.",
    paramedic_only: true
  },
  {
    canonical_name: "Stoma / Tracheostomy Care",
    skill_category: "airway",
    programs: ["aemt", "paramedic"],
    scope_notes: "Suctioning, cleaning, and ventilating through stoma. AEMT Publisher has detailed sheets. Paramedic via endotracheal suctioning sheet.",
    paramedic_only: false
  },

  // ── VASCULAR ACCESS ──
  {
    canonical_name: "IV Access",
    skill_category: "vascular_access",
    programs: ["aemt", "paramedic"],
    scope_notes: "CoAEMSP minimum 20 successful attempts for both AEMT and Paramedic. Simulation permitted. Live stick required.",
    paramedic_only: false
  },
  {
    canonical_name: "IO Access",
    skill_category: "vascular_access",
    programs: ["aemt", "paramedic"],
    scope_notes: "EZ-IO or similar. CoAEMSP minimum 2. Simulation permitted. Tibial and humeral sites. Pediatric IO is separate.",
    paramedic_only: false
  },
  {
    canonical_name: "IO Access — Pediatric",
    skill_category: "vascular_access",
    programs: ["aemt", "paramedic"],
    scope_notes: "Proximal tibia — two fingerbreadths below knee, medial side. Avoid epiphyseal plate. Broselow for sizing.",
    paramedic_only: false
  },

  // ── MEDICATION ADMINISTRATION ──
  {
    canonical_name: "IM Injection",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "Same technique at both levels. CoAEMSP minimum 2. Simulation permitted.",
    paramedic_only: false
  },
  {
    canonical_name: "IV Bolus Medication",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "CoAEMSP minimum 10. Simulation permitted. Pinch IV line proximal to port before injection.",
    paramedic_only: false
  },
  {
    canonical_name: "IV Infusion Setup",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "Spiking bag, priming tubing, drip rate calculation. Foundation for IV access.",
    paramedic_only: false
  },
  {
    canonical_name: "Intranasal Medication",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "MAD device. CoAEMSP minimum 2. Common agents: naloxone IN, midazolam IN.",
    paramedic_only: false
  },
  {
    canonical_name: "IO Medication Administration",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "Same agents as IV. Flush with minimum 20 mL NS after each dose. Responsive patients get lidocaine for pain.",
    paramedic_only: false
  },
  {
    canonical_name: "Sublingual Medication",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "Primarily nitroglycerin. Confirm BP before each dose.",
    paramedic_only: false
  },
  {
    canonical_name: "Inhaled Medication (MDI / Nebulizer)",
    skill_category: "medication",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT: Publisher sheets for both MDI and small-volume nebulizer. Paramedic: same technique.",
    paramedic_only: false
  },

  // ── ASSESSMENT ──
  {
    canonical_name: "Patient Assessment — Trauma",
    skill_category: "assessment",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e201. AEMT/Paramedic: same systematic approach expanded with ALS interventions.",
    paramedic_only: false
  },
  {
    canonical_name: "Patient Assessment — Medical",
    skill_category: "assessment",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e202. AEMT/Paramedic: same approach expanded with ALS diagnosis and treatment.",
    paramedic_only: false
  },
  {
    canonical_name: "Vital Signs",
    skill_category: "assessment",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "BP by auscultation and palpation. Pulse. Respirations. SpO2. Paramedic adds 12-lead and ETCO2 as vital parameters.",
    paramedic_only: false
  },
  {
    canonical_name: "Blood Glucose Monitoring",
    skill_category: "assessment",
    programs: ["aemt", "paramedic"],
    scope_notes: "Glucometer, test strip, lancet. Same technique at both levels.",
    paramedic_only: false
  },
  {
    canonical_name: "12-Lead ECG Acquisition",
    skill_category: "assessment",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT: monitoring only — does not interpret for intervention decisions. Paramedic: acquire, interpret, and act.",
    paramedic_only: false
  },

  // ── CARDIAC ──
  {
    canonical_name: "CPR — Adult",
    skill_category: "cardiac",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e215 (combined with AED). AEMT/Paramedic: same compression technique, adds ALS interventions during resuscitation.",
    paramedic_only: false
  },
  {
    canonical_name: "CPR — Pediatric",
    skill_category: "cardiac",
    programs: ["aemt", "paramedic"],
    scope_notes: "Rate 100-120/min. Depth ~2 inches child. 15:2 two-rescuer ratio.",
    paramedic_only: false
  },
  {
    canonical_name: "CPR — Neonate",
    skill_category: "cardiac",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. Rate 100-120/min. Depth 1.5 inches. 3:1 compression-ventilation ratio. Two-thumb encircling technique.",
    paramedic_only: true
  },
  {
    canonical_name: "AED / Defibrillation",
    skill_category: "cardiac",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT/AEMT: AED automated analysis. Paramedic: manual defibrillation — selects joules, charges, clears, and delivers independently.",
    paramedic_only: false
  },
  {
    canonical_name: "Synchronized Cardioversion",
    skill_category: "cardiac",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. Identify unstable tachydysrhythmia, sedate if possible, sync mode, confirm sync marker, clear and deliver.",
    paramedic_only: true
  },
  {
    canonical_name: "Transcutaneous Pacing",
    skill_category: "cardiac",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. Apply pads, set rate and output, confirm electrical and mechanical capture.",
    paramedic_only: true
  },

  // ── TRAUMA ──
  {
    canonical_name: "Hemorrhage Control / Tourniquet",
    skill_category: "trauma",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e213. All levels: direct pressure, wound packing, commercial tourniquet. Document time of application.",
    paramedic_only: false
  },
  {
    canonical_name: "Occlusive Dressing / Soft Tissue",
    skill_category: "trauma",
    programs: ["aemt", "paramedic"],
    scope_notes: "Covers: occlusive dressing for thoracic wounds, neck wounds, soft tissue dressing and bandaging.",
    paramedic_only: false
  },
  {
    canonical_name: "Needle Decompression",
    skill_category: "trauma",
    programs: ["paramedic"],
    scope_notes: "Paramedic only. 2nd ICS MCL or 4th-5th ICS AAL. 14g needle. Confirm decompression by rush of air.",
    paramedic_only: true
  },
  {
    canonical_name: "Impaled Object Stabilization",
    skill_category: "trauma",
    programs: ["aemt", "paramedic"],
    scope_notes: "Do not remove. Stabilize in place. Same technique at both levels.",
    paramedic_only: false
  },

  // ── IMMOBILIZATION ──
  {
    canonical_name: "Spinal Immobilization — Supine",
    skill_category: "immobilization",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e212. All levels: manual in-line, cervical collar, backboard, straps, head blocks. Torso before head.",
    paramedic_only: false
  },
  {
    canonical_name: "Spinal Immobilization — Seated",
    skill_category: "immobilization",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e211. KED or vest device. Torso straps before head strap.",
    paramedic_only: false
  },
  {
    canonical_name: "Cervical Collar Application",
    skill_category: "immobilization",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "No EMT NREMT sheet, but performed at EMT level as part of spinal immobilization. Standalone sheet at AEMT and Paramedic.",
    paramedic_only: false
  },
  {
    canonical_name: "Long Bone Immobilization",
    skill_category: "immobilization",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e217. All levels: rigid splint, traction splint for femur. Assess PMS before and after.",
    paramedic_only: false
  },
  {
    canonical_name: "Joint Immobilization",
    skill_category: "immobilization",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "EMT: NREMT e216. All levels: immobilize as found, padded splint. Assess PMS before and after.",
    paramedic_only: false
  },
  {
    canonical_name: "Helmet Removal",
    skill_category: "immobilization",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "Same technique at all levels. Two-person technique — one maintains inline stabilization while the other removes helmet.",
    paramedic_only: false
  },

  // ── OBSTETRICS ──
  {
    canonical_name: "OB Delivery — Normal",
    skill_category: "obstetrics",
    programs: ["aemt", "paramedic"],
    scope_notes: "AEMT Publisher sheet and Paramedic Platinum sheet. Same technique. Simulation required. Check for nuchal cord. Dry, warm, assess neonate.",
    paramedic_only: false
  },

  // ── MOVEMENT / LIFTING ──
  {
    canonical_name: "Patient Lifting and Movement",
    skill_category: "movement",
    programs: ["emt", "aemt", "paramedic"],
    scope_notes: "Body mechanics, coordinated lifts, equipment use (scoop, stair chair). EMT level includes most of this content. AEMT Publisher has 17 technique sheets.",
    paramedic_only: false
  }
];

// ---------------------------------------------------------------------------
// POST /api/admin/skill-sheets/seed-canonical
//
// Seeds the 41 canonical skills. Idempotent via upsert on canonical_name.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = await getCurrentUser(user.email);
  if (!currentUser || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const skill of canonicalSkills) {
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('canonical_skills')
        .select('id')
        .eq('canonical_name', skill.canonical_name)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('canonical_skills')
          .update({
            skill_category: skill.skill_category,
            programs: skill.programs,
            scope_notes: skill.scope_notes,
            paramedic_only: skill.paramedic_only,
          })
          .eq('id', existing.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase
          .from('canonical_skills')
          .insert({
            canonical_name: skill.canonical_name,
            skill_category: skill.skill_category,
            programs: skill.programs,
            scope_notes: skill.scope_notes,
            paramedic_only: skill.paramedic_only,
          });
        if (error) throw error;
        inserted++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${skill.canonical_name}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    total: canonicalSkills.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
