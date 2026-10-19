import { withPreinternship } from '@/lib/preinternship-server';

// storage-adapter: listResponses() — instructor only
export async function GET() {
  return withPreinternship((svc, actor) => svc.listResponses(actor));
}
