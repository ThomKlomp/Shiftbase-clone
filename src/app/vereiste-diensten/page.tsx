'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { coverage, hasPerm } from '@/lib/domain';
import { fmtLong, todayStr } from '@/lib/dates';
import * as api from '@/lib/api';
import { Banner, Button, Empty, Field, Input, PageHeader, Select, useAction } from '@/components/ui';

export default function Required() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const depts = me ? state.departments.filter((d) => hasPerm(state, me.id, d.id, 'schedule.edit')) : [];
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('16:00');
  const [mode, setMode] = useState<'min' | 'max' | 'exact'>('min');
  const [count, setCount] = useState(2);
  if (!me) return null;
  if (depts.length === 0) return <Banner kind="danger">Je hebt geen rechten om de bezetting in te stellen.</Banner>;
  const teams = state.teams.filter((t) => depts.some((d) => d.id === t.departmentId));
  const tid = teamId || teams[0]?.id || '';
  const team = state.teams.find((t) => t.id === tid);
  const rows = state.requiredShifts.filter((r) => depts.some((d) => d.id === r.departmentId)).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Bezetting" />
      <p className="mb-3 text-text-muted">Geef aan hoeveel mensen je per team nodig hebt. In het rooster zie je direct waar nog een tekort is.</p>
      <form className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); if (team) run(() => api.upsertRequiredShift(me.id, { departmentId: team.departmentId, teamId: tid, date, start, end, mode, count }), 'Bezetting toegevoegd'); }}>
        <Field label="Team">{(p) => <Select {...p} value={tid} onChange={(e) => setTeamId(e.target.value)}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <Field label="Datum">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Van">{(p) => <Input {...p} type="time" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="Tot">{(p) => <Input {...p} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Field label="Aantal">{(p) => <div className="flex gap-1"><Select {...p} value={mode} onChange={(e) => setMode(e.target.value as 'min')} className="w-24"><option value="min">Min.</option><option value="exact">Precies</option><option value="max">Max.</option></Select><Input aria-label="Aantal mensen" type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} className="w-16" /></div>}</Field>
        <div className="flex items-end"><Button variant="primary" type="submit">Toevoegen</Button></div>
      </form>
      {rows.length === 0 ? <Empty title="Nog geen bezetting ingesteld" /> : (
        <div className="relative overflow-x-auto"><table className="w-full min-w-[560px] text-left"><caption className="sr-only">Ingestelde bezetting</caption>
          <thead><tr className="border-b border-border"><th scope="col" className="p-2">Datum</th><th scope="col" className="p-2">Team</th><th scope="col" className="p-2">Tijd</th><th scope="col" className="p-2">Nodig</th><th scope="col" className="p-2">Ingepland</th><th scope="col" className="p-2"><span className="sr-only">Acties</span></th></tr></thead>
          <tbody>{rows.map((r) => { const c = coverage(state, r.departmentId, r.teamId, r.date); return (
            <tr key={r.id} className="border-b border-border"><td className="p-2">{fmtLong(r.date)}</td><td className="p-2">{state.teams.find((t) => t.id === r.teamId)?.name}</td><td className="p-2">{r.start}–{r.end}</td>
              <td className="p-2">{{ min: 'min.', max: 'max.', exact: '' }[r.mode]} {r.count}</td><td className="p-2">{c.scheduled}{c.state === 'under' && <span className="ml-2 text-warning">tekort</span>}</td>
              <td className="p-2"><Button size="sm" variant="ghost" aria-label="Verwijderen" onClick={() => run(() => api.deleteRequiredShift(me.id, r.id))}><Trash2 size={14} aria-hidden /></Button></td></tr>); })}</tbody></table></div>
      )}
    </div>
  );
}
