# Layout standard

Last updated: 2026-10-21 (TRIM 6/7a-4c)

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

## Part A (width-cap pass) exceptions, left narrow on purpose

- `app/student/**` (phone-first Student view)
- Public token pages: `app/volunteer*`, `app/preceptor`, `app/open-lab`,
  `app/osce-scenario`, `app/ride-along-poll`
- `app/lvfr-aemt/**` (being archived)
- Timer banners/strips (`components/*Timer*.tsx`, `TimerBanner.tsx`)
- Modals, forms and reading pages at `max-w-2xl` to `max-w-4xl`
  (except the PALS grader and station grader, widened)

Part B (per-page reflow, auto-fit grids, `PageShell`/`ResponsiveGrid`) is not done.
