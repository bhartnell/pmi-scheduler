# Layout standard

Last updated: 2026-10-21 (TRIM 6/7a-5)

Ben runs a 1920 screen at 80 percent browser zoom, so the viewport is about
2400 CSS px wide. Desktop-first; adapt DOWN. Acceptance test is "more visible
without scrolling" at 2400 and at 1440 CSS px.

## Rules

- Page container: full width with horizontal padding (`px-4 lg:px-8`), capped
  at `max-w-screen-2xl` for very wide monitors. No `max-w-5xl/6xl/7xl mx-auto`
  wrappers on working pages.
- Card and tile groups: `grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-4`
  (or `md:grid-cols-2 xl:grid-cols-3` where the count is known).
- Side-by-side panes: `lg:grid-cols-[minmax(16rem,1fr)_2fr]`, stack below `lg`.
- Tables: full width; scroll horizontally inside the table wrapper only below `md`.
- Student view and the pre-internship form are phone-first: single column,
  two columns at `lg`.
- Touch targets at least 44px high.

## Working pages get NO width cap (Part A2)

Pages where someone grades, runs a lab, or reads a tracker fill the window:
`w-full px-4 md:px-6 2xl:px-8`, no `max-w-*` on the page wrapper. Hubs,
settings, forms and reports keep `max-w-screen-2xl`. Inner `max-w-3xl/4xl`
blocks capping a column of controls on working pages go too, unless they wrap
a single text paragraph.

## 3000px ceiling (TRIM 6/7a-4c)

Working pages are `w-full max-w-[3000px] mx-auto` (home and the pages Part A2
uncapped). Ben's 80 percent (2400 CSS px) and 67 percent (2880) full-screen
views are under the ceiling, so nothing changes there; at 33 percent (about
5800) the page stops spreading and centers. Everything under 3000 is uncapped.
Applied to home (`app/page.tsx`) and every page carrying the Part A2 class
(`w-full max-w-[3000px] mx-auto px-4 md:px-6 2xl:px-8`).

## Tile standard (TRIM 6/7a-5, mock round 9) - supersedes Part A/A2 where they conflict

Tiles size to their content. The window is wide; the tiles do not care. Spare
width becomes space between tiles, never a stretched tile.

1. Page gutter scales with the viewport: `padding-inline: clamp(16px, 2.75vw, 96px)`
   (`px-[clamp(16px,2.75vw,96px)]`). No max-width cap on working pages below
   3000px; content pages (hubs, forms, settings) may cap at 1800px.
2. Gap between tiles 18px (16px on phone). Section label (small caps, faint,
   12px, letter-spaced) 6px above its tiles; 18px between groups.
3. Tile = surface one step lighter than the page background, 1px border,
   radius 12px, padding 14px 16px. Separation by surface and gap, not heavy
   outlines or shadows. Nested blocks inside a tile use the sunk shade (one
   step darker than the surface), radius 8px.
4. Column grids inside a tile have a max column width (week day column
   `minmax(120px, 220px)`; station rows full tile width, one line, 44px tall).
   When the window is wider than the tile needs, the grid leaves the rest as
   gap (`justify-content: space-between`) or a neighbor tile takes it.
5. Text measure under about 70 characters. Type scale: 15px tile titles, 13px
   body, 12px meta, 11px labels; tabular numerals on anything numeric.
6. Color: one accent for actions; type colors for calendar events (lab, class,
   clinical, AHA/NREMT, OSCE); semantic green/amber/red only for state (open
   station, needs instructors, errors). Platoon A/B/C badge only, no day tint.
7. Touch targets 44px for anything tapped on a tablet (Grade, Sign up, Start
   Timer); denser rows where people scan.
8. Phone: everything stacks in one column, gutter 16px, week becomes a day list.

Applied to home (`app/page.tsx`, `components/home/*`): row 1 is
`grid-cols-[minmax(360px,2fr)_minmax(0,3fr)]` (Today left, This week right),
stacking below 1200px; row 2 is the Month tile centered at max 1250px. Each of
the week and month tiles has its own Mine / Everyone / Labs only filter, saved
as `week_filter` / `month_filter` in the `calendar_band` dashboard-layout key.
The old Stacked / Side by side switch is gone; a saved `layout` key is ignored.

## Part A (width-cap pass) exceptions, left narrow on purpose

- `app/student/**` (phone-first Student view) - NOT an exception since STUDENT VIEW 5d: kept student pages use the clamp gutter and no width cap
- Public token pages: `app/volunteer*`, `app/preceptor`, `app/open-lab`,
  `app/osce-scenario`, `app/ride-along-poll`
- `app/lvfr-aemt/**` (being archived)
- Timer banners/strips (`components/*Timer*.tsx`, `TimerBanner.tsx`)
- Modals, forms and reading pages at `max-w-2xl` to `max-w-4xl`
  (except the PALS grader and station grader, widened)

Part B (per-page reflow, auto-fit grids, `PageShell`/`ResponsiveGrid`) is not done.
