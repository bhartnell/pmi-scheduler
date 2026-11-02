/**
 * Shared reader for hub attendance. The PALS/ACLS hub board records absence per lab day
 * (PUT /api/lab-management/lab-days/{id}/attendance, status 'absent'); other views read it here
 * so a student marked absent on the board shows struck through everywhere (read-only).
 *
 * Same rule as components/aha/CertBoard.tsx: absent on ANY of the given lab days counts as absent.
 * Failures resolve to "nobody absent" so a read error never hides or blocks a student.
 */
export async function fetchAbsentStudentIds(labDayIds: Array<string | null | undefined>): Promise<Set<string>> {
  const ids = Array.from(new Set(labDayIds.filter((x): x is string => !!x)));
  const absent = new Set<string>();
  await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch(`/api/lab-management/lab-days/${id}/attendance`);
      if (!r.ok) return;
      const j: { students?: { student_id: string; status: string | null }[] } = await r.json();
      for (const s of j.students || []) if (s.status === 'absent') absent.add(s.student_id);
    } catch { /* non-blocking */ }
  }));
  return absent;
}

/** Strike-through classes shared by the views. */
export const ABSENT_NAME_CLASS = 'line-through decoration-2 opacity-60';
