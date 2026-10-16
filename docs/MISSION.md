# pmiparamedic.tools: mission and principles (Ben, 2026-10-15)
This is the test every build card, keep/park/remove call, and backend cleanup should pass. When a request does not fit here, flag it rather than building it.
## Mission
The site is a supplementary coordination and organization tool for the PMI paramedic program. It is not the system of record for grades, attendance, or compliance (the school's official systems are), and it is not a learning management system. It exists so the people running the program can see, in one place, who is where, what is planned, and how students are progressing in an informal, aggregate way.
## The five jobs
1. Coordinate instructor schedules. Who is available, who is assigned to which class, lab, LVFR day, OSCE or AHA course; one calendar with filter views rather than many calendars. Google Calendar sync is the delivery channel for instructors.
2. Plan labs and classes. Lab days, stations, scenarios, groups, seating, team-lead rotation, the timer, and the special days (OSCE, NREMT prep, ACLS, PALS). Planning is the point; grading is informal support for planning the next lab.
3. Track clinical information in aggregate. Which students are placed where, hours and phase progress across the cohort, Complio and mCE completion status, site visits, the pre-internship profile for agencies. Aggregate and coordination, not the official clinical record.
4. Track lab progress in a non-official way. Skills checked off, scenarios run, where a student is strong or weak as the instructors see it. Useful for coaching and planning, never presented as an official grade.
5. Let students see where they stand. A student view that shows the student their own schedule, their own lab and clinical progress, and the self-assessments they owe. Read-mostly, phone-friendly, their own data only.
## Principles that follow
- Cohort-scoped and repeatable. Anything tied to a schedule or a cohort must work for every cohort without a code change. One-off builds for the current cohort are the exception and get flagged.
- Desktop-first for staff, phone-first for students. Admin and instructor screens are wide and multi-column; the student view and anything students fill in on their own time is built for a phone.
- Fewer things, working well. A feature nobody asked for is a cost even when it is free to run. Prefer improving the five jobs over adding a sixth. Ever-used is the first filter, frequency the second; seasonal tools used a few times a year (seating chart generator, AHA course setup, OSCE) are core, not clutter.
- One writer per piece of state. The timer is the model case: one controller writes, every other screen displays. Where several screens can write the same row today, that is a defect to design out, not a feature.
- The backend is in scope. Dead API routes, duplicated clients, crons nobody reads, third-party services piggybacked on Ben's personal Vercel and Supabase accounts: inventoried and removed with the same discipline as pages. Report first, cut second.
- Data integrity over convenience. Nothing inferred or pattern-guessed is written to the database. Authoritative data already exists in Supabase in Ben's structure; find it. Anything that depends on how the code reads a field is Code's job, with a diagnosis, not a data patch.
- Ben decides, agents execute. User-facing changes reach Ben on the decision sheet or in chat, never only on the Notion board. His instruction is his approval. Technical calls with no user-facing consequence are made by the agents and logged.
- Evidence is a screenshot after a hard refresh, or a query against the live table. A merged PR, a green build, or a Done status is not evidence.
## What the site is not (so nobody builds it again)
Not an attendance system. Not a time clock. Not an inventory or equipment system. Not an email broadcast or announcement platform. Not a gradebook of record. Not an AI scenario generator. Not a compliance or certification registry for staff. Not a CE tracker. If one of these is wanted later it gets its own decision on the sheet, with the cost of keeping it stated.
## How to use this document
Code: before starting a card, check the work fits one of the five jobs and does not recreate something from the "not" list. If it does not fit, set the card to Blocked with the note "mission check" and PM brings it to Ben.
PM (Claude AI): cite the job number on each new build card. Review with Ben at the start of each semester.

Last updated: 2026-10-16
