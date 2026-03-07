'use client';

import React from 'react';
import SchedulerCreate from './SchedulerCreate';
import SchedulerParticipant from './SchedulerParticipant';
import SchedulerAdmin from './SchedulerAdmin';
import type { SchedulerProps } from './types';

export default function Scheduler({ mode, pollData, onComplete }: SchedulerProps) {
  switch (mode) {
    case 'create':
      return <SchedulerCreate pollData={pollData} onComplete={onComplete} />;
    case 'participant':
      return <SchedulerParticipant pollData={pollData} onComplete={onComplete} />;
    case 'admin-view':
      return <SchedulerAdmin pollData={pollData} onComplete={onComplete} />;
    default:
      return null;
  }
}
