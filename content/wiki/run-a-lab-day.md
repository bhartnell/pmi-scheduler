---
title: Run a lab day
section: running-the-program
roles: [instructor, lead_instructor]
summary: Start a lab day's timer, move through rotations, and end the lab — the day-of playbook for stations and the shared timer display.
related: [build-a-lab-day-from-a-template]
verified: true
updated: "2026-09-22"
---

## What this is for

Running an already-scheduled lab day: opening the timer, checking every station is ready, moving the group through rotations, and closing the lab out at the end.

## When you'd do this

On the day of a scheduled lab, once students and stations are set up and it's time to start the clock.

## Before you start

- The lab day should already exist with its stations set. If you still need to generate it from a template, see **Build a lab day from a template**.
- The Rotation Length and number of rotations are set at the **lab-day level**, not per station — every station runs on the same clock.

## Steps

1. Open the lab day's detail page.
2. Click **Start Timer** in the header to open the timer panel — this only opens the panel, it doesn't start the countdown yet.
3. Before starting, check the **Station Ready Status** list. If you press Play while a station isn't marked ready, you'll get a warning prompt first.
4. Click the **Play** button (or press `Space`) to start the first rotation. If no timer exists yet for this lab day, the first click creates it and the second click actually starts the countdown — that two-step is intentional, not a glitch.
5. When a rotation ends, everyone watching sees a full-screen **ROTATE!** alert with an **ACKNOWLEDGE** button. Click **Next Rotation** (or press `N`) to advance the group.
6. To adjust on the fly: use **-5 / -1 / +1 / +5** to nudge the current rotation, or **Rotation Length** to change the duration for the current and remaining rotations. This does not change rotations that already finished.
7. On the last rotation the button changes to **Cleanup** — click it instead of trying to advance past the final rotation.
8. To show the timer on a projector or second device, click **Share Display** to copy the live display link, or the monitor icon to open it directly in a new tab.
9. When the lab is fully done, click the trash-can icon (**End Lab / Clear Timer**) and confirm. This clears the timer for everyone watching it.

## What good looks like

- Every station shows Ready before you press Play.
- The countdown, rotation number, and ROTATE alert match across every device watching — the controller's laptop, a projector, and any instructor's phone.
- A Rotation Length change you make mid-lab shows up immediately on every other screen watching the same lab day.

## When it goes wrong

The lab timer has an unusually long history of hard-to-reproduce sync bugs — as of this writing, 11 are tracked against it in the Bug & Fix Log and more than half are still open or have recurred after a prior fix. Most involve one device disagreeing with another about the time or duration, not a broken button.

Known issues as of 2026-09-22:

- **The countdown can freeze or flicker** between the correct value and a stale one — reported as class-blocking, not yet fixed.
- **A Rotation Length change made from the Edit Lab Day page doesn't reach an already-running timer.** The in-timer **Rotation Length** control (step 6 above) is the only supported way to change duration mid-lab — this has recurred after a prior fix, so don't rely on the edit page for a live lab.
- **The trash-can "End Lab" button has been reported to not fully clear a stuck timer** in some cases. If it won't go away after clicking and confirming, refresh the page before trying again.
- **Timers have been reported starting a few seconds early or late** on a device that's relying on background polling instead of getting a live update — a known lag pattern that has recurred.
- The timer used for **individual skill-station grading** (NREMT-style stations) is a separate component from the lab-day rotation timer described here — if something looks off on a skill station's countdown specifically, it's a different system than the one this article covers.

If a timer looks stuck, wrong, or out of sync between two devices, the fastest fix is usually to **refresh the page** — the timer's real state lives on the server, not in your browser, so a refresh re-syncs you without affecting anyone else watching it. If that doesn't resolve it, use the Feedback button (it auto-captures your browser info) so the report has enough detail to track down.

## Related

- Build a lab day from a template
