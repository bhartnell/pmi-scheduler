/**
 * General export/report engine — first instance powers the AHA Results Export.
 *
 * Shape: data-source -> select records (per-student / per-cohort) -> render
 * (formatted form OR plain document) -> styled HTML doc -> browser print-to-PDF.
 *
 * Templates are PLUGGABLE: each report type registers a ReportTemplate. The AHA
 * forms are the detailed-form branch; later branches (COAEMSP hospital logs,
 * team-lead summaries, general data reports) register the same way. Nothing in
 * this core is AHA- or course-specific.
 *
 * Rendering reuses the proven NREMT approach (lib/nremtExport.ts): the server
 * returns a fully-styled HTML document with an auto-print trigger; the browser
 * handles page breaks/fonts/PDF. `renderHTML` is added by each form branch once
 * its layout exists (the AHA layouts are pending the official 2025 templates).
 */

export type ReportScope =
  | { kind: 'student'; studentId: string }
  | { kind: 'cohort'; cohortId: string };

export interface ReportTemplate<TData = unknown> {
  /** stable id, e.g. 'aha.megacode' */
  id: string;
  /** human title for the picker */
  title: string;
  /** which course this template documents (null = course-agnostic) */
  certCourse?: 'acls' | 'pals' | null;
  /** pull + shape the data for a scope (read-only) */
  fetch(scope: ReportScope): Promise<TData>;
  /** render the shaped data to a self-contained styled HTML document.
   *  Optional until the form's layout is built (e.g. awaiting official template). */
  renderHTML?(data: TData): string;
}

const registry = new Map<string, ReportTemplate>();

export function registerTemplate(t: ReportTemplate): void {
  registry.set(t.id, t);
}
export function getTemplate(id: string): ReportTemplate | undefined {
  return registry.get(id);
}
export function listTemplates(): Array<{ id: string; title: string; certCourse?: string | null; renderable: boolean }> {
  return [...registry.values()].map((t) => ({
    id: t.id, title: t.title, certCourse: t.certCourse ?? null, renderable: typeof t.renderHTML === 'function',
  }));
}
