'use client';
import Link from 'next/link';
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPerm, hasPermAnywhere } from '@/lib/domain';
import * as api from '@/lib/api';
import { Avatar, Banner, Button, Dialog, Empty, Field, Input, PageHeader, Select, useAction } from '@/components/ui';

export default function Employees() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  if (!me) return null;
  if (!hasPermAnywhere(state, me.id, 'employees.manage')) return <Banner kind="danger">Je hebt geen rechten om medewerkers te beheren.</Banner>;
  const managed = state.employees.filter((e) => e.teamIds.some((t) => hasPerm(state, me.id, state.teams.find((x) => x.id === t)!.departmentId, 'employees.manage')));
  const rows = managed.filter((e) => (showInactive || e.active) && `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Medewerkers"><Button variant="primary" onClick={() => setOpen(true)}><UserPlus size={16} aria-hidden />Medewerker toevoegen</Button></PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input aria-label="Zoeken" placeholder="Zoek op naam of e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Toon inactieve</label>
      </div>
      {rows.length === 0 ? <Empty title={q ? 'Niemand gevonden' : 'Nog geen medewerkers'} /> : (
        <div className="relative overflow-x-auto rounded-lg border border-border"><table className="w-full text-left"><caption className="sr-only">Medewerkers</caption>
          <thead className="bg-surface"><tr><th scope="col" className="p-2">Naam</th><th scope="col" className="p-2">Team</th><th scope="col" className="p-2">Rol</th><th scope="col" className="p-2">Uren/week</th><th scope="col" className="p-2"><span className="sr-only">Acties</span></th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id} className="border-t border-border">
              <td className="p-2"><Link className="flex items-center gap-2 font-medium hover:underline" href={`/medewerkers/${e.id}`}><Avatar name={`${e.firstName} ${e.lastName}`} size={28} /><span className="min-w-0"><span className="block truncate">{e.firstName} {e.lastName}</span><span className="block text-xs font-normal text-text-muted">{e.email}</span></span></Link></td>
              <td className="p-2">{e.teamIds.map((t) => state.teams.find((x) => x.id === t)?.name).join(', ')}</td>
              <td className="p-2">{state.groups.find((g) => g.id === Object.values(e.groupByDept)[0])?.name}</td>
              <td className="p-2">{e.hoursPerWeek}</td>
              <td className="p-2 text-right"><Button size="sm" variant="ghost" disabled={e.id === me.id} onClick={() => run(() => api.setEmployeeActive(me.id, e.id, !e.active), e.active ? 'Gedeactiveerd' : 'Geactiveerd')}>{e.active ? 'Deactiveren' : 'Activeren'}</Button></td>
            </tr>))}</tbody></table></div>
      )}
      <AddEmployee open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function AddEmployee({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', teamId: '', groupId: 'g-employee', hours: 32 });
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  const teams = state.teams.filter((t) => hasPerm(state, me.id, t.departmentId, 'employees.manage'));
  async function submit() {
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr('Vul voor- en achternaam in');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Vul een geldig e-mailadres in');
    setErr(null);
    const r = await run(() => api.addEmployee(me!.id, { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), teamIds: [f.teamId || teams[0].id], groupId: f.groupId, hoursPerWeek: f.hours }), 'Medewerker toegevoegd');
    if (r) { setF({ firstName: '', lastName: '', email: '', teamId: '', groupId: 'g-employee', hours: 32 }); onClose(); }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Medewerker toevoegen" footer={<><Button onClick={onClose}>Annuleren</Button><Button variant="primary" onClick={submit}>Toevoegen</Button></>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {err && <Banner kind="danger">{err}</Banner>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Voornaam">{(p) => <Input {...p} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />}</Field>
          <Field label="Achternaam">{(p) => <Input {...p} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />}</Field>
        </div>
        <Field label="E-mailadres" hint="Hier sturen we de uitnodiging naartoe.">{(p) => <Input {...p} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Team">{(p) => <Select {...p} value={f.teamId || teams[0]?.id} onChange={(e) => setF({ ...f, teamId: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <Field label="Rol">{(p) => <Select {...p} value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}>{state.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</Field>
        <Field label="Contracturen per week">{(p) => <Input {...p} type="number" min={0} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} />}</Field>
      </form>
    </Dialog>
  );
}
