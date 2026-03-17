#!/usr/bin/env node
/**
 * Reseed LVFR AEMT schedule — calls the reseed API endpoint.
 *
 * Usage:
 *   node scripts/reseed-lvfr-schedule.js
 *   node scripts/reseed-lvfr-schedule.js --direct   (bypass API, hit DB directly)
 *
 * The API approach requires the dev server to be running.
 * The --direct approach connects to Supabase directly using .env.local credentials.
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.local may not exist
}

const isDirect = process.argv.includes('--direct');

// ─── Date helpers ───────────────────────────────────────────────────────────
function dayNumberToDate(dayNum) {
  const weekIndex = Math.floor((dayNum - 1) / 3);
  const dayInWeek = (dayNum - 1) % 3;
  const base = new Date('2026-07-07T12:00:00Z');
  base.setUTCDate(base.getUTCDate() + weekIndex * 7 + dayInWeek);
  return base.toISOString().split('T')[0];
}

function timeDiffMin(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function makeBlockId(title, type) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
  return `${type}-${slug}`;
}

// ─── Full 30-day schedule ───────────────────────────────────────────────────
const SCHEDULE = {
  1: [
    { start: '07:30', end: '08:00', title: 'Roll Call / Welcome / Syllabus / Paperwork', type: 'admin', instructors: ['Ben'] },
    { start: '08:00', end: '08:45', title: 'EMSTesting Setup & Orientation', type: 'activity', instructors: ['Ben'] },
    { start: '08:45', end: '08:55', title: 'BREAK', type: 'break' },
    { start: '08:55', end: '09:55', title: 'Ch 1: EMS Systems — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '09:55', end: '10:05', title: 'BREAK', type: 'break' },
    { start: '10:05', end: '11:05', title: 'Ch 2: Workforce Safety & Wellness — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '11:05', end: '11:15', title: 'BREAK', type: 'break' },
    { start: '11:15', end: '11:55', title: 'Ch 3: Medical, Legal, Ethics — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '11:55', end: '12:00', title: 'Transition', type: 'admin' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:00', title: 'Legal/Ethics Case Discussion', type: 'activity', instructors: ['Ben'] },
    { start: '14:00', end: '14:10', title: 'BREAK', type: 'break' },
    { start: '14:10', end: '15:10', title: 'Group Testing Ch 1-3', type: 'group_testing', instructors: ['Ben'] },
    { start: '15:10', end: '15:30', title: 'Day closeout / Preview Day 2', type: 'admin', instructors: ['Ben'] },
  ],
  2: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Ben'] },
    { start: '07:40', end: '08:25', title: 'Quiz: Ch 1-3 30 questions', type: 'quiz', instructors: ['Ben'] },
    { start: '08:25', end: '08:40', title: 'Quiz Review', type: 'activity', instructors: ['Ben'] },
    { start: '08:40', end: '08:50', title: 'BREAK', type: 'break' },
    { start: '08:50', end: '10:05', title: 'Ch 4: Communications & Documentation — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '10:05', end: '10:15', title: 'BREAK', type: 'break' },
    { start: '10:15', end: '10:45', title: 'Ch 5: Medical Terminology — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '10:45', end: '10:55', title: 'BREAK', type: 'break' },
    { start: '10:55', end: '11:40', title: 'Ch 6: Lifting & Moving — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '11:40', end: '12:00', title: 'Transition', type: 'admin' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '13:30', title: 'Med Terminology Worksheet', type: 'activity', instructors: ['Ben'] },
    { start: '13:30', end: '13:40', title: 'BREAK', type: 'break' },
    { start: '13:40', end: '14:40', title: 'Group Testing Ch 4-6', type: 'group_testing', instructors: ['Ben'] },
    { start: '14:40', end: '14:50', title: 'BREAK', type: 'break' },
    { start: '14:50', end: '15:15', title: 'Day closeout / Preview tomorrow', type: 'admin', instructors: ['Ben'] },
  ],
  3: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor'] },
    { start: '07:40', end: '08:48', title: 'Quiz: Ch 4-6 45 questions', type: 'quiz', instructors: ['Trevor'] },
    { start: '08:48', end: '09:10', title: 'Quiz Review', type: 'activity', instructors: ['Trevor'] },
    { start: '09:10', end: '09:20', title: 'BREAK', type: 'break' },
    { start: '09:20', end: '11:00', title: 'EMT Competency Checkoffs', type: 'activity', instructors: ['Trevor'] },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'Lab prep / Safety brief for PM lifting lab', type: 'admin', instructors: ['Trevor'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Jimi arrives noon' },
    { start: '13:00', end: '15:00', title: 'Lifting & Moving Lab', type: 'lab', instructors: ['Trevor', 'Jimi', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Lab debrief / Day closeout', type: 'admin', instructors: ['Trevor', 'Jimi'] },
  ],
  4: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Ben'] },
    { start: '07:40', end: '08:50', title: 'Ch 1-6 Sub-Module Exam ~35q', type: 'exam', instructors: ['Ben'] },
    { start: '08:50', end: '09:00', title: 'BREAK', type: 'break' },
    { start: '09:00', end: '10:00', title: 'Ch 7: Human Body Part 1', type: 'lecture', instructors: ['Ben'] },
    { start: '10:00', end: '10:10', title: 'BREAK', type: 'break' },
    { start: '10:10', end: '10:15', title: 'Ch 7: Human Body Part 2 start', type: 'lecture', instructors: ['Ben'] },
    { start: '10:15', end: '12:00', title: 'Ch 7: Human Body Parts 2-4 continuing', type: 'lecture', notes: 'TBD PM coverage' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '15:30', title: 'Remaining Ch 7 + reinforcement', type: 'lecture', notes: 'TBD PM coverage' },
  ],
  5: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor'] },
    { start: '07:40', end: '08:10', title: 'Quiz: Ch 7 20q', type: 'quiz', instructors: ['Trevor'] },
    { start: '08:10', end: '08:20', title: 'BREAK', type: 'break' },
    { start: '08:20', end: '09:50', title: 'Ch 8: Pathophysiology — Lecture', type: 'lecture', instructors: ['Trevor'] },
    { start: '09:50', end: '10:00', title: 'BREAK', type: 'break' },
    { start: '10:00', end: '10:45', title: 'Ch 9: Life Span Development — Lecture', type: 'lecture', instructors: ['Trevor'] },
    { start: '10:45', end: '10:55', title: 'BREAK', type: 'break' },
    { start: '10:55', end: '11:55', title: 'Life Span Case Studies activity', type: 'activity', instructors: ['Trevor'] },
    { start: '11:55', end: '12:00', title: 'Transition', type: 'admin' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Jimi arrives noon' },
    { start: '13:00', end: '14:00', title: 'Group Testing Ch 8-9', type: 'group_testing', notes: 'Jimi or Trevor' },
    { start: '14:00', end: '14:10', title: 'BREAK', type: 'break' },
    { start: '14:10', end: '15:10', title: 'A&P Worksheet or additional reinforcement', type: 'activity' },
    { start: '15:10', end: '15:30', title: 'Day closeout / Preview Day 6', type: 'admin' },
  ],
  6: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:40', title: 'Quiz: Ch 8-9 40 questions', type: 'quiz', instructors: ['Jimi'] },
    { start: '08:40', end: '09:00', title: 'Quiz Review', type: 'activity', instructors: ['Jimi'] },
    { start: '09:00', end: '09:10', title: 'BREAK', type: 'break' },
    { start: '09:10', end: '11:00', title: 'Ch 10: Patient Assessment — Lecture', type: 'lecture', instructors: ['Jimi', 'Trevor'] },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'Assessment demo', type: 'activity', instructors: ['Jimi'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:10', title: 'Assessment practice', type: 'activity', instructors: ['Jimi', 'Trevor'] },
    { start: '14:10', end: '14:20', title: 'BREAK', type: 'break' },
    { start: '14:20', end: '15:10', title: 'Vital signs practice', type: 'activity', instructors: ['Jimi', 'Trevor'] },
    { start: '15:10', end: '15:30', title: 'Day closeout / Preview Day 7', type: 'admin' },
  ],
  7: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '09:10', title: 'Ch 10 Assessment Exam ~45q', type: 'exam', instructors: ['Jimi'] },
    { start: '09:10', end: '09:20', title: 'BREAK', type: 'break' },
    { start: '09:20', end: '10:40', title: 'Ch 12: Principles of Pharmacology — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '10:40', end: '10:50', title: 'BREAK', type: 'break' },
    { start: '10:50', end: '12:00', title: 'Ch 13: Vascular Access — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '13:20', title: 'Ch 13: Finish', type: 'lecture', instructors: ['Jimi'] },
    { start: '13:20', end: '13:30', title: 'BREAK', type: 'break' },
    { start: '13:30', end: '14:00', title: 'Med Admin Demo: IM, SQ, IN routes', type: 'activity', instructors: ['Jimi'] },
    { start: '14:00', end: '15:10', title: 'Med Admin Practice', type: 'activity', instructors: ['Jimi'] },
    { start: '15:10', end: '15:30', title: 'Day closeout', type: 'admin', instructors: ['Jimi'] },
  ],
  8: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:40', title: 'Quiz: Ch 12-13 40 questions', type: 'quiz', instructors: ['Jimi'] },
    { start: '08:40', end: '09:00', title: 'Quiz Review', type: 'activity', instructors: ['Jimi'] },
    { start: '09:00', end: '09:10', title: 'BREAK', type: 'break' },
    { start: '09:10', end: '11:00', title: 'IV Manikin Arm Practice', type: 'lab', instructors: ['Jimi', 'Ben'] },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'IV troubleshooting + continued arm practice', type: 'lab', instructors: ['Jimi', 'Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Pima Cadre arrives' },
    { start: '13:00', end: '15:00', title: 'LIVE STICK IV Practice', type: 'lab', instructors: ['Jimi', 'Ben'], notes: 'Pima Cadre assisting' },
    { start: '15:00', end: '15:30', title: 'IV debrief / Day closeout', type: 'admin' },
  ],
  9: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Exam prep', type: 'admin', instructors: ['Jimi', 'Trevor'] },
    { start: '07:40', end: '09:40', title: 'Ch 7-9, 12, 13 Sub-Module Exam ~65q', type: 'exam', instructors: ['Jimi', 'Trevor'] },
    { start: '09:40', end: '10:00', title: 'BREAK', type: 'break' },
    { start: '10:00', end: '10:30', title: 'Exam Review', type: 'activity', instructors: ['Jimi', 'Trevor'] },
    { start: '10:30', end: '10:40', title: 'BREAK', type: 'break' },
    { start: '10:40', end: '11:10', title: 'IV Math & Drip Rate Calculations', type: 'lecture', instructors: ['Jimi'] },
    { start: '11:10', end: '12:00', title: 'EMT Competency Checkoffs', type: 'activity', instructors: ['Jimi', 'Trevor'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '15:00', title: 'Practice / Checkoffs continued', type: 'activity', instructors: ['Jimi', 'Trevor'] },
    { start: '15:00', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  10: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:40', title: 'Ch 11: Airway Part 1', type: 'lecture', instructors: ['Jimi'] },
    { start: '08:40', end: '08:50', title: 'BREAK', type: 'break' },
    { start: '08:50', end: '09:50', title: 'Ch 11: Airway Part 2', type: 'lecture', instructors: ['Jimi'] },
    { start: '09:50', end: '10:00', title: 'BREAK', type: 'break' },
    { start: '10:00', end: '11:00', title: 'Ch 11: Airway Part 3', type: 'lecture', instructors: ['Jimi'] },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'Ch 17: Respiratory Part 1', type: 'lecture', instructors: ['Jimi'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:20', title: 'Ch 17: Respiratory Part 2', type: 'lecture', instructors: ['Jimi'] },
    { start: '14:20', end: '14:30', title: 'BREAK', type: 'break' },
    { start: '14:30', end: '15:10', title: 'Ch 17: Respiratory Part 3', type: 'lecture', instructors: ['Jimi'] },
    { start: '15:10', end: '15:30', title: 'Day closeout / Preview airway lab tomorrow', type: 'admin' },
  ],
  11: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:40', title: 'Quiz: Ch 11 + Ch 17 40 questions', type: 'quiz', instructors: ['Jimi'] },
    { start: '08:40', end: '09:00', title: 'Quiz Review', type: 'activity' },
    { start: '09:00', end: '09:10', title: 'BREAK', type: 'break' },
    { start: '09:10', end: '11:10', title: 'Ch 14: Shock — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '11:10', end: '11:20', title: 'BREAK', type: 'break' },
    { start: '11:20', end: '12:00', title: 'Airway Lab setup / Safety brief', type: 'admin', instructors: ['Jimi'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Ben arrives' },
    { start: '13:00', end: '15:00', title: 'Airway Lab', type: 'lab', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Lab debrief / Day closeout', type: 'admin' },
  ],
  12: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:10', title: 'Quiz: Ch 14 20q', type: 'quiz', instructors: ['Jimi'] },
    { start: '08:10', end: '08:20', title: 'BREAK', type: 'break' },
    { start: '08:20', end: '09:20', title: 'Ch 15: BLS Resuscitation — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '09:20', end: '09:30', title: 'BREAK', type: 'break' },
    { start: '09:30', end: '11:00', title: 'Ch 18: Cardiovascular — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'Group Testing Ch 15 + Ch 18', type: 'group_testing' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Ben arrives' },
    { start: '13:00', end: '15:00', title: 'BLS Lab: CPR + AED + team resuscitation', type: 'lab', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  13: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Exam prep', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '09:35', title: 'Resuscitation Module Exam ~75q', type: 'exam', instructors: ['Jimi'] },
    { start: '09:35', end: '09:50', title: 'BREAK', type: 'break' },
    { start: '09:50', end: '10:30', title: 'Exam Review', type: 'activity', instructors: ['Jimi'] },
    { start: '10:30', end: '10:40', title: 'BREAK', type: 'break' },
    { start: '10:40', end: '11:30', title: 'Ch 26: Trauma Overview — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '11:30', end: '12:00', title: 'Ch 27: Bleeding — Lecture start', type: 'lecture', instructors: ['Jimi'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '13:10', title: 'Ch 27: Finish', type: 'lecture', instructors: ['Jimi'] },
    { start: '13:10', end: '14:25', title: 'Ch 28: Soft-Tissue Injuries — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '14:25', end: '14:35', title: 'BREAK', type: 'break' },
    { start: '14:35', end: '15:20', title: 'Group Testing Ch 26-28', type: 'group_testing', instructors: ['Jimi'] },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  14: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:48', title: 'Quiz: Ch 26-28 45 questions', type: 'quiz', instructors: ['Jimi'] },
    { start: '08:48', end: '09:10', title: 'Quiz Review', type: 'activity', instructors: ['Jimi'] },
    { start: '09:10', end: '09:20', title: 'BREAK', type: 'break' },
    { start: '09:20', end: '10:30', title: 'Ch 29: Face & Neck Injuries — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '10:30', end: '10:40', title: 'BREAK', type: 'break' },
    { start: '10:40', end: '12:00', title: 'Ch 30: Head & Spine Injuries — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Ben arrives' },
    { start: '13:00', end: '15:00', title: 'Stop the Bleed Lab', type: 'lab', instructors: ['Jimi', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Lab debrief / Day closeout', type: 'admin' },
  ],
  15: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor'] },
    { start: '07:40', end: '08:40', title: 'Quiz: Ch 29-30 40 questions', type: 'quiz', instructors: ['Trevor'] },
    { start: '08:40', end: '09:00', title: 'Quiz Review', type: 'activity', instructors: ['Trevor'] },
    { start: '09:00', end: '09:10', title: 'BREAK', type: 'break' },
    { start: '09:10', end: '10:50', title: 'Ch 31: Chest Injuries — Lecture', type: 'lecture', instructors: ['Trevor'] },
    { start: '10:50', end: '11:00', title: 'BREAK', type: 'break' },
    { start: '11:00', end: '12:00', title: 'Ch 32: Abdominal & GU — Lecture', type: 'lecture', instructors: ['Trevor'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Ben arrives' },
    { start: '13:00', end: '15:00', title: 'C-Spine Lab', type: 'lab', instructors: ['Trevor', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Lab debrief / Day closeout', type: 'admin' },
  ],
  16: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi'] },
    { start: '07:40', end: '08:40', title: 'Quiz: Ch 31-32 35 questions', type: 'quiz', instructors: ['Jimi'] },
    { start: '08:40', end: '08:58', title: 'Quiz Review', type: 'activity' },
    { start: '08:58', end: '09:10', title: 'BREAK', type: 'break' },
    { start: '09:10', end: '10:45', title: 'Ch 33: Orthopaedic Injuries — Lecture', type: 'lecture', instructors: ['Jimi'] },
    { start: '10:45', end: '10:55', title: 'BREAK', type: 'break' },
    { start: '10:55', end: '12:00', title: 'Group Testing Ch 31-33', type: 'group_testing' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:30', title: 'Trauma case studies', type: 'activity' },
    { start: '14:30', end: '14:40', title: 'BREAK', type: 'break' },
    { start: '14:40', end: '15:20', title: 'Skill checkoffs or reinforcement', type: 'activity' },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  17: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor'] },
    { start: '07:40', end: '08:10', title: 'Quiz: Ch 33 15q', type: 'quiz', instructors: ['Trevor'] },
    { start: '08:10', end: '08:20', title: 'BREAK', type: 'break' },
    { start: '08:20', end: '10:20', title: 'Ch 34: Environmental Emergencies — Lecture', type: 'lecture', instructors: ['Trevor'] },
    { start: '10:20', end: '10:30', title: 'BREAK', type: 'break' },
    { start: '10:30', end: '12:00', title: 'Group Testing Ch 34 + scenarios', type: 'group_testing', instructors: ['Trevor'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Ben arrives' },
    { start: '13:00', end: '15:00', title: 'Splinting Lab', type: 'lab', instructors: ['Trevor', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Lab debrief / Day closeout', type: 'admin' },
  ],
  18: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor'] },
    { start: '07:40', end: '08:10', title: 'Quiz: Ch 34 15q', type: 'quiz', instructors: ['Trevor'] },
    { start: '08:10', end: '08:20', title: 'BREAK', type: 'break' },
    { start: '08:20', end: '10:00', title: 'Trauma module review — group testing', type: 'group_testing', instructors: ['Trevor', 'Ben'] },
    { start: '10:00', end: '10:10', title: 'BREAK', type: 'break' },
    { start: '10:10', end: '12:00', title: 'Additional trauma lab reps', type: 'activity', instructors: ['Trevor', 'Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:30', title: 'Integrated trauma scenarios', type: 'activity', instructors: ['Trevor', 'Ben'] },
    { start: '14:30', end: '14:40', title: 'BREAK', type: 'break' },
    { start: '14:40', end: '15:20', title: 'Final skill checkoffs', type: 'activity', instructors: ['Trevor', 'Ben'] },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  19: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Exam prep', type: 'admin', instructors: ['Ben'] },
    { start: '07:40', end: '09:40', title: 'Trauma Module Exam ~65q', type: 'exam', instructors: ['Ben'] },
    { start: '09:40', end: '09:55', title: 'BREAK', type: 'break' },
    { start: '09:55', end: '10:30', title: 'Exam Review', type: 'activity', instructors: ['Ben'] },
    { start: '10:30', end: '10:40', title: 'BREAK', type: 'break' },
    { start: '10:40', end: '11:25', title: 'Ch 16: Medical Overview — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '11:25', end: '12:00', title: 'Transition / bridge discussion', type: 'activity', instructors: ['Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:00', title: 'Ch 19: Neurologic Emergencies — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '14:00', end: '14:10', title: 'BREAK', type: 'break' },
    { start: '14:10', end: '14:40', title: 'Stroke Scale Practice', type: 'activity', instructors: ['Ben'] },
    { start: '14:40', end: '15:20', title: 'Group Testing Ch 16 + Ch 19', type: 'group_testing', instructors: ['Ben'] },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  20: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Ben'] },
    { start: '07:40', end: '08:18', title: 'Quiz: Ch 16 + Ch 19 25 questions', type: 'quiz', instructors: ['Ben'] },
    { start: '08:18', end: '08:30', title: 'Quiz Review', type: 'activity', instructors: ['Ben'] },
    { start: '08:30', end: '08:40', title: 'BREAK', type: 'break' },
    { start: '08:40', end: '10:10', title: 'Ch 20: GI & Urologic Emergencies — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '10:10', end: '10:20', title: 'BREAK', type: 'break' },
    { start: '10:20', end: '11:20', title: 'Ch 21: Endocrine & Hematologic — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '11:20', end: '11:30', title: 'BREAK', type: 'break' },
    { start: '11:30', end: '12:10', title: 'Ch 22: Immunologic Emergencies — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '12:10', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:00', title: 'Medical case studies', type: 'activity', instructors: ['Ben'] },
    { start: '14:00', end: '14:10', title: 'BREAK', type: 'break' },
    { start: '14:10', end: '15:10', title: 'Group Testing Ch 20-22', type: 'group_testing', instructors: ['Ben'] },
    { start: '15:10', end: '15:30', title: 'Day closeout', type: 'admin', instructors: ['Ben'] },
  ],
  21: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor', 'Ben'] },
    { start: '07:40', end: '09:20', title: 'Quiz: Ch 20-22 60 questions', type: 'quiz' },
    { start: '09:20', end: '09:50', title: 'Quiz Review', type: 'activity' },
    { start: '09:50', end: '10:00', title: 'BREAK', type: 'break' },
    { start: '10:00', end: '11:15', title: 'Ch 23: Toxicology — Lecture', type: 'lecture' },
    { start: '11:15', end: '11:25', title: 'BREAK', type: 'break' },
    { start: '11:25', end: '12:10', title: 'Ch 24: Psychiatric Emergencies — Lecture', type: 'lecture' },
    { start: '12:10', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Jimi arrives noon' },
    { start: '13:00', end: '13:50', title: 'Ch 25: Gynecologic Emergencies — Lecture', type: 'lecture' },
    { start: '13:50', end: '14:00', title: 'BREAK', type: 'break' },
    { start: '14:00', end: '15:00', title: 'Medical case studies / Group Testing Ch 23-25', type: 'group_testing' },
    { start: '15:00', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  22: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Exam prep', type: 'admin', instructors: ['Ben'] },
    { start: '07:40', end: '09:40', title: 'Medical Module Exam ~65q', type: 'exam', instructors: ['Ben'] },
    { start: '09:40', end: '09:55', title: 'BREAK', type: 'break' },
    { start: '09:55', end: '10:30', title: 'Exam Review', type: 'activity', instructors: ['Ben'] },
    { start: '10:30', end: '10:40', title: 'BREAK', type: 'break' },
    { start: '10:40', end: '12:00', title: 'Ch 35: OB & Neonatal Care — Lecture Part 1', type: 'lecture', instructors: ['Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:20', title: 'Ch 35: OB & Neonatal Care — Lecture Part 2', type: 'lecture', instructors: ['Ben'] },
    { start: '14:20', end: '14:30', title: 'BREAK', type: 'break' },
    { start: '14:30', end: '15:20', title: 'Group Testing / OB scenarios', type: 'group_testing', instructors: ['Ben'] },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  23: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Trevor'] },
    { start: '07:40', end: '08:10', title: 'Quiz: Ch 35 20q', type: 'quiz', instructors: ['Trevor'] },
    { start: '08:10', end: '08:20', title: 'BREAK', type: 'break' },
    { start: '08:20', end: '09:50', title: 'Ch 36: Peds Part 1', type: 'lecture', instructors: ['Trevor', 'Ben'] },
    { start: '09:50', end: '10:00', title: 'BREAK', type: 'break' },
    { start: '10:00', end: '11:30', title: 'Ch 36: Peds Part 2', type: 'lecture' },
    { start: '11:30', end: '12:00', title: 'Group discussion / peds scenarios', type: 'activity' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Jimi arrives noon' },
    { start: '13:00', end: '14:30', title: 'Ch 36: Peds Part 3', type: 'lecture' },
    { start: '14:30', end: '14:40', title: 'BREAK', type: 'break' },
    { start: '14:40', end: '15:20', title: 'Peds case studies or Broselow tape review', type: 'activity' },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  24: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '07:40', end: '08:30', title: 'Ch 36: Peds Part 4', type: 'lecture' },
    { start: '08:30', end: '08:40', title: 'BREAK', type: 'break' },
    { start: '08:40', end: '10:00', title: 'Ch 37: Geriatric Emergencies — Lecture', type: 'lecture' },
    { start: '10:00', end: '10:10', title: 'BREAK', type: 'break' },
    { start: '10:10', end: '11:00', title: 'Ch 38: Special Challenges — Lecture', type: 'lecture' },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'Group Testing Ch 36-38', type: 'group_testing' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:30', title: 'OB Delivery / NRP Lab', type: 'lab', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '14:30', end: '14:40', title: 'BREAK', type: 'break' },
    { start: '14:40', end: '15:20', title: 'Additional peds/geri case studies or checkoffs', type: 'activity' },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  25: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Exam prep', type: 'admin', instructors: ['Ben'] },
    { start: '07:40', end: '09:20', title: 'Special Pop Module Exam ~55q', type: 'exam', instructors: ['Ben'] },
    { start: '09:20', end: '09:35', title: 'BREAK', type: 'break' },
    { start: '09:35', end: '10:10', title: 'Exam Review', type: 'activity', instructors: ['Ben'] },
    { start: '10:10', end: '10:20', title: 'BREAK', type: 'break' },
    { start: '10:20', end: '10:50', title: 'Ch 39: Transport Operations — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '10:50', end: '11:35', title: 'Ch 40: Extrication, Rescue, Hazmat — Lecture', type: 'lecture', instructors: ['Ben'] },
    { start: '11:35', end: '12:00', title: 'Discussion / Q&A', type: 'activity', instructors: ['Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break', notes: 'Jimi arrives noon' },
    { start: '13:00', end: '13:40', title: 'Ch 41: Incident Management — Lecture', type: 'lecture', notes: 'Ben or Jimi' },
    { start: '13:40', end: '14:20', title: 'MCI Tabletop Exercise — START triage', type: 'activity', instructors: ['Ben', 'Jimi'] },
    { start: '14:20', end: '14:30', title: 'BREAK', type: 'break' },
    { start: '14:30', end: '15:15', title: 'Ch 42: Terrorism & Disaster — Lecture', type: 'lecture' },
    { start: '15:15', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  26: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Exam prep', type: 'admin', instructors: ['Jimi', 'Ben'] },
    { start: '07:40', end: '08:50', title: 'EMS Ops Module Exam ~35q', type: 'exam' },
    { start: '08:50', end: '09:00', title: 'BREAK', type: 'break' },
    { start: '09:00', end: '12:00', title: 'Comprehensive review — group testing', type: 'group_testing', instructors: ['Jimi', 'Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '15:00', title: 'Skills practice / checkoffs', type: 'activity', instructors: ['Jimi', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  27: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '07:40', end: '10:00', title: 'Comprehensive review — weak area focus', type: 'group_testing' },
    { start: '10:00', end: '10:10', title: 'BREAK', type: 'break' },
    { start: '10:10', end: '12:00', title: 'Skills stations: 3 instructors rotate', type: 'activity', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '15:00', title: 'Skills checkoff marathon', type: 'activity', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '15:00', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  28: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi', 'Ben'] },
    { start: '07:40', end: '10:00', title: 'Comprehensive review — practice exam', type: 'group_testing', instructors: ['Jimi', 'Ben'] },
    { start: '10:00', end: '10:10', title: 'BREAK', type: 'break' },
    { start: '10:10', end: '12:00', title: 'Skills remediation / final checkoffs', type: 'activity' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:30', title: 'Final exam prep', type: 'activity', instructors: ['Jimi', 'Ben'] },
    { start: '14:30', end: '14:40', title: 'BREAK', type: 'break' },
    { start: '14:40', end: '15:20', title: 'Q&A — student-driven', type: 'activity' },
    { start: '15:20', end: '15:30', title: 'Day closeout / Final exam logistics', type: 'admin' },
  ],
  29: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Announcements', type: 'admin', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '07:40', end: '10:00', title: 'Final comprehensive review', type: 'group_testing' },
    { start: '10:00', end: '10:10', title: 'BREAK', type: 'break' },
    { start: '10:10', end: '12:00', title: 'Last chance skills remediation', type: 'activity' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:30', title: 'Practice scenarios — integrated', type: 'activity', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '14:30', end: '14:40', title: 'BREAK', type: 'break' },
    { start: '14:40', end: '15:20', title: 'Final Q&A + exam logistics', type: 'activity' },
    { start: '15:20', end: '15:30', title: 'Day closeout', type: 'admin' },
  ],
  30: [
    { start: '07:30', end: '07:40', title: 'Roll Call / Final exam prep', type: 'admin', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '07:40', end: '11:00', title: 'COMPREHENSIVE FINAL EXAM', type: 'exam', instructors: ['Jimi', 'Trevor', 'Ben'] },
    { start: '11:00', end: '11:10', title: 'BREAK', type: 'break' },
    { start: '11:10', end: '12:00', title: 'Exam Review', type: 'activity' },
    { start: '12:00', end: '13:00', title: 'LUNCH', type: 'break' },
    { start: '13:00', end: '14:00', title: 'NREMT Preparation Briefing', type: 'activity' },
    { start: '14:00', end: '14:10', title: 'BREAK', type: 'break' },
    { start: '14:10', end: '15:00', title: 'Course evaluations + admin closeout', type: 'admin' },
    { start: '15:00', end: '15:30', title: 'Course closeout — final words, congratulations', type: 'admin' },
  ],
};

// ─── Direct DB approach ─────────────────────────────────────────────────────
async function runDirect() {
  const { createClient } = require('@supabase/supabase-js');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Get latest plan instance
  let instance;
  {
    const { data, error } = await supabase
      .from('lvfr_aemt_plan_instances')
      .select('id, start_date')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('No existing plan instance found, creating one...');
      const { data: newInst, error: createErr } = await supabase
        .from('lvfr_aemt_plan_instances')
        .insert({
          name: 'LVFR AEMT Summer 2026',
          start_date: '2026-07-07',
          status: 'draft',
        })
        .select('id, start_date')
        .single();
      if (createErr) {
        console.error('Failed to create instance:', createErr.message);
        process.exit(1);
      }
      instance = newInst;
    } else {
      instance = data;
    }
  }

  console.log(`Using plan instance: ${instance.id} (start_date: ${instance.start_date})`);

  // 2. Look up instructor IDs
  const instructorIds = { Ben: null, Jimi: null, Trevor: null };

  {
    const { data } = await supabase
      .from('lab_users')
      .select('id')
      .eq('email', 'bhartnell@pmi.edu')
      .limit(1)
      .single();
    if (data) instructorIds.Ben = data.id;
  }
  {
    const { data } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('name', '%Jimi%Vargas%')
      .limit(1);
    if (data && data.length > 0) instructorIds.Jimi = data[0].id;
    else {
      const { data: d2 } = await supabase
        .from('lab_users')
        .select('id')
        .ilike('name', '%Vargas%')
        .limit(1);
      if (d2 && d2.length > 0) instructorIds.Jimi = d2[0].id;
    }
  }
  {
    const { data } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('name', '%Trevor%Paul%')
      .limit(1);
    if (data && data.length > 0) instructorIds.Trevor = data[0].id;
    else {
      const { data: d2 } = await supabase
        .from('lab_users')
        .select('id')
        .ilike('name', '%Paul%')
        .limit(1);
      if (d2 && d2.length > 0) instructorIds.Trevor = d2[0].id;
    }
  }

  console.log('Instructor IDs:', instructorIds);

  // 3. Delete all existing placements
  console.log('Deleting existing placements...');
  const { error: deleteError, count } = await supabase
    .from('lvfr_aemt_plan_placements')
    .delete()
    .eq('instance_id', instance.id);

  if (deleteError) {
    console.error('Failed to delete placements:', deleteError.message);
    process.exit(1);
  }
  console.log(`Deleted ${count || 'all'} existing placements.`);

  // 4. Build content blocks
  const contentBlocksMap = new Map();
  for (const [, blocks] of Object.entries(SCHEDULE)) {
    for (const block of blocks) {
      const blockId = makeBlockId(block.title, block.type);
      if (!contentBlocksMap.has(blockId)) {
        contentBlocksMap.set(blockId, {
          id: blockId,
          name: block.title,
          duration_min: timeDiffMin(block.start, block.end),
          block_type: block.type,
        });
      }
    }
  }

  // 5. Upsert content blocks
  const { data: existingBlocks } = await supabase
    .from('lvfr_aemt_content_blocks')
    .select('id');
  const existingIds = new Set((existingBlocks || []).map(b => b.id));

  const blockArray = Array.from(contentBlocksMap.values());
  const newBlocks = blockArray.filter(b => !existingIds.has(b.id));
  console.log(`Content blocks: ${blockArray.length} total, ${newBlocks.length} new`);

  if (newBlocks.length > 0) {
    for (let i = 0; i < newBlocks.length; i += 50) {
      const batch = newBlocks.slice(i, i + 50);
      const { error } = await supabase
        .from('lvfr_aemt_content_blocks')
        .insert(batch);
      if (error) {
        console.error(`Failed to insert content blocks batch ${i}:`, error.message);
        process.exit(1);
      }
    }
    console.log(`Inserted ${newBlocks.length} new content blocks.`);
  }

  // 6. Build placements
  const allPlacements = [];
  for (const [dayStr, blocks] of Object.entries(SCHEDULE)) {
    const dayNum = parseInt(dayStr);
    const date = dayNumberToDate(dayNum);
    blocks.forEach((block, idx) => {
      const blockId = makeBlockId(block.title, block.type);
      const duration = timeDiffMin(block.start, block.end);
      const primaryInstructor = block.instructors?.[0] || null;
      const instructorId = primaryInstructor ? instructorIds[primaryInstructor] : null;
      const instructorName = block.instructors?.join(' + ') || null;
      const notesParts = [];
      if (block.notes) notesParts.push(block.notes);
      if (block.instructors && block.instructors.length > 1) {
        notesParts.push(`All instructors: ${block.instructors.join(', ')}`);
      }

      allPlacements.push({
        instance_id: instance.id,
        content_block_id: blockId,
        day_number: dayNum,
        date,
        start_time: block.start,
        end_time: block.end,
        duration_min: duration,
        instructor_id: instructorId,
        instructor_name: instructorName,
        custom_title: block.title,
        custom_notes: notesParts.length > 0 ? notesParts.join('; ') : null,
        sort_order: idx,
      });
    });
  }

  // 7. Insert placements in batches
  console.log(`Inserting ${allPlacements.length} placements...`);
  let inserted = 0;
  const errors = [];

  for (let i = 0; i < allPlacements.length; i += 50) {
    const batch = allPlacements.slice(i, i + 50);
    const { error } = await supabase
      .from('lvfr_aemt_plan_placements')
      .insert(batch);
    if (error) {
      errors.push(`Batch ${Math.floor(i / 50)}: ${error.message}`);
      console.error(`  Batch ${Math.floor(i / 50)} failed:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log('\n=== RESEED COMPLETE ===');
  console.log(`Instance: ${instance.id}`);
  console.log(`Days: ${Object.keys(SCHEDULE).length}`);
  console.log(`Placements inserted: ${inserted}/${allPlacements.length}`);
  console.log(`Content blocks created: ${newBlocks.length}`);
  console.log(`Date range: ${dayNumberToDate(1)} to ${dayNumberToDate(30)}`);
  if (errors.length > 0) {
    console.log(`ERRORS: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

// ─── API approach ───────────────────────────────────────────────────────────
async function runViaApi() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  console.log(`Calling POST ${baseUrl}/api/lvfr-aemt/planner/reseed ...`);
  console.log('NOTE: Dev server must be running and you must be logged in as admin.');
  console.log('Use --direct flag to bypass API and connect to Supabase directly.\n');

  try {
    const res = await fetch(`${baseUrl}/api/lvfr-aemt/planner/reseed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to call API:', err.message);
    console.error('Is the dev server running? Try: node scripts/reseed-lvfr-schedule.js --direct');
    process.exit(1);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
if (isDirect) {
  runDirect().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
} else {
  runViaApi().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
