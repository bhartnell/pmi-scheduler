import { NextRequest } from 'next/server';
import { withPreinternship } from '@/lib/preinternship-server';

// storage-adapter: deleteResponse(id) — instructor only, soft delete
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withPreinternship((svc, actor) => svc.deleteResponse(actor, id));
}
