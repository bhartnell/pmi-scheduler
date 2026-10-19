import { NextRequest } from 'next/server';
import { withPreinternship } from '@/lib/preinternship-server';

// Instructor only: the response with reflections r1/r2 removed, plus its review.
// Anything built for an agency must start from this, never from the raw response.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withPreinternship((svc, actor) => svc.getAgencyView(actor, id));
}
