'use client';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPermAnywhere } from '@/lib/domain';
import { Banner, Empty, PageHeader } from '@/components/ui';

export default function ChangeLog() {
  const state = useStore();
  const { me } = useSession();
  if (!me) return null;
  if (!hasPermAnywhere(state, me.id, 'schedule.edit')) return <Banner kind="danger">Je hebt geen rechten om het logboek te bekijken.</Banner>;
  const name = (id: string) => { const e = state.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : 'Onbekend'; };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Logboek" />
      <p className="mb-3 text-text-muted">Wie heeft wat gewijzigd in het rooster, bij verlof en bij ruilen. De laatste 500 wijzigingen.</p>
      {state.audit.length === 0 ? <Empty title="Nog geen wijzigingen" text="Zodra iemand een dienst toevoegt, wijzigt of verwijdert, staat dat hier." /> : (
        <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {state.audit.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
              <time dateTime={a.at} className="w-36 shrink-0 text-xs text-text-muted">{new Date(a.at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</time>
              <span className="font-medium">{name(a.actorId)}</span>
              <span className="min-w-0 flex-1">{a.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
