'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { balanceOf, hasPerm } from '@/lib/domain';
import * as api from '@/lib/api';
import { Badge, Button, Empty, Field, Input, PageHeader, useAction } from '@/components/ui';
import { fmtShort } from '@/lib/dates';

export default function EmployeeProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const e = state.employees.find((x) => x.id === id);
  if (!me) return null;
  if (!e) return <Empty title="Medewerker niet gevonden" action={<Link href="/medewerkers" className="underline">Terug naar de lijst</Link>} />;
  const ok = e.teamIds.some((t) => hasPerm(state, me.id, state.teams.find((x) => x.id === t)!.departmentId, 'absence.approve') || hasPerm(state, me.id, state.teams.find((x) => x.id === t)!.departmentId, 'employees.manage'));
  if (!ok && me.id !== e.id) return <Empty title="Geen toegang" text="Je hebt geen rechten om dit profiel te bekijken." />;
  const abs = state.absences.filter((a) => a.employeeId === e.id);
  return (
    <div className="max-w-2xl">
      <PageHeader title={`${e.firstName} ${e.lastName}`}><Link href="/medewerkers" className="underline">Alle medewerkers</Link></PageHeader>
      <dl className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
        <dt className="text-text-muted">E-mail</dt><dd>{e.email}</dd>
        <dt className="text-text-muted">Teams</dt><dd>{e.teamIds.map((t) => state.teams.find((x) => x.id === t)?.name).join(', ')}</dd>
        <dt className="text-text-muted">Contracturen</dt><dd>{e.hoursPerWeek} per week</dd>
        <dt className="text-text-muted">Status</dt><dd>{e.active ? 'Actief' : 'Inactief'}</dd>
      </dl>
      <h2 className="mb-2 text-lg font-semibold">Verlofsaldo</h2>
      {state.balances.map((b) => (
        <div key={b.id} className="mb-4">
          <p className="mb-2 font-medium">{b.name}: {balanceOf(state, e.id, b.id)} {b.unit === 'hours' ? 'uur' : 'dagen'}</p>
          <ul className="mb-2 text-xs text-text-muted">{state.balanceEntries.filter((x) => x.employeeId === e.id && x.balanceId === b.id).map((x) => <li key={x.id}>{fmtShort(x.date)} · {x.amount > 0 ? '+' : ''}{x.amount} · {x.note || x.kind}</li>)}</ul>
          {hasPerm(state, me.id, state.teams.find((t) => t.id === e.teamIds[0])!.departmentId, 'absence.approve') && (
            <form className="flex flex-wrap items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); const n = Number(amount); if (!n) return; run(() => api.correctBalance(me.id, e.id, b.id, n, note || 'Correctie'), 'Saldo gecorrigeerd'); setAmount(''); setNote(''); }}>
              <Field label="Correctie (+/−)">{(p) => <Input {...p} type="number" step="0.5" value={amount} onChange={(x) => setAmount(x.target.value)} className="w-28" />}</Field>
              <Field label="Reden">{(p) => <Input {...p} value={note} onChange={(x) => setNote(x.target.value)} />}</Field>
              <Button type="submit">Corrigeren</Button>
            </form>)}
        </div>))}
      <h2 className="mb-2 text-lg font-semibold">Verlof</h2>
      {abs.length === 0 ? <p className="text-text-muted">Nog geen verlof.</p> : <ul className="flex flex-col gap-1">{abs.map((a) => <li key={a.id} className="flex items-center gap-2">{fmtShort(a.start)} – {fmtShort(a.end)} <Badge kind={a.status} /></li>)}</ul>}
    </div>
  );
}
