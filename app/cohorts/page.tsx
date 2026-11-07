'use client';

import SectionLanding from '@/components/landing/SectionLanding';
import { COHORTS_LANDING } from '@/components/landing/landings';

export default function Page() {
  return <SectionLanding landing={COHORTS_LANDING} />;
}
