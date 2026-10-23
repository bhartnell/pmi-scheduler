import { NextRequest } from 'next/server';
import { withPreinternshipAsStudent } from '@/lib/preinternship-server';

// storage-adapter: getMyResponse() / saveMyResponse(response). The caller's own
// row — the signed-in student, or (view-as) the picked student.
export async function GET(request: NextRequest) {
  return withPreinternshipAsStudent(request, (svc, actor) => svc.getMyStatus(actor));
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return withPreinternshipAsStudent(request, (svc, actor) => svc.saveMyResponse(actor, body));
}
