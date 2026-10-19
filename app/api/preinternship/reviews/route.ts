import { withPreinternship } from '@/lib/preinternship-server';

// storage-adapter: listReviews() — instructor only
export async function GET() {
  return withPreinternship((svc, actor) => svc.listReviews(actor));
}
