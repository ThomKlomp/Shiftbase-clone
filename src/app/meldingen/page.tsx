'use client';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import * as api from '@/lib/api';
import { Button, Empty, PageHeader, useAction } from '@/components/ui';

export default function Notifications() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  if (!me) return null;
  const mine = state.notifications.filter((n) => n.employeeId === me.id);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Meldingen">{mine.some((n) => !n.readAt) && <Button size="sm" onClick={() => run(() => api.markNotificationsRead(me.id))}>Alles als gelezen markeren</Button>}</PageHeader>
      {mine.length === 0 ? <Empty title="Geen meldingen" text="Hier verschijnt nieuws over je rooster, ruilen en verlof." /> : (
        <ul className="flex flex-col gap-1">{mine.map((n) => (
          <li key={n.id}><Link href={n.href} className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-surface-sunken">
            {!n.readAt && <span aria-label="Ongelezen" className="h-2 w-2 shrink-0 rounded-pill bg-accent" />}
            <span className={n.readAt ? '' : 'font-semibold'}>{n.text}</span>
            <span className="ml-auto text-xs text-text-muted">{new Date(n.createdAt).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</span></Link></li>))}</ul>
      )}
    </div>
  );
}
