'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Bell, CalendarDays, CalendarOff, Clock, Home, LogOut, Repeat, Settings, Users, Hand, Target, CalendarClock } from 'lucide-react';
import { useSession } from '@/lib/session';
import { useStore } from '@/lib/store';
import { hasPermAnywhere } from '@/lib/domain';
import type { Perm } from '@/lib/types';
import { Avatar, cx } from './ui';

interface NavItem { href: string; label: string; icon: typeof Home; perm?: Perm; mobile?: boolean }
const NAV: NavItem[] = [
  { href: '/rooster', label: 'Rooster', icon: CalendarDays, perm: 'schedule.edit' },
  { href: '/mijn-rooster', label: 'Mijn rooster', icon: CalendarClock, mobile: true },
  { href: '/open-diensten', label: 'Open diensten', icon: Hand, mobile: true },
  { href: '/ruilen', label: 'Ruilen', icon: Repeat },
  { href: '/beschikbaarheid', label: 'Beschikbaarheid', icon: Clock, mobile: true },
  { href: '/verlof', label: 'Verlof', icon: CalendarOff, mobile: true },
  { href: '/vereiste-diensten', label: 'Bezetting', icon: Target, perm: 'schedule.edit' },
  { href: '/tijdregistratie', label: 'Tijdregistratie', icon: Clock },
  { href: '/medewerkers', label: 'Medewerkers', icon: Users, perm: 'employees.manage' },
  { href: '/instellingen', label: 'Instellingen', icon: Settings, perm: 'settings.manage' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { me, ready, signOut } = useSession();
  const state = useStore();
  const path = usePathname();
  const router = useRouter();
  const onLogin = path === '/login';

  useEffect(() => { if (ready && !me && !onLogin) router.replace('/login'); }, [ready, me, onLogin, router]);

  if (onLogin) return <>{children}</>;
  if (!ready || !me) {
    return <div className="p-6" aria-busy="true" aria-label="Laden"><div className="skeleton mb-3 h-8 w-48" /><div className="skeleton h-64 w-full" /></div>;
  }

  const items = NAV.filter((n) => !n.perm || hasPermAnywhere(state, me.id, n.perm));
  const unread = state.notifications.filter((n) => n.employeeId === me.id && !n.readAt).length;
  const name = `${me.firstName} ${me.lastName}`;
  const link = (n: NavItem, mobile = false) => {
    const active = path === n.href || path.startsWith(n.href + '/');
    return (
      <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
        className={cx(mobile ? 'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs' : 'flex min-h-[40px] items-center gap-2 rounded-md px-3 text-sm',
          active ? 'bg-accent-soft font-semibold text-accent' : 'text-text hover:bg-surface-sunken')}>
        <n.icon size={mobile ? 20 : 16} aria-hidden />{n.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen md:grid md:grid-cols-[var(--layout-sidebar)_1fr]">
      <a href="#inhoud" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-bg focus:px-3 focus:py-2">Naar inhoud</a>
      <aside className="hidden border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex h-[var(--layout-header)] items-center px-4 text-lg font-bold">Rooster</div>
        <nav aria-label="Hoofdmenu" className="flex flex-1 flex-col gap-1 px-2">{items.map((n) => link(n))}</nav>
      </aside>
      <div className="flex min-w-0 flex-col pb-16 md:pb-0">
        <header className="flex h-[var(--layout-header)] items-center justify-between gap-2 border-b border-border px-4">
          <span className="font-bold md:hidden">Rooster</span>
          <span className="hidden text-text-muted md:inline">{state.orgName}</span>
          <div className="flex items-center gap-2">
            <Link href="/meldingen" aria-label={unread ? `Meldingen, ${unread} ongelezen` : 'Meldingen'} className="relative rounded-md p-2 hover:bg-surface-sunken">
              <Bell size={18} aria-hidden />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-[16px] rounded-pill bg-danger px-1 text-center text-[10px] font-bold text-on-accent">{unread}</span>}
            </Link>
            <Avatar name={name} />
            <span className="hidden text-sm sm:inline">{name}</span>
            <button onClick={() => { signOut(); router.replace('/login'); }} aria-label="Uitloggen" className="rounded-md p-2 hover:bg-surface-sunken"><LogOut size={18} aria-hidden /></button>
          </div>
        </header>
        <main id="inhoud" className="mx-auto w-full max-w-[var(--layout-content-max)] flex-1 p-4">{children}</main>
      </div>
      <nav aria-label="Snelmenu" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg md:hidden">
        {items.filter((n) => n.mobile).map((n) => link(n, true))}
        <Link href="/meer" className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs"><Home size={20} aria-hidden />Meer</Link>
      </nav>
    </div>
  );
}
