'use client';

import SectionLanding from '@/components/landing/SectionLanding';
import { ADMIN_LANDING } from '@/components/landing/landings';

export default function Page() {
  return <SectionLanding landing={ADMIN_LANDING} />;
}
