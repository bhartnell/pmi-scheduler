/** Shared AHA sign-off signature helpers (profile UI + server-rendered forms). */

export const AHA_CREDENTIALS = ['AHA Faculty', 'ACLS Instructor', 'PALS Instructor'] as const;

// Face key -> CSS font stack. Stored as the key so the stack can evolve.
export const SIGNATURE_FACES: Record<string, string> = {
  // Embedded Dancing Script (OFL) — same on every machine; @font-face is injected by the form renderers (server) and the profile page (public/fonts).
  script: "'PMI Script', 'Brush Script MT', 'Segoe Script', cursive",
};

// Legacy keys saved before the embedded face existed; they render as 'script' too.
export const LEGACY_SIGNATURE_FACES = ['classic', 'formal', 'casual'] as const;

export function signatureFaceStack(face: string | null | undefined): string {
  return SIGNATURE_FACES[face ?? ''] ?? SIGNATURE_FACES.script;
}
