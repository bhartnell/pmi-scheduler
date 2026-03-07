'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@/components/Toast';
import { RolePreviewProvider } from '@/components/RolePreviewProvider';
import QueryProvider from '@/components/QueryProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <RolePreviewProvider>
              {children}
            </RolePreviewProvider>
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
