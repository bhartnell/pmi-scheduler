import { NextRequest } from 'next/server';
import { withPreinternship } from '@/lib/preinternship-server';

// Instructor only: re-open a reviewed (locked) response for the student to edit.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withPreinternship((svc, actor) => svc.unlockResponse(actor, id));
}
