'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import * as api from '@/lib/api';
import type { ShiftType } from '@/lib/types';
import { hasPermAnywhere } from '@/lib/domain';
import { Banner, Button, Check_, Dialog, Field, Input, PageHeader, Select, useAction, useTry } from '@/components/ui';
import { shiftColour } from '@/components/schedule/ShiftCard';

type Tab = 'structuur' | 'diensttypes' | 'verlof' | 'rechten';
const TABS: [Tab, string][] = [['structuur', 'Structuur'], ['diensttypes', 'Dienstsjablonen'], ['verlof', 'Verlof'], ['rechten', 'Rechten']];
const PERM_LABEL: Record<string, string> = { 'schedule.edit': 'Rooster bewerken', 'schedule.publish': 'Rooster publiceren', 'absence.approve': 'Verlof beoordelen', 'exchange.approve': 'Ruilen goedkeuren', 'exchange.approve_incoming': 'Inkomende ruil zelf goedkeuren', 'availability.edit_others': 'Beschikbaarheid van anderen wijzigen', 'timesheet.approve': 'Uren goedkeuren', 'employees.manage': 'Medewerkers beheren', 'settings.manage': 'Instellingen beheren' };

export default function Settings() {
  const { me } = useSession();
  const state = useStore();
  const [tab, setTab] = useState<Tab>('structuur');
  if (!me) return null;
  if (!hasPermAnywhere(state, me.id, 'settings.manage')) return <Banner kind="danger">Je hebt geen rechten om de instellingen te beheren.</Banner>;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Instellingen" />
      <div role="tablist" aria-label="Instellingen" className="mb-4 flex flex-wrap gap-1">
        {TABS.map(([k, l]) => <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="panel" onClick={() => setTab(k)} className={`min-h-[40px] rounded-md px-3 ${tab === k ? 'bg-accent text-on-accent' : 'bg-surface hover:bg-surface-sunken'}`}>{l}</button>)}
      </div>
      <div role="tabpanel" id="panel" aria-labelledby={`tab-${tab}`}>
        {tab === 'structuur' && <Structure />}{tab === 'diensttypes' && <ShiftTypes />}{tab === 'verlof' && <AbsenceSettings />}{tab === 'rechten' && <Permissions />}
      </div>
    </div>
  );
}

function Structure() {
  const state = useStore(); const { me } = useSession(); const run = useAction();
  const [name, setName] = useState(''); const [dept, setDept] = useState('');
  return (
    <div className="flex flex-col gap-6">
      {state.departments.map((d) => (
        <section key={d.id} aria-labelledby={`d-${d.id}`} className="rounded-lg border border-border p-4">
          <h2 id={`d-${d.id}`} className="text-lg font-semibold">{d.name} <span className="text-sm font-normal text-text-muted">· {d.locationName}</span></h2>
          <ul className="my-2 flex flex-wrap gap-2">{state.teams.filter((t) => t.departmentId === d.id).map((t) => <li key={t.id} className="inline-flex items-center gap-2 rounded-pill border border-border px-3 py-1"><span aria-hidden className="h-2.5 w-2.5 rounded-pill" style={{ background: t.colour }} />{t.name}</li>)}</ul>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Rooster zichtbaar voor medewerkers" hint="0 = alleen wat je zelf publiceert. 365 = altijd alles zichtbaar.">{(p) => (
              <Input {...p} type="number" min={0} max={365} defaultValue={d.publishDaysAhead ?? state.orgPublishDaysAhead}
                onBlur={(e) => { const v = Math.max(0, Math.min(365, Number(e.target.value))); if (v !== (d.publishDaysAhead ?? state.orgPublishDaysAhead)) run(() => api.setPublishWindow(me!.id, d.id, v), 'Opgeslagen'); }} />)}</Field>
            <Check_ label="Open diensten vragen goedkeuring van de planner" checked={d.openShiftNeedsApproval} onChange={(e) => run(() => api.setOpenShiftApproval(me!.id, d.id, e.target.checked), 'Opgeslagen')} />
          </div>
        </section>
      ))}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => api.upsertTeam(me!.id, { departmentId: dept || state.departments[0].id, name: name.trim(), kind: 'default', colour: '#64748b' }), 'Team toegevoegd'); setName(''); }}>
        <Field label="Nieuw team">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Afdeling">{(p) => <Select {...p} value={dept || state.departments[0].id} onChange={(e) => setDept(e.target.value)}>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>}</Field>
        <Button type="submit"><Plus size={16} aria-hidden />Toevoegen</Button>
      </form>
    </div>
  );
}

function ShiftTypes() {
  const state = useStore(); const { me } = useSession(); const run = useAction(); const attempt = useTry();
  const [edit, setEdit] = useState<Partial<ShiftType> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!edit) return;
    if (!edit.name?.trim()) return setErr('Geef het sjabloon een naam');
    if (!edit.start || !edit.end) return setErr('Vul begin- en eindtijd in');
    setErr(null);
    const ok = await attempt(() => api.upsertShiftType(me!.id, { departmentId: edit.departmentId ?? state.departments[0].id, name: edit.name!.trim(), shortName: edit.shortName ?? '', start: edit.start!, end: edit.end!, unpaidBreakMin: edit.unpaidBreakMin ?? 0, paidBreakMin: edit.paidBreakMin ?? 0, colourIndex: edit.colourIndex ?? 0, hideEndTime: edit.hideEndTime ?? false, id: edit.id }), 'Opgeslagen');
    if (ok) setEdit(null);
  };
  return (
    <div>
      <div className="mb-3"><Button variant="primary" onClick={() => setEdit({ start: '09:00', end: '17:00', colourIndex: 0, unpaidBreakMin: 30, paidBreakMin: 0, departmentId: state.departments[0].id })}><Plus size={16} aria-hidden />Nieuw sjabloon</Button></div>
      <ul className="flex flex-col gap-2">{state.shiftTypes.map((t) => (
        <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span style={shiftColour(t.colourIndex)} className="inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-xs font-bold">{t.shortName || t.name[0]}</span>
          <div className="flex-1"><div className="font-medium">{t.name}</div><div className="text-xs text-text-muted">{state.departments.find((d) => d.id === t.departmentId)?.name} · {t.start}–{t.end} · pauze {t.unpaidBreakMin} min</div></div>
          <Button size="sm" variant="ghost" aria-label={`${t.name} bewerken`} onClick={() => setEdit(t)}><Pencil size={14} aria-hidden /></Button>
          <Button size="sm" variant="ghost" aria-label={`${t.name} verwijderen`} onClick={() => run(() => api.deleteShiftType(me!.id, t.id), 'Verwijderd')}><Trash2 size={14} aria-hidden /></Button>
        </li>))}</ul>
      <Banner kind="info">Als je een sjabloon wijzigt, veranderen alleen naam en kleur mee in bestaande diensten. De tijden niet.</Banner>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Sjabloon bewerken' : 'Nieuw sjabloon'} footer={<><Button onClick={() => setEdit(null)}>Annuleren</Button><Button variant="primary" onClick={save}>Opslaan</Button></>}>
        {edit && <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          {err && <Banner kind="danger">{err}</Banner>}
          <Field label="Naam">{(p) => <Input {...p} value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
          <Field label="Korte naam" hint="Voor de maandweergave">{(p) => <Input {...p} maxLength={3} value={edit.shortName ?? ''} onChange={(e) => setEdit({ ...edit, shortName: e.target.value })} />}</Field>
          <Field label="Afdeling">{(p) => <Select {...p} value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Begintijd">{(p) => <Input {...p} type="time" value={edit.start ?? ''} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />}</Field>
            <Field label="Eindtijd">{(p) => <Input {...p} type="time" value={edit.end ?? ''} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />}</Field>
            <Field label="Onbetaalde pauze (min)">{(p) => <Input {...p} type="number" min={0} value={edit.unpaidBreakMin ?? 0} onChange={(e) => setEdit({ ...edit, unpaidBreakMin: Number(e.target.value) })} />}</Field>
            <Field label="Betaalde pauze (min)">{(p) => <Input {...p} type="number" min={0} value={edit.paidBreakMin ?? 0} onChange={(e) => setEdit({ ...edit, paidBreakMin: Number(e.target.value) })} />}</Field>
          </div>
          <fieldset><legend className="mb-1 text-sm font-medium">Kleur</legend><div className="flex flex-wrap gap-2">{Array.from({ length: 8 }, (_, i) => (
            <button type="button" key={i} aria-label={`Kleur ${i + 1}`} aria-pressed={edit.colourIndex === i} onClick={() => setEdit({ ...edit, colourIndex: i })} style={shiftColour(i)} className={`h-9 w-9 rounded-md text-xs font-bold ${edit.colourIndex === i ? 'ring-2 ring-accent ring-offset-2' : ''}`}>Aa</button>))}</div></fieldset>
          <Check_ label="Eindtijd verbergen" checked={!!edit.hideEndTime} onChange={(e) => setEdit({ ...edit, hideEndTime: e.target.checked })} />
        </form>}
      </Dialog>
    </div>
  );
}

function AbsenceSettings() {
  const state = useStore(); const { me } = useSession(); const run = useAction();
  const [name, setName] = useState('');
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Verlofsoorten</h2>
      <ul className="mb-3 flex flex-col gap-2">{state.absenceTypes.map((t) => <li key={t.id} className="rounded-lg border border-border p-3"><span className="font-medium">{t.name}</span><span className="ml-2 text-xs text-text-muted">{t.balanceId ? `trekt af van ${state.balances.find((b) => b.id === t.balanceId)?.name}` : 'geen saldo'}</span></li>)}</ul>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => api.upsertAbsenceType(me!.id, { name: name.trim(), balanceId: null, colour: '#64748b' }), 'Toegevoegd'); setName(''); }}>
        <Field label="Nieuwe soort">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field><Button type="submit">Toevoegen</Button>
      </form>
      <h2 className="mb-2 mt-6 text-lg font-semibold">Saldi</h2>
      <ul>{state.balances.map((b) => <li key={b.id}>{b.name}: {b.accrualPerYear} {b.unit === 'hours' ? 'uur' : 'dagen'} per jaar</li>)}</ul>
    </div>
  );
}

function Permissions() {
  const state = useStore();
  const perms = Object.keys(PERM_LABEL);
  return (
    <div className="relative overflow-x-auto"><table className="w-full text-left"><caption className="mb-2 text-left text-text-muted">Rechten per rol. Een medewerker kan per afdeling een andere rol hebben.</caption>
      <thead className="bg-surface"><tr><th scope="col" className="p-2">Recht</th>{state.groups.map((g) => <th scope="col" key={g.id} className="p-2">{g.name}</th>)}</tr></thead>
      <tbody>{perms.map((p) => <tr key={p} className="border-t border-border"><th scope="row" className="p-2 font-normal">{PERM_LABEL[p]}</th>{state.groups.map((g) => <td key={g.id} className="p-2">{g.permissions.includes(p as never) ? <span aria-label="Ja">✓</span> : <span aria-label="Nee" className="text-text-muted">–</span>}</td>)}</tr>)}</tbody></table></div>
  );
}
