import { withPreinternship } from '@/lib/preinternship-server';

// storage-adapter: isInstructor()
export async function GET() {
  return withPreinternship((svc, actor) => svc.isInstructor(actor));
}
