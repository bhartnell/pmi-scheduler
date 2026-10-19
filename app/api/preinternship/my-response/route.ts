import { NextRequest } from 'next/server';
import { withPreinternship } from '@/lib/preinternship-server';

// storage-adapter: getMyResponse() / saveMyResponse(response). Always the signed-in student's own row.
export async function GET() {
  return withPreinternship((svc, actor) => svc.getMyStatus(actor));
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return withPreinternship((svc, actor) => svc.saveMyResponse(actor, body));
}
