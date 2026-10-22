'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@/components/Toast';
import QueryProvider from '@/components/QueryProvider';
import SessionTimeoutProvider from '@/components/SessionTimeoutProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <SessionTimeoutProvider />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
