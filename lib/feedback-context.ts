'use client';

import { useEffect } from 'react';

// Lets a scenario-showing component tell the global feedback button which
// scenario is on screen, so a 'Scenario' report carries its id and title.
// Module-level on purpose: FeedbackButton lives in the layout, far from the page.

export interface FeedbackScenario {
  id: string;
  title: string;
}

let current: FeedbackScenario | null = null;

export function getFeedbackScenario(): FeedbackScenario | null {
  return current;
}

export function useFeedbackScenario(id?: string | null, title?: string | null) {
  useEffect(() => {
    if (!id) return;
    const mine: FeedbackScenario = { id, title: title || '' };
    current = mine;
    return () => {
      if (current === mine) current = null;
    };
  }, [id, title]);
}
