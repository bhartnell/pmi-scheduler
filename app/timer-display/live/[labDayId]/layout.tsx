import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Timer Display - PMI EMS Scheduler',
  description: 'Full-screen lab timer display for tablets and projectors',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black',
    'apple-mobile-web-app-title': 'PMI Timer',
    'theme-color': '#000000',
  },
};

export default function LiveTimerDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      {children}
    </div>
  );
}
