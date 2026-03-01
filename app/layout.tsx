import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import FeedbackButton from '@/components/FeedbackButton';
import GlobalTimerBanner from '@/components/GlobalTimerBanner';
import CommandPalette from '@/components/CommandPalette';
import QuickActionsMenu from '@/components/QuickActionsMenu';
import { ActivityTracker } from '@/components/ActivityTracker';
import OnboardingTourWrapper from '@/components/OnboardingTourWrapper';
import { OfflineProvider } from '@/components/OfflineProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import WhatsNewWrapper from '@/components/WhatsNewWrapper';
import AppBanner from '@/components/AppBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PMI EMS Scheduler',
  description: 'Scheduling tool for PMI Paramedic Program internships and group sessions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PMI Scheduler" />
      </head>
      <body className={inter.className}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:outline-none">
          Skip to content
        </a>
        <Providers>
          <OfflineProvider>
            <AppBanner />
            <GlobalTimerBanner />
            {children}
            <ActivityTracker />
            <OnboardingTourWrapper />
            <WhatsNewWrapper />
            <FeedbackButton />
            <QuickActionsMenu />
            <CommandPalette />
            <ServiceWorkerRegistration />
          </OfflineProvider>
        </Providers>
      </body>
    </html>
  );
}
