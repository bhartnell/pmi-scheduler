import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import FeedbackButton from '@/components/FeedbackButton';
import GlobalTimerBanner from '@/components/GlobalTimerBanner';

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
      <body className={inter.className}>
        <Providers>
          <GlobalTimerBanner />
          {children}
          <FeedbackButton />
        </Providers>
      </body>
    </html>
  );
}