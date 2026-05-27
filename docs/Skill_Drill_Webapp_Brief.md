# Skill Drill — Webapp Feature Brief

## What This Is

Skill drills are a distinct station type that runs in S2 and S3 labs.
They are not scenarios (no full patient presentation) and not standard
skill sign-offs (no Platinum documentation required). They are structured,
high-repetition psychomotor practice stations — students work through a
specific skill or decision sequence repeatedly in a short window.

Current S2 template uses `station_type: 'skill_drill'` but the webapp
has no native UI or data model for it. Right now the format notes field
carries all the detail, which means it only displays as a text blob.

The goal: skill drills get their own structured display in the webapp,
importable via JSON, with a clean reference view instructors can pull up
or print at the station.

---

## How Skill Drills Differ from Scenarios and Skills

| | Scenario | Skill Sign-off | Skill Drill |
|---|---|---|---|
| Patient presentation | Full | None | None or minimal |
| Platinum documentation | Yes | Yes | No |
| Evaluation | Pass/fail | Pass/fail | Practice only |
| Duration | 15–30 min | 5–10 min | 15–25 min rotating |
| Repetitions | 1 per student | 1–2 per student | Many per student |
| Purpose | Clinical reasoning | Competency verification | Psychomotor habit building |

---

## Proposed Data Model

```sql
CREATE TABLE skill_drills (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  program           TEXT NOT NULL CHECK (program IN ('emt','aemt','paramedic','all')),
  semester          INTEGER,
  concept           TEXT NOT NULL,        -- TLDR paragraph
  duration_minutes  INTEGER,              -- per rotation
  students_per_setup INTEGER,             -- e.g. 2–3
  instructor_notes  TEXT,                 -- focus points, common errors
  equipment         JSONB,               -- array of strings
  setups            JSONB,               -- array of setup objects (see below)
  run_steps         JSONB,               -- ordered array of how-to-run steps
  source            TEXT,                -- 'internal' | 'imported'
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

**`setups` JSONB structure** — supports multiple monitor/equipment
configurations at one station:

```json
"setups": [
  {
    "label": "Standard Setup",
    "count": 2,
    "items": [
      "Standard square rhythm generator",
      "Lifepack monitor",
      "Limb leads pre-connected"
    ],
    "notes": null
  },
  {
    "label": "PALS Manikin Setup",
    "count": 1,
    "items": [
      "PALS infant manikin rhythm generator",
      "Infant manikin with limb leads",
      "Charge dumper — required",
      "Lifepack monitor connected via pads"
    ],
    "notes": "Charge dumper required — without it monitor shows erratic readings on energy delivery. Pre-connect all leads before lab."
  }
]
```

**`run_steps` JSONB structure:**

```json
"run_steps": [
  "Display rhythm. Student identifies — do not announce it.",
  "Student verbalizes treatment decision before touching monitor.",
  "Student physically executes: energy selection, charge, sync mode, pacing rate and output.",
  "Instructor corrects immediately and moves to next rhythm.",
  "Each student completes minimum 2–3 rhythms before group rotates."
]
```

---

## JSON Import Format

```json
{
  "title": "Lifepack Monitor Manipulation Drill",
  "program": "paramedic",
  "semester": 2,
  "concept": "Students physically manipulate the Lifepack monitor in response to displayed rhythms — executing correct algorithm actions hands-on. Psychomotor drill building on rhythm recognition, adding the physical layer of operating the monitor itself. No full scenario — focused monitor skills only. Instructors reference ACLS pocket guides or AHA books.",
  "duration_minutes": 25,
  "students_per_setup": 3,
  "equipment": [
    "3 Lifepack monitors",
    "2 standard square rhythm generators",
    "1 PALS infant manikin + generator",
    "Charge dumper (for PALS setup)",
    "ACLS pocket guides or AHA manual — one per setup"
  ],
  "setups": [
    {
      "label": "Standard Setup",
      "count": 2,
      "items": [
        "Standard square rhythm generator",
        "Lifepack monitor",
        "Limb leads pre-connected before lab"
      ],
      "notes": null
    },
    {
      "label": "PALS Manikin Setup",
      "count": 1,
      "items": [
        "PALS infant manikin rhythm generator",
        "Infant manikin — limb leads pre-connected",
        "Charge dumper — required",
        "Lifepack monitor connected via pads"
      ],
      "notes": "Charge dumper required. Without it monitor shows erratic readings on energy delivery. Position manikin to side or partially out of view."
    }
  ],
  "run_steps": [
    "Display rhythm on monitor. Do not announce it — student identifies first.",
    "Student verbalizes rhythm identification and treatment decision.",
    "Student physically executes on monitor: energy selection, charge, sync mode, pacing rate and output.",
    "Instructor corrects immediately and advances to next rhythm. Keep pace up.",
    "Each student works through minimum 2–3 rhythms. Rotate group at 25 minutes."
  ],
  "instructor_notes": "Most common errors: sync mode left on for VF (monitor will not fire), declaring pacing capture from EKG alone without checking pulse, attempting to shock asystole. Correct immediately and move on — do not break station pace for extended debrief."
}
```

---

## Import Endpoint

`POST /api/admin/skill-drills/import`

Accepts single drill object or array.
Upsert on `title + program + semester`.
Add import UI at `/admin/skill-drills/import` with file upload and
manual seed buttons.

---

## Display UI — Two Views

### Station Card View (from lab day page)
When a lab day station has `station_type: 'skill_drill'`, show a
skill drill card instead of a generic text blob:

- Title
- Concept (1 paragraph)
- Duration + students per setup
- Collapsible: How It Runs (steps)
- Collapsible: Equipment
- Collapsible: Setup Notes (with any warning callouts for flagged items)
- "View Full Reference" button → opens reference view

### Reference View (print-ready)
Full single or two-page reference matching the Word doc format:
- Concept block at top
- How the Station Runs (prominent, main section)
- Equipment (compact)
- Setup notes (bottom, with callouts for flagged items)
- Print button generates clean printable layout

---

## Skill Drill Maker Chat

A separate chat will handle building actual drill content — the JSON
objects for each drill. That chat takes a drill concept and outputs
import-ready JSON matching the schema above. The planning chat tracks
which drills exist and which need building.

Drills to build (initial list):
- Lifepack Monitor Manipulation Drill ← already built, ready to import
- ACLS Megacode — Walk-Through Format (S2 Weeks 3–5)
- ACLS Megacode — Pressured Format (S2 Weeks 6–10)
- Timed ETI Drill (S2 late / S3)
- Difficult Airway → Surgical Decision Drill (S3)
- Pediatric Med Draw — Broselow Under Time Pressure (S2 Week 9)

---

## Connection to Existing Schema

`lab_template_stations` already has `station_type: 'skill_drill'`.
Add a `skill_drill_id` FK column so the station links to the
`skill_drills` table when a drill is assigned:

```sql
ALTER TABLE lab_template_stations
  ADD COLUMN IF NOT EXISTS skill_drill_id UUID REFERENCES skill_drills(id);
```

Same pattern as skill sheets linking via `skill_sheet_assignments`.

---

## Questions for Webapp Chat Before Building

1. Is `station_type: 'skill_drill'` already in the CHECK constraint,
   or does that need to be added with the other new types
   (`skill_review`, `field_trip`, `no_lab`) from the template update?

2. Does the lab day station detail page currently render anything
   special for unknown station types, or does it fall through to
   a generic text display?

3. Is there a preferred pattern in the codebase for collapsible
   sections on station cards, or should that be new UI?
