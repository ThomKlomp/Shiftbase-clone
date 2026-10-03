'use client';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from './ui';
import { AppShell } from './shell';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider>
        <AppShell>{children}</AppShell>
      </SessionProvider>
    </ToastProvider>
  );
}
