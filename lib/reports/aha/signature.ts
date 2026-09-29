/** Shared AHA sign-off signature helpers (profile UI + server-rendered forms). */

export const AHA_CREDENTIALS = ['AHA Faculty', 'ACLS Instructor', 'PALS Instructor'] as const;

// Face key -> CSS font stack. Stored as the key so the stack can evolve.
export const SIGNATURE_FACES: Record<string, string> = {
  classic: "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive",
  formal: "'Snell Roundhand', 'Apple Chancery', 'Lucida Handwriting', cursive",
  casual: "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive",
};

export function signatureFaceStack(face: string | null | undefined): string {
  return SIGNATURE_FACES[face ?? ''] ?? SIGNATURE_FACES.classic;
}
