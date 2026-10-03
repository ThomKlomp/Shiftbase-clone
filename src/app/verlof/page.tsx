'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { absenceWarnings, balanceOf, daysInclusive, hasPerm } from '@/lib/domain';
import { fmtShort, todayStr } from '@/lib/dates';
import * as api from '@/lib/api';
import type { Absence, ShiftAction } from '@/lib/types';
import { Badge, Banner, Button, Check_, Dialog, Empty, Field, Input, PageHeader, Select, Textarea, useAction } from '@/components/ui';

export default function AbsencePage() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  if (!me) return null;
  const approver = (a: Absence) => { const e = state.employees.find((x) => x.id === a.employeeId)!; return e.teamIds.some((t) => hasPerm(state, me.id, state.teams.find((x) => x.id === t)!.departmentId, 'absence.approve')); };
  const canReview = state.employees.some((e) => e.teamIds.some((t) => hasPerm(state, me.id, state.teams.find((x) => x.id === t)!.departmentId, 'absence.approve')));
  const list = state.absences.filter((a) => (tab === 'mine' ? a.employeeId === me.id : approver(a))).sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || b.start.localeCompare(a.start));
  const nm = (id: string) => { const e = state.employees.find((x) => x.id === id)!; return `${e.firstName} ${e.lastName}`; };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Verlof"><Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden />Verlof aanvragen</Button></PageHeader>
      <section aria-label="Saldo" className="mb-4 flex flex-wrap gap-3">
        {state.balances.map((b) => <div key={b.id} className="rounded-lg border border-border bg-surface px-4 py-2"><div className="text-xs text-text-muted">{b.name}</div><div className="text-lg font-bold">{balanceOf(state, me.id, b.id)} {b.unit === 'hours' ? 'uur' : 'dagen'}</div></div>)}
      </section>
      {canReview && <div role="tablist" aria-label="Weergave" className="mb-3 flex gap-1">{(['mine', 'team'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[36px] rounded-md px-3 ${tab === t ? 'bg-accent text-on-accent' : 'bg-surface'}`}>{t === 'mine' ? 'Mijn verlof' : 'Aanvragen van het team'}</button>)}</div>}
      {list.length === 0 ? <Empty title="Geen verlof" text="Je hebt nog geen verlof aangevraagd." /> : (
        <ul className="flex flex-col gap-2">{list.map((a) => {
          const warns = a.status === 'pending' ? absenceWarnings(state, a) : [];
          return (
            <li key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1"><div className="font-medium">{tab === 'team' ? `${nm(a.employeeId)} · ` : ''}{state.absenceTypes.find((t) => t.id === a.typeId)?.name}</div>
                  <div className="text-xs text-text-muted">{fmtShort(a.start)}{a.end !== a.start && ` t/m ${fmtShort(a.end)}`} · {a.amount} {state.balances[0]?.unit === 'hours' ? 'uur' : 'dagen'}{a.note && ` · ${a.note}`}</div></div>
                <Badge kind={a.status} />
                {tab === 'team' && a.status === 'pending' && <>
                  <Button size="sm" variant="primary" onClick={() => run(() => api.decideAbsence(me.id, a.id, 'approved', false), 'Goedgekeurd')}>Goedkeuren</Button>
                  <Button size="sm" onClick={() => run(() => api.decideAbsence(me.id, a.id, 'declined'), 'Afgewezen')}>Afwijzen</Button></>}
                {(tab === 'team' || a.status === 'pending') && <Button size="sm" variant="ghost" aria-label="Verwijderen" onClick={() => run(() => api.deleteAbsence(me.id, a.id), 'Verwijderd')}><Trash2 size={14} aria-hidden /></Button>}
              </div>
              {tab === 'team' && warns.map((w, i) => <div key={i} className="mt-2"><Banner>{w.text}{w.kind === 'balance' && <Button size="sm" className="ml-2" onClick={() => run(() => api.decideAbsence(me.id, a.id, 'approved', true), 'Goedgekeurd met overschrijven')}>Toch goedkeuren</Button>}</Banner></div>)}
            </li>
          );
        })}</ul>
      )}
      <AbsenceForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function AbsenceForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const today = todayStr();
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [action, setAction] = useState<ShiftAction>('leave');
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  const tid = typeId || state.absenceTypes[0]?.id || '';
  const defAmount = amount || String(daysInclusive(start, end) * 8);
  const draft = { id: '', employeeId: me.id, typeId: tid, start, end, amount: Number(defAmount) || 0 };
  const warns = open ? absenceWarnings(state, draft) : [];
  const hit = state.shifts.filter((s) => s.employeeId === me.id && s.date >= start && s.date <= end).length;
  async function submit() {
    if (end < start) return setErr('De einddatum ligt voor de begindatum');
    if (!(Number(defAmount) > 0)) return setErr('Vul het aantal uren in');
    setErr(null);
    const r = await run(() => api.requestAbsence(me!.id, { employeeId: me!.id, typeId: tid, start, end, partialStart: null, amount: Number(defAmount), note, shiftAction: action }), 'Aanvraag verstuurd');
    if (r) onClose();
  }
  return (
    <Dialog open={open} onClose={onClose} title="Verlof aanvragen" footer={<><Button onClick={onClose}>Annuleren</Button><Button variant="primary" onClick={submit}>Versturen</Button></>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {err && <Banner kind="danger">{err}</Banner>}
        {warns.map((w, i) => <Banner key={i}>{w.text}</Banner>)}
        <Field label="Soort">{(p) => <Select {...p} value={tid} onChange={(e) => setTypeId(e.target.value)}>{state.absenceTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Van">{(p) => <Input {...p} type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />}</Field>
          <Field label="Tot en met">{(p) => <Input {...p} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </div>
        <Field label="Aantal uren" hint="Standaard 8 uur per dag. Pas aan voor halve dagen.">{(p) => <Input {...p} type="number" min={0.5} step={0.5} value={defAmount} onChange={(e) => setAmount(e.target.value)} />}</Field>
        <Field label="Opmerking">{(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {hit > 0 && <Field label={`Je hebt ${hit} dienst${hit > 1 ? 'en' : ''} in deze periode. Wat moet daarmee gebeuren?`}>{(p) => (
          <Select {...p} value={action} onChange={(e) => setAction(e.target.value as ShiftAction)}><option value="leave">Laten staan (planner beslist)</option><option value="remove">Verwijderen</option><option value="make_open">Open dienst maken</option></Select>)}</Field>}
      </form>
    </Dialog>
  );
}
