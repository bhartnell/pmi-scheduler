'use client';

/**
 * Suite1Layout — alternate seating-chart layout for the "Suite 1"
 * classroom preset. Two sections per row with an aisle between, and
 * variable seat counts per row per side:
 *
 *   Row 5: [_][_]  |  (no right)
 *   Row 4: [_][_]  |  [_][_][_][_]
 *   Row 3: [_][_]  |  [_][_][_][_]
 *   Row 2: [_][_][_][_]  |  [_][_][_][_]
 *   Row 1: [_][_][_][_]  |  [_][_][_][_]
 *            FRONT (instructor)
 *
 * Seat encoding into seat_assignments stays compatible with the
 * existing schema — no new columns. We synthesize table_number as
 * `row*10 + side` (1 = left, 2 = right) and seat_position is 1..N
 * within that section's row. The auto-generator can be taught to
 * emit the same encoding without further schema changes.
 *
 * Used by both /labs/seating/charts/[id] and
 * /lab-management/seating/charts/[id] so the rendering stays in
 * sync across the two builder surfaces.
 */

import type { CSSProperties } from 'react';

// ── Types ────────────────────────────────────────────────────────
export interface SuiteStudent {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  // The builder pages' Student type carries an `agency` field; we
  // require it here so handlers typed against the broader Student
  // can be passed in directly (contravariance of function params).
  // The component itself doesn't render agency — it's purely a type
  // bridge with the call sites.
  agency: string | null;
}

export interface SuiteLearningStyle {
  primary_style?: string | null;
  social_style?: string | null;
}

export interface SuiteRowConfig {
  row: number;          // 1 = front
  zone: string;         // "Front (Audio)", "Middle (Visual)", "Back (Kinesthetic)"
  left: number;         // seat count in the left section
  right: number;        // seat count in the right section (0 = no section that row)
}

export interface Suite1LayoutProps {
  rows: SuiteRowConfig[];
  isFlipped: boolean;
  styleBadges: Record<string, { bg: string; text: string; label: string }>;

  getStudentAtSeat: (
    tableNumber: number,
    seatPosition: number,
    isOverflow?: boolean,
  ) => SuiteStudent | null;
  // Returning undefined from `.find` is common; accept it alongside
  // null so callers can hand back the raw lookup result.
  getLearningStyle: (studentId: string) => SuiteLearningStyle | null | undefined;
  getConflicts: (studentId: string, tableNumber: number) => string[];

  // Drag handlers — same signatures as the default layout uses.
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (table: number, seat: number, row: number, isOverflow?: boolean) => void;
  onDragStart: (student: SuiteStudent, src: { table: number; seat: number }) => void;
  onContextMenu: (e: React.MouseEvent, student: SuiteStudent) => void;
}

// ── Seat encoding helper ─────────────────────────────────────────
// Stable, reversible mapping from (row, side, seatIndex) → integer
// table_number / seat_position so existing seat_assignments rows can
// store Suite 1 placements without a schema change.
//
// table_number = row * 10 + side, where side: 1 = left, 2 = right.
// seat_position = the 1-based seat index within that section's row.
//
// Examples:
//   row 1 left, seat 3  → table 11, seat 3
//   row 3 right, seat 4 → table 32, seat 4
//
// Aisle gaps are not encoded — the absence of a seat between left and
// right is purely visual.
export function suite1TableNumber(row: number, side: 'left' | 'right'): number {
  return row * 10 + (side === 'left' ? 1 : 2);
}

// ── Component ────────────────────────────────────────────────────
export default function Suite1Layout(props: Suite1LayoutProps) {
  const {
    rows, isFlipped, styleBadges,
    getStudentAtSeat, getLearningStyle, getConflicts,
    onDragOver, onDrop, onDragStart, onContextMenu,
  } = props;

  // Instructor view (default): row 1 is at the bottom (closest to the
  // FRONT label). The list comes in row-1-first; reverse for the
  // default (un-flipped) view, keep natural order when flipped (front
  // at bottom = row 1 last).
  const orderedRows = isFlipped ? [...rows] : [...rows].reverse();

  return (
    <div className="space-y-4">
      {orderedRows.map(row => (
        <Suite1Row
          key={row.row}
          row={row}
          isFlipped={isFlipped}
          styleBadges={styleBadges}
          getStudentAtSeat={getStudentAtSeat}
          getLearningStyle={getLearningStyle}
          getConflicts={getConflicts}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragStart={onDragStart}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────
function Suite1Row({
  row,
  isFlipped,
  styleBadges,
  getStudentAtSeat,
  getLearningStyle,
  getConflicts,
  onDragOver,
  onDrop,
  onDragStart,
  onContextMenu,
}: {
  row: SuiteRowConfig;
} & Omit<Suite1LayoutProps, 'rows'>) {
  const leftTable = suite1TableNumber(row.row, 'left');
  const rightTable = suite1TableNumber(row.row, 'right');

  // Mirror within each row when in instructor view — same flip rule
  // the default layout uses so the seat closest to the operator's
  // left really is on the left when standing at the front.
  const leftIndices = isFlipped
    ? Array.from({ length: row.left }, (_, i) => i + 1)
    : Array.from({ length: row.left }, (_, i) => row.left - i);
  const rightIndices = isFlipped
    ? Array.from({ length: row.right }, (_, i) => i + 1)
    : Array.from({ length: row.right }, (_, i) => row.right - i);

  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 print:text-gray-600">
        Row {row.row} - {row.zone}
      </div>
      <div className="flex items-stretch justify-center gap-0">
        {/* Left section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 print:shadow-none print:border">
          <div className="text-xs text-gray-400 text-center mb-2">Left</div>
          <div className="flex gap-2">
            {leftIndices.map(seat => (
              <SuiteSeatCell
                key={`l-${seat}`}
                table={leftTable}
                seat={seat}
                row={row.row}
                styleBadges={styleBadges}
                getStudentAtSeat={getStudentAtSeat}
                getLearningStyle={getLearningStyle}
                getConflicts={getConflicts}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragStart={onDragStart}
                onContextMenu={onContextMenu}
              />
            ))}
            {row.left === 0 && (
              <div className="text-xs text-gray-400 italic px-4 py-8">— no seats —</div>
            )}
          </div>
        </div>

        {/* Aisle */}
        <div
          className="flex items-center justify-center text-[10px] uppercase tracking-widest text-gray-300 dark:text-gray-600"
          style={aisleStyle}
        >
          aisle
        </div>

        {/* Right section */}
        {row.right > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 print:shadow-none print:border">
            <div className="text-xs text-gray-400 text-center mb-2">Right</div>
            <div className="flex gap-2">
              {rightIndices.map(seat => (
                <SuiteSeatCell
                  key={`r-${seat}`}
                  table={rightTable}
                  seat={seat}
                  row={row.row}
                  styleBadges={styleBadges}
                  getStudentAtSeat={getStudentAtSeat}
                  getLearningStyle={getLearningStyle}
                  getConflicts={getConflicts}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragStart={onDragStart}
                  onContextMenu={onContextMenu}
                />
              ))}
            </div>
          </div>
        ) : (
          // Render a same-size empty placeholder so the left column
          // doesn't shift left when a row drops its right section.
          // Width matches the typical 4-seat row's expected width.
          <div className="invisible" aria-hidden="true">
            <div className="p-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-24 h-36" />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const aisleStyle: CSSProperties = {
  width: '2rem',
  borderLeft: '2px dashed #e5e7eb',
  borderRight: '2px dashed #e5e7eb',
  margin: '0 0.5rem',
  writingMode: 'vertical-rl',
};

// ── Single seat ──────────────────────────────────────────────────
function SuiteSeatCell({
  table,
  seat,
  row,
  styleBadges,
  getStudentAtSeat,
  getLearningStyle,
  getConflicts,
  onDragOver,
  onDrop,
  onDragStart,
  onContextMenu,
}: {
  table: number;
  seat: number;
  row: number;
} & Omit<Suite1LayoutProps, 'rows' | 'isFlipped'>) {
  const student = getStudentAtSeat(table, seat);
  const ls = student ? getLearningStyle(student.id) : null;
  const conflicts = student ? getConflicts(student.id, table) : [];

  return (
    <div
      onDragOver={onDragOver}
      onDrop={() => onDrop(table, seat, row, false)}
      className={`w-24 h-36 print:h-auto rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-colors ${
        student
          ? 'border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
      } ${conflicts.length > 0 ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30' : ''}`}
    >
      {student ? (
        <div
          draggable
          onDragStart={() => onDragStart(student, { table, seat })}
          onContextMenu={e => onContextMenu(e, student)}
          className="w-full h-full flex flex-col items-center justify-center cursor-move"
        >
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mb-1 flex-shrink-0">
            {student.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs font-medium">
                {student.first_name[0]}{student.last_name[0]}
              </div>
            )}
          </div>
          <div className="text-xs print:text-sm font-medium text-gray-900 dark:text-white print:text-black text-center truncate print:whitespace-normal w-full">
            {student.first_name}
          </div>
          <div className="text-xs print:text-sm text-gray-500 dark:text-gray-400 print:text-black text-center truncate print:whitespace-normal w-full">
            {student.last_name}
          </div>
          <div className="flex gap-0.5 mt-1 print:hidden">
            {ls?.primary_style && styleBadges[ls.primary_style] && (
              <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${styleBadges[ls.primary_style].bg} ${styleBadges[ls.primary_style].text}`}>
                {styleBadges[ls.primary_style].label}
              </span>
            )}
            {ls?.social_style && styleBadges[ls.social_style] && (
              <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${styleBadges[ls.social_style].bg} ${styleBadges[ls.social_style].text}`}>
                {styleBadges[ls.social_style].label}
              </span>
            )}
            {conflicts.length > 0 && (
              <span className="w-4 h-4 rounded bg-red-500 text-white text-xs flex items-center justify-center" title={conflicts.join(', ')}>
                !
              </span>
            )}
          </div>
        </div>
      ) : (
        <span className="text-xs text-gray-400">Empty</span>
      )}
    </div>
  );
}
