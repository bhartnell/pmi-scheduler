import { NextRequest } from 'next/server';
import { withPreinternship } from '@/lib/preinternship-server';

// storage-adapter: saveReview(recordKey, review) / deleteReview(recordKey) — instructor only
export async function PUT(request: NextRequest, { params }: { params: Promise<{ recordKey: string }> }) {
  const { recordKey } = await params;
  const body = await request.json().catch(() => null);
  return withPreinternship((svc, actor) => svc.saveReview(actor, recordKey, body));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ recordKey: string }> }) {
  const { recordKey } = await params;
  return withPreinternship((svc, actor) => svc.deleteReview(actor, recordKey));
}
