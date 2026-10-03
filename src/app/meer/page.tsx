'use client';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPermAnywhere } from '@/lib/domain';
import { PageHeader } from '@/components/ui';

export default function More() {
  const state = useStore();
  const { me } = useSession();
  if (!me) return null;
  const links = [['/ruilen', 'Ruilverzoeken'], ['/tijdregistratie', 'Tijdregistratie'], ['/meldingen', 'Meldingen'],
    ...(hasPermAnywhere(state, me.id, 'schedule.edit') ? [['/rooster', 'Rooster'], ['/vereiste-diensten', 'Bezetting']] : []),
    ...(hasPermAnywhere(state, me.id, 'employees.manage') ? [['/medewerkers', 'Medewerkers']] : []),
    ...(hasPermAnywhere(state, me.id, 'settings.manage') ? [['/instellingen', 'Instellingen']] : [])];
  return <div><PageHeader title="Meer" /><ul className="flex flex-col gap-2">{links.map(([h, l]) => <li key={h}><Link href={h} className="flex min-h-[48px] items-center rounded-md border border-border px-3 hover:bg-surface-sunken">{l}</Link></li>)}</ul></div>;
}
