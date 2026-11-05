# LVFR AEMT 2026 - debrief notes export

Last updated: 2026-11-05 (export from live database; read-only, nothing deleted or changed)

Source: card "[LVFR - ISOLATE AND ARCHIVE]", item 4. Every free-text notes field across the `lvfr_*`
tables, copied verbatim and grouped by date. Wording, typos and spacing are as stored.

**How to read this.** Only the "Instructor notes (written on the daily runsheet)" lines under each day
and the three feedback reports in section 4 are Ben/instructor free text typed by a person. The
"Brief" and "Debrief" lines are the runsheet text the site generated from the course plan (they are
included because they live in the same fields). Assignment, availability and plan-placement notes were
entered by Ben/Claude when the schedule was loaded; the plan-placement dates come from an earlier
version of the plan and do not match the final schedule (see section 3).

Counts of non-empty note fields found:

| Table.column | Rows with a note | Included below |
|---|---|---|
| lvfr_day_schedule.notes | 7 | yes (section 1) |
| lvfr_day_schedule.brief / .debrief | 45 days with either | yes (section 1) |
| lvfr_aemt_instructor_assignments.notes | 21 | yes (section 2) |
| lvfr_aemt_assessments.note | 1 | yes (section 2) |
| lvfr_aemt_chapters.note | 2 | yes (section 2) |
| lvfr_aemt_plan_placements.custom_notes | 55 | yes (section 3) |
| lvfr_aemt_instructor_availability.notes | 70 | yes, grouped (section 5) |
| lvfr_aemt_content_blocks.notes | 131 | yes, grouped (section 6) |
| lvfr_aemt_course_days.completion_notes, plan_instances.notes, skill_attempts.notes, skill_class_completion.notes, lvfr_platoon_schedule.notes, lvfr_schedule_items.notes | 0 | nothing to export |

No student skill notes exist (skill attempts and class completion notes are empty).

---

## 1. Daily runsheets (lvfr_day_schedule), by date

### 2026-07-14
- Instructor notes (morning): "Got through chapters 1, and 2 prior, did platinum sign up, and allowed students to work on the  aemt entry assessment somewhat,"
- Instructor notes (afternoon): "No group testing, Ryan finished chapter 3 in the afternoon"
- Brief (morning): EMSTesting.com Login and Orientation, Chapter 1: EMS Systems, Chapter 2: Workforce Safety and Wellness, Chapter 3: Medical, Legal, and Ethical Issues → PM: Group Testing - Chapters 1-3
- Debrief (afternoon): Preview Day 2: Ch 4-6 Reading assignment: Chapters 4, 5, 6

### 2026-07-15
- Instructor notes (morning): "Initial review day took alot longer, intinitial, but breaking down platinum and the testing process more. started around 935, with getting through communication- Another good chapter pushing past lunch time. "
- Brief (morning): Quizzes: Ch 1 + Ch 2 + Ch 3, Chapter 4: Communications and Documentation, Chapter 5: Medical Terminology, Chapter 6: Lifting and Moving Patients → PM: Group Testing - Chapters 4-6
- Debrief (afternoon): Preview tomorrow: lab day, closed-toe shoes required Optional: PCR Narrative Activity if time allows

### 2026-07-16
- Brief (morning): Quizzes: Ch 4 + Ch 5, Chapter 6 lecture, Chapter 6 group testEMT Competency Checkoffs, Lab Prep and Safety Brief → PM: Lifting and Moving Lab, study for module exam on tuesday- group testing chapters 1-6
- Debrief (afternoon): What went well, what needs more practice Reading assignment: Ch 7 (Human Body) - longest chapter in course

### 2026-07-21
- Brief (morning): Ch 1-6 Sub-Module Exam, Chapter 7: Human Body - Part 1 → PM: Chapter 7: Parts 3-4
- Debrief (afternoon): Reading: Ch 8-9

### 2026-07-22
- Instructor notes (morning): "Life span development started in the afternoon."
- Brief (morning): Quiz: Ch 7, Chapter 8: Pathophysiology, Chapter 9: Life Span Development → PM: Group Testing Ch 8-9
- Debrief (afternoon): Reading: Ch 10 (Patient Assessment) - most important clinical chapter

### 2026-07-23
- Brief (morning): Quizzes: Ch 8 + Ch 9, Chapter 10: Patient Assessment, Assessment Demonstration → PM: Assessment Practice, Vital Signs Practice
- Debrief (afternoon): Monday supplementary: review + exam prep. Ch 10 Assessment Exam is Tuesday.

### 2026-07-28
- Instructor notes (morning): "Went over chapter 13 skill powerpoint instead, main chapter will be taught thursday. "
- Brief (morning): Ch 10 Assessment Exam, Chapter 12: Principles of Pharmacology, Chapter 13: Vascular Access → PM: Chapter 13: Finish, Med Admin Demonstration: IM, SQ, IN Routes, Med Admin Practice
- Debrief (afternoon): Preview Day 8: IV manikin arms AM, live sticks PM

### 2026-07-29
- Brief (morning): Quizzes: Ch 12 + Ch 13, IV Manikin Arm Practice, IV Troubleshooting + Continued Arm Practice → PM: LIVE STICK IV Practice

### 2026-07-30
- Brief (morning): Ch 7-9, 12-13 Sub-Module Exam, IV Math and Drip Rate Calculations, EMT Competency Checkoffs → PM: Practice / Checkoffs Continued

### 2026-08-04
- Instructor notes (morning): "Chapteer 17 moved to the next wednesday"
- Brief (morning): Chapter 11: Airway Part 1, Chapter 11: Airway Part 2, Chapter 11: Airway Part 3, Chapter 17: Respiratory Part 1 → PM: Chapter 17: Respiratory Part 2, Chapter 17: Respiratory Part 3
- Debrief (afternoon): Preview tomorrow: airway lab PM. Reading: review Ch 11 supraglottic insertion steps.

### 2026-08-05
- Instructor notes (morning): "Chapter 17 today, ch 17 quiz thursday"
- Brief (morning): Quizzes: Ch 11 + Ch 17, Chapter 14: Shock, Airway Lab Setup and Safety Brief → PM: Airway Management Lab

### 2026-08-06
- Brief (morning): Quiz: Ch 14, Chapter 15: BLS Resuscitation, Chapter 18: Cardiovascular Emergencies → PM: BLS Lab: CPR + AED + Team Resuscitation
- Debrief (afternoon): Resuscitation Module Exam next Tuesday after weekend + Monday review

### 2026-08-11
- Brief (morning): Resuscitation Module Exam, Chapter 26: Trauma Overview, Chapter 27: Bleeding → PM: Chapter 27: Finish, Chapter 28: Soft-Tissue Injuries

### 2026-08-12
- Brief (morning): Quizzes: Ch 26 + Ch 27 + Ch 28, Chapter 29: Face and Neck Injuries, Chapter 30: Head and Spine Injuries → PM: Stop the Bleed / Hemorrhage Control Lab

### 2026-08-13
- Brief (morning): Quizzes: Ch 29 + Ch 30, Chapter 31: Chest Injuries, Chapter 32: Abdominal and GU Injuries → PM: C-Spine Immobilization Lab
- Debrief (afternoon): Monday supplementary: trauma quizzes + review

### 2026-08-18
- Brief (morning): Quizzes: Ch 31 + Ch 32, Chapter 33: Orthopedic Injuries, Chapter 34: Environmental Emergencies → PM: Chapter 34: Finish, Splinting Lab
- Debrief (afternoon): Monday: trauma quizzes + Trauma Module exam prep

### 2026-08-19
- Brief (morning): Quizzes: Ch 33 + Ch 34, Trauma Module Exam → PM: Chapter 16: Medical Overview, Chapter 19: Neurologic Emergencies

### 2026-08-20
- Brief (morning): Quizzes: Ch 16 + Ch 19, Chapter 20: GI and Urologic Emergencies, Chapter 21: Endocrine and Hematologic, Chapter 22: Immunologic Emergencies → PM: Group Testing Ch 20-22

### 2026-08-25
- Brief (morning): Quizzes: Ch 20 + Ch 21 + Ch 22, Chapter 23: Toxicology, Chapter 24: Psychiatric Emergencies → PM: Chapter 25: Gynecologic Emergencies
- Debrief (afternoon): All medical content complete. Medical Module Exam Day 22 (Tuesday).

### 2026-08-26
- Brief (morning): Quizzes: Ch 23 + Ch 24 + Ch 25 → PM: Integrated Medical Scenarios
- Debrief (afternoon): Medical Module Exam Tuesday. Study all medical chapters.

### 2026-08-27
- Brief (morning): Chapter 35: OB and Neonatal Care - Parts 1-2 → PM: OB Delivery / NRP Lab

### 2026-09-01
- Brief (morning): Medical Module Exam, Chapter 35: OB Part 1 → PM: Chapter 35: Part 2, Group Testing Ch 35 / OB Discussion
- Debrief (afternoon): Preview tomorrow: OB Lab + birth scenarios

### 2026-09-02
- Brief (morning): Quiz: Ch 35 → PM: OB Delivery Lab
- Debrief (afternoon): Preview: Pediatrics Day 1

### 2026-09-03
- Brief (morning): Chapter 36: Peds Part 1, Chapter 36: Peds Part 2 → PM: Peds Scenarios Continued
- Debrief (afternoon): ~170 of 320 min peds done. Day 25 finishes peds.

### 2026-09-08
- Brief (morning): Chapter 36: Peds Part 3, Chapter 36: Peds Part 4 → PM: Group Testing - Peds Comprehensive
- Debrief (afternoon): All peds done (320 min across 2 days).

### 2026-09-09
- Brief (morning): Quiz: Ch 36, Chapter 37: Geriatric Emergencies, Chapter 38: Special Challenges, Group Testing Ch 37-38 → PM: Skill Checkoffs

### 2026-09-10
- Brief (morning): Quiz: Ch 37 + Ch 38 → PM: Final Skill Checkoffs
- Debrief (afternoon): Special Pop Exam next Tuesday.

### 2026-09-15
- Brief (morning): Special Populations Module Exam, Chapter 39: Transport Operations, Chapter 40: Extrication, Rescue, Hazmat, Chapter 41: Incident Management → PM: Chapter 41: Finish, Chapter 42: Terrorism and Disaster, MCI Tabletop Exercise, Group Testing Ch 39-42
- Debrief (afternoon): All 42 chapters complete. EMS Ops Exam tomorrow.

### 2026-09-16
- Brief (morning): EMS Ops Module Exam → PM: Final Scenario Practice
- Debrief (afternoon): Final Exam tomorrow. Rest and trust your training.

### 2026-09-17
- Brief (morning): Comprehensive Final Exam → PM: NREMT Preparation Briefing, Course Evaluations + Admin Closeout
- Debrief (afternoon): Final words, congratulations, dismiss

---

## 2. Instructor assignment, assessment and chapter notes

Instructor assignment notes (lvfr_aemt_instructor_assignments.notes), by date (course day in brackets):

- 2026-07-14 [day 1]: LAUNCH DAY. Morning 0700-1200: Ben (can cover to ~1030 due to Pima class start). Afternoon 1300-1530: Ryan.
- 2026-07-15 [day 2]: Jimi PM-only, off shift ~noon.
- 2026-07-16 [day 3]: Ben covers 0700-0900 early AM (Jimi coming off shift); Jimi full day. Trevor NOT at LVFR this day (per 7/15 authoritative coverage grid).
- 2026-07-21 [day 4]: Jimi PM-only off shift ~noon. Ben morning per Pima Tue exceptions; possible AM gap before Jimi arrives.
- 2026-07-23 [day 6]: Ben available through ~1415 (Thu Pima lab PM).
- 2026-07-28 [day 7]: Ben morning/midday per Pima Tue exceptions. LAB: Med Admin.
- 2026-07-29 [day 8]: LAB: IV Access LIVE STICKS (safety critical, sharps).
- 2026-07-30 [day 9]: Ben available through ~1415 (Thu).
- 2026-08-04 [day 10]: Ben Tue Pima exceptions.
- 2026-08-05 [day 11]: Ben OUT - PMI NREMT EMT psychomotor testing (all hands). Pima academy cadre covering lab - minimums met. LAB: Airway Management.
- 2026-08-06 [day 12]: Ben OUT - PMI NREMT EMT psychomotor testing (all hands). Pima academy cadre covering lab - minimums met. LAB: BLS/CPR/AED.
- 2026-08-11 [day 13]: Ben full availability starts.
- 2026-08-12 [day 14]: LAB: Stop the Bleed.
- 2026-08-13 [day 15]: Lecture only (Ch 31-33). No lab. RESTRUCTURED - C-Spine moved to 8/19.
- 2026-08-18 [day 16]: Ch31-33 quiz AM + TRAUMA MODULE EXAM PM (covers Ch 26-34). No lab. Major-quiz Tuesday. RESTRUCTURED - Splinting moved to 8/19.
- 2026-08-19 [day 17]: Ch 16/19 lecture AM. TWO labs PM: C-Spine + Splinting (consolidated). Pima academy cadre covering labs - minimums met; doubled lab load, consider 2-4 cadre split across the two labs. RESTRUCTURED - both labs moved here from 8/13 and 8/18.
- 2026-08-20 [day 18]: Jimi PM-only, off shift ~noon.
- 2026-08-26 [day 20]: Jimi PM-only, off shift ~noon.
- 2026-09-01 [day 22]: Jimi PM-only, off shift ~noon.
- 2026-09-02 [day 23]: LAB: OB/NRP.
- 2026-09-17 [day 30]: FINAL EXAM + Closeout.

Assessment note (lvfr_aemt_assessments.note):
- 2026-09-09 [day 29], "Module 7 Exam (EMS Operations — Group Format)": Group format — formative, not individually graded

Chapter notes (lvfr_aemt_chapters.note):
- Ch 7 The Human Body (teaching day 4): Longest chapter in the course — full day
- Ch 10 Patient Assessment (teaching day 6): Most important clinical chapter

---

## 3. Plan placement notes (lvfr_aemt_plan_placements.custom_notes)

These came from an earlier version of the course plan. Their dates and course-day numbers do NOT match
the final schedule above (for example "2026-07-09, day 3"). Treat them as plan-template remarks, not as a
record of what happened. Format: date [course day] block title :: note.

- 2026-07-09 [3] LUNCH :: Jimi arrives noon
- 2026-07-09 [3] Lifting & Moving Lab :: All instructors: Trevor, Jimi, Ben
- 2026-07-09 [3] Lab debrief / Day closeout :: All instructors: Trevor, Jimi
- 2026-07-14 [4] Remaining Ch 7 + reinforcement :: TBD PM coverage
- 2026-07-14 [4] Ch 7: Human Body Parts 2-4 continuing :: TBD PM coverage
- 2026-07-15 [5] Group Testing Ch 8-9 :: Jimi or Trevor
- 2026-07-15 [5] LUNCH :: Jimi arrives noon
- 2026-07-16 [6] Assessment practice :: All instructors: Jimi, Trevor
- 2026-07-16 [6] Ch 10: Patient Assessment — Lecture :: All instructors: Jimi, Trevor
- 2026-07-16 [6] Vital signs practice :: All instructors: Jimi, Trevor
- 2026-07-22 [8] IV Manikin Arm Practice :: All instructors: Jimi, Ben
- 2026-07-22 [8] LIVE STICK IV Practice :: Pima Cadre assisting; All instructors: Jimi, Ben
- 2026-07-22 [8] LUNCH :: Pima Cadre arrives
- 2026-07-22 [8] IV troubleshooting + continued arm practice :: All instructors: Jimi, Ben
- 2026-07-23 [9] Practice / Checkoffs continued :: All instructors: Jimi, Trevor
- 2026-07-23 [9] Roll Call / Exam prep :: All instructors: Jimi, Trevor
- 2026-07-23 [9] Ch 7-9, 12, 13 Sub-Module Exam ~65q :: All instructors: Jimi, Trevor
- 2026-07-23 [9] Exam Review :: All instructors: Jimi, Trevor
- 2026-07-23 [9] EMT Competency Checkoffs :: All instructors: Jimi, Trevor
- 2026-07-29 [11] LUNCH :: Ben arrives
- 2026-07-29 [11] Airway Lab :: All instructors: Jimi, Trevor, Ben
- 2026-07-30 [12] BLS Lab: CPR + AED + team resuscitation :: All instructors: Jimi, Trevor, Ben
- 2026-07-30 [12] LUNCH :: Ben arrives
- 2026-08-05 [14] Stop the Bleed Lab :: All instructors: Jimi, Ben
- 2026-08-05 [14] LUNCH :: Ben arrives
- 2026-08-06 [15] C-Spine Lab :: All instructors: Trevor, Ben
- 2026-08-06 [15] LUNCH :: Ben arrives
- 2026-08-12 [17] Splinting Lab :: All instructors: Trevor, Ben
- 2026-08-12 [17] LUNCH :: Ben arrives
- 2026-08-13 [18] Trauma module review — group testing :: All instructors: Trevor, Ben
- 2026-08-13 [18] Integrated trauma scenarios :: All instructors: Trevor, Ben
- 2026-08-13 [18] Final skill checkoffs :: All instructors: Trevor, Ben
- 2026-08-13 [18] Additional trauma lab reps :: All instructors: Trevor, Ben
- 2026-08-20 [21] LUNCH :: Jimi arrives noon
- 2026-08-20 [21] Roll Call / Announcements :: All instructors: Trevor, Ben
- 2026-08-26 [23] LUNCH :: Jimi arrives noon
- 2026-08-26 [23] Ch 36: Peds Part 1 :: All instructors: Trevor, Ben
- 2026-08-27 [24] OB Delivery / NRP Lab :: All instructors: Jimi, Trevor, Ben
- 2026-08-27 [24] Roll Call / Announcements :: All instructors: Jimi, Trevor, Ben
- 2026-09-01 [25] Ch 41: Incident Management — Lecture :: Ben or Jimi
- 2026-09-01 [25] MCI Tabletop Exercise — START triage :: All instructors: Ben, Jimi
- 2026-09-01 [25] LUNCH :: Jimi arrives noon
- 2026-09-02 [26] Skills practice / checkoffs :: All instructors: Jimi, Ben
- 2026-09-02 [26] Roll Call / Exam prep :: All instructors: Jimi, Ben
- 2026-09-02 [26] Comprehensive review — group testing :: All instructors: Jimi, Ben
- 2026-09-03 [27] Roll Call / Announcements :: All instructors: Jimi, Trevor, Ben
- 2026-09-03 [27] Skills stations: 3 instructors rotate :: All instructors: Jimi, Trevor, Ben
- 2026-09-03 [27] Skills checkoff marathon :: All instructors: Jimi, Trevor, Ben
- 2026-09-08 [28] Final exam prep :: All instructors: Jimi, Ben
- 2026-09-08 [28] Comprehensive review — practice exam :: All instructors: Jimi, Ben
- 2026-09-08 [28] Roll Call / Announcements :: All instructors: Jimi, Ben
- 2026-09-09 [29] Roll Call / Announcements :: All instructors: Jimi, Trevor, Ben
- 2026-09-09 [29] Practice scenarios — integrated :: All instructors: Jimi, Trevor, Ben
- 2026-09-10 [30] COMPREHENSIVE FINAL EXAM :: All instructors: Jimi, Trevor, Ben
- 2026-09-10 [30] Roll Call / Final exam prep :: All instructors: Jimi, Trevor, Ben

---

## 4. Open feedback reports that close with the archive (Ben's own words, verbatim)

1. 6290b0bf-561b-4387-bdeb-7c1206daae7d, 2026-07-08, /lvfr-aemt/skills: "It would be useful, if we could like the lab day function to autocheck these as well. So if we checked it off on the daily sheet or so on. That his tracker would also capture that input."
2. bdad590a-6b6f-46c3-8c49-a0ea5050e615, 2026-07-08, /lvfr-aemt/skills: "I beleieve in the descriptive text underneath the skill the d7, d8 ... is refrencing the days, if so that kinda works. But what also would be good would be to have the lab instructions built and lab substation, probably not in this folder, and instead the folder above this with lab comptencies and plans and so on. If we can't get this going we do have google drive back ups I believe."
3. 0718f6be-d492-4d4a-b828-8066a2a8322f, 2026-07-15, /lvfr-aemt/day/2026-07-16: "It may be beneficial to have previous days debrieff notes a section to automatically bring over previous notes. May not be worth the effort."

Status of all three at export time: in_progress. Not changed by this export (see card for the follow-up).

---

## 5. Instructor availability notes (lvfr_aemt_instructor_availability.notes), grouped

| Note | Rows | Date range | Instructor |
|---|---|---|---|
| Primary daily instructor — shift schedule pending | 30 | 2026-07-07 to 2026-09-10 | Jimi Vargas |
| Secondary instructor — schedule pending | 30 | 2026-07-07 to 2026-09-10 | Trevor Paul |
| Pima Airway+Peds 10:15-12:45, Pima Lab 14:15-17:00 | 5 | 2026-07-07 to 2026-08-04 | Benjamin Hartnell |
| Pima Lab 14:15-17:00 | 4 | 2026-07-09 to 2026-08-06 | Benjamin Hartnell |
| BEN OUT — PALS. Need full coverage. | 1 | 2026-07-16 | Benjamin Hartnell |

---

## 6. Course content-block notes (lvfr_aemt_content_blocks.notes), grouped

Block-library remarks (131 blocks). These describe the course content, not what happened on a given day.

- "20 questions. Quiz 30 min, Review 10 min." (26 chapter quizzes: Ch 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 20, 21, 22, 23, 27, 29, 30, 31, 35, 37, 39, 40, 41, 42)
- "15 questions. Quiz 23 min, Review 8 min." (8 quizzes: Ch 5, 19, 24, 28, 32, 33, 34, 38)
- "10 questions. Quiz 15 min, Review 5 min." (7 quizzes: Ch 1, 2, 3, 6, 16, 25, 26)
- "30 questions. Quiz 45 min, Review 15 min." (Ch 36 quiz)
- Lectures: Ch 1 "History, certification levels, system components"; Ch 2 "BSI/PPE, stress management"; Ch 3 "High discussion value — allow extra time"; Ch 4 "64 slides"; Ch 5 "Fast chapter — mostly EMT review"; Ch 6 "Lecture only — lab is separate block"; Ch 7 "FULL DAY. 4 blocks of ~60 min. Longest chapter in course."; Ch 8 "Connects to Ch 7 — teach day after A&P"; Ch 9 "Can pair with Ch 8 same day"; Ch 10 "Most important clinical chapter. 2 lecture blocks."; Ch 11 "3 blocks of 60 min. Teach before airway lab."; Ch 12 "SNHD formulary review included"; Ch 13 "Heavy on IV theory. Teach before IV lab."; Ch 14 "2 blocks. Connects to Ch 8 pathophysiology."; Ch 15 "Shorter lecture — most students have CPR cert. Lab is separate."; Ch 16 "Intro to medical module"; Ch 17 "2 blocks (~90 + 80 min). Builds directly on Ch 11 airway."; Ch 18 "ACS, CHF, hypertensive emergencies"; Ch 19 "Stroke, seizures, AMS"; Ch 20 "Abdominal assessment approach"; Ch 21 "Diabetes, hypoglycemia — very common call"; Ch 22 "Short but critical — anaphylaxis"; Ch 23 "Toxidromes, naloxone"; Ch 24 "De-escalation, scene safety"; Ch 25 "Sensitive topic — professional approach"; Ch 26 "MOI, energy transfer, biomechanics"; Ch 27 "Hemorrhage types, control methods"; Ch 28 "Burns, bandaging. Can pair with Ch 27."; Ch 29 "Eye, ear, nose, neck injuries"; Ch 30 "TBI, spinal cord injury — HIGH YIELD"; Ch 31 "Pneumothorax types, flail chest, tamponade"; Ch 32 "Can pair with Ch 31 same day"; Ch 33 "120 slides — heavy chapter. Splinting principles."; Ch 34 "128 slides — heat/cold/drowning/envenomation. Las Vegas relevant."; Ch 35 "120 slides. Delivery, complications, NRP. Full day with lab."; Ch 36 "2 blocks (~50 + 120 min). Long single-chapter lecture."; Ch 37 "Atypical presentations, polypharmacy"; Ch 38 "Shorter chapter. Trach care, bariatric, developmental."; Ch 39 "Condensed — academy grads know most of this"; Ch 40 "Condensed — focus EMS provider role"; Ch 41 "ICS, START triage — NREMT testable"; Ch 42 "CBRNE awareness, blast injury review"
- Exams: Module 1 (Preparatory) "Ch 1-10, 12-13. ~50 questions + 30 min review."; Module 2 (Airway) "Ch 11, 17. ~45 questions + 30 min review."; Module 3 (Shock/Cardio) "Ch 14, 15, 18. ~45 questions + 30 min review."; Module 4 (Medical) "Ch 16, 19-25. ~45 questions + 30 min review."; Module 5 (Trauma) "Ch 26-34. ~50 questions + 30 min review."; Module 6 (Special Pop) "Ch 35-38. ~40 questions + 30 min review."; Module 7 (EMS Ops — Group) "Ch 39-42. Group format. ~30 questions."; Comprehensive Final Exam "ALL chapters. ~100-150 questions. Plan full morning."; Pharmacology Checkpoint "Ch 12 must be taught. Difficulty level varies."
- Activities and labs: Airway Management Lab and Lifting & Moving Lab "Full day lab"; IV Access Lab Day 1 "High-fidelity skills lab"; IV Access Lab Day 2 "Live sticks if policy allows. Consecutive day strongly preferred."; IV Math & Drip Rate Calculations "Guided practice. Can be lecture-style with full class."; EMSTesting Group Testing "15-20 questions projected, class discusses. End-of-day reinforcement."; Module Review Group Testing "20-25 questions, full exam prep format."; Patient Assessment Practice "2 preferred instructors"; Vital Signs Practice "Students pair up. Manual BP, pulse, RR, SpO2, pupils. 2 preferred."; Assessment Scenario Practice "4 patient scenarios. Can be solo instructor with 30 students."; Legal/Ethics Case Discussion "4 scenarios. Full class discussion. Follows Ch 3 lecture."; Radio Report Practice "4 scenarios. Full class. Follows Ch 4."; PCR Narrative Writing "Same scenarios as radio practice."; Cardiac Case Studies "5 cardiac scenarios. Full class."; Pharmacology Scenario Discussion "5 medication administration scenarios."; OB Scenario Discussion "5 OB complication scenarios."; Shock Case Studies "5 shock scenarios."; Life Span Case Studies "6 age-group scenarios. Follows Ch 9."; Respiratory Case Studies "6 respiratory scenarios."; Neuro/GI Case Studies "6 scenarios mixing neuro + GI."; Endocrine/Immunologic/Tox Cases "6 scenarios."; MOI Analysis Activity "8 trauma mechanism scenarios. Predict injuries."; Integrated Medical Scenarios "4 complex differential diagnosis scenarios."; Integrated Trauma Scenarios "4 multi-system trauma cases."; MCI Triage Tabletop "START triage exercise. Works with 30 students + 1 instructor."; 12-Lead Placement Practice "Electrode placement on each other or manikin."; Stroke Scale Practice "FAST/RACE scoring on projected scenarios."; Bandaging & Burn Practice "Pairs practice on each other. Low equipment."; Chest Seal Application Demo "Quick demo, students practice application."; Drug Card Activity "Students create/fill in drug cards for 8 AEMT meds."; Medical Terminology Worksheet "Printed worksheet. Follows Ch 5."; A&P Worksheet "Printed worksheet. Follows Ch 7 lecture blocks."; LVFR Pit Crew Standards Review "LVFR-specific resuscitation roles."; NREMT Preparation Briefing "Exam format, study plan, test-taking strategies."
- Structure blocks: Roll Call / Announcements "Start of every day"; Lunch "1200-1300 every day"; Break "Typically every 60-90 min of instruction"; Day Closeout / Preview "End of every day. Reading assignments, preview tomorrow."
