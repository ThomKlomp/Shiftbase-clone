'use client';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { DateStr, ID, Shift } from '@/lib/types';
import { useStore } from '@/lib/store';
import { conflictsFor } from '@/lib/domain';
import * as api from '@/lib/api';
import { isoWeekday, WEEKDAY_SHORT } from '@/lib/dates';
import { Banner, Button, Check_, Dialog, Field, Input, Select, Textarea, useAction, useTry } from '../ui';

export interface ShiftDraft { id?: ID; departmentId: ID; teamId: ID; date: DateStr; employeeId: ID | null }

/** Create and edit a shift. Conflicts show as warnings and never block saving. */
export function ShiftForm({ actor, draft, onClose }: { actor: ID; draft: ShiftDraft | null; onClose: () => void }) {
  const state = useStore();
  const run = useAction();
  const attempt = useTry();
  const existing = draft?.id ? state.shifts.find((s) => s.id === draft.id) : undefined;
  const [f, setF] = useState<Shift | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [every, setEvery] = useState(1);
  const [endsOn, setEndsOn] = useState('');
  const [notify, setNotify] = useState(false);
  const [scope, setScope] = useState<'this' | 'future'>('this');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setError(null); setConfirmDelete(false); setScope('this'); setNotify(false); setRepeat(false); setEndsOn(''); setEvery(1);
    setDays([isoWeekday(draft.date)]);
    const base: Shift = existing ?? {
      id: '', departmentId: draft.departmentId, teamId: draft.teamId, shiftTypeId: null, employeeId: draft.employeeId, seriesId: null, openSourceId: null,
      date: draft.date, start: '08:00', end: '16:00', unpaidBreakMin: 0, paidBreakMin: 0, hideEndTime: false, description: '', neededCount: draft.employeeId ? null : 1,
    };
    setF({ ...base });
  }, [draft?.id, draft?.date, draft?.teamId, draft?.employeeId, draft?.departmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const types = state.shiftTypes.filter((t) => t.departmentId === f?.departmentId);
  const teams = state.teams.filter((t) => t.departmentId === f?.departmentId);
  const people = state.employees.filter((e) => e.active && e.teamIds.some((t) => teams.some((x) => x.id === t)));
  const conflicts = useMemo(() => (f ? conflictsFor(state, f) : []), [state, f]);
  if (!draft || !f) return <Dialog open={false} onClose={onClose} title="Dienst">{null}</Dialog>;

  const set = <K extends keyof Shift>(k: K, v: Shift[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const pickType = (id: string) => {
    const t = state.shiftTypes.find((x) => x.id === id);
    setF((x) => x && ({ ...x, shiftTypeId: id || null, ...(t ? { start: t.start, end: t.end, unpaidBreakMin: t.unpaidBreakMin, paidBreakMin: t.paidBreakMin, hideEndTime: t.hideEndTime } : {}) }));
  };
  const series = !!existing?.seriesId;

  async function save() {
    if (!f) return;
    if (!f.start || !f.end) return setError('Vul een begin- en eindtijd in');
    if (f.start === f.end) return setError('Begin- en eindtijd mogen niet hetzelfde zijn');
    if (repeat && !days.length) return setError('Kies minstens één dag voor de herhaling');
    setError(null); setBusy(true);
    const patch = { teamId: f.teamId, shiftTypeId: f.shiftTypeId, employeeId: f.employeeId, date: f.date, start: f.start, end: f.end, unpaidBreakMin: f.unpaidBreakMin, paidBreakMin: f.paidBreakMin, hideEndTime: f.hideEndTime, description: f.description, neededCount: f.employeeId ? null : f.neededCount ?? 1 };
    const ok = existing
      ? await attempt(() => api.updateShift(actor, existing.id, patch, scope, notify), 'Dienst opgeslagen')
      : await attempt(() => api.createShift(actor, { ...patch, departmentId: f.departmentId, repeat: repeat ? { weekdays: days, everyNWeeks: every, endsOn: endsOn || null } : undefined }, notify), 'Dienst toegevoegd');
    setBusy(false);
    if (ok) onClose();
  }
  async function remove() {
    if (!existing) return;
    setBusy(true);
    const ok = await attempt(() => api.deleteShift(actor, existing.id, scope, notify), 'Dienst verwijderd');
    setBusy(false);
    if (ok) onClose();
  }
  async function duplicate() {
    if (!existing) return;
    await run(() => api.copyShift(actor, existing.id, { date: existing.date }), 'Dienst gekopieerd');
    onClose();
  }

  return (
    <Dialog open drawer onClose={onClose} title={existing ? 'Dienst bewerken' : 'Dienst toevoegen'}
      footer={<>
        {existing && !confirmDelete && <Button variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={16} aria-hidden />Verwijderen</Button>}
        {existing && <Button variant="ghost" onClick={duplicate}><Copy size={16} aria-hidden />Dupliceren</Button>}
        <span className="flex-1" />
        <Button onClick={onClose}>Annuleren</Button>
        <Button variant="primary" onClick={save} loading={busy}>Opslaan</Button>
      </>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        {error && <Banner kind="danger">{error}</Banner>}
        {conflicts.length > 0 && <Banner kind="warning"><ul>{conflicts.map((c, i) => <li key={i}>{c.text}</li>)}</ul><p className="text-xs">Je kunt de dienst toch opslaan.</p></Banner>}
        {confirmDelete && existing && (
          <Banner kind="danger">
            <p>Weet je zeker dat je deze dienst wilt verwijderen?</p>
            <div className="mt-2 flex gap-2"><Button size="sm" variant="danger" onClick={remove}>Ja, verwijderen</Button><Button size="sm" onClick={() => setConfirmDelete(false)}>Nee</Button></div>
          </Banner>
        )}
        {series && (
          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">Dit is een herhalende dienst</legend>
            <label className="flex items-center gap-2 py-1"><input type="radio" name="scope" checked={scope === 'this'} onChange={() => setScope('this')} />Alleen deze dienst</label>
            <label className="flex items-center gap-2 py-1"><input type="radio" name="scope" checked={scope === 'future'} onChange={() => setScope('future')} />Deze en alle volgende</label>
          </fieldset>
        )}
        <Field label="Datum">{(p) => <Input {...p} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} required />}</Field>
        <Field label="Team">{(p) => <Select {...p} value={f.teamId} onChange={(e) => set('teamId', e.target.value)}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <Field label="Medewerker">{(p) => (
          <Select {...p} value={f.employeeId ?? ''} onChange={(e) => { const v = e.target.value || null; setF((x) => x && ({ ...x, employeeId: v, neededCount: v ? null : x.neededCount ?? 1 })); }}>
            <option value="">Open dienst (nog niemand)</option>
            {people.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </Select>
        )}</Field>
        {!f.employeeId && <Field label="Aantal medewerkers nodig">{(p) => <Input {...p} type="number" min={1} value={f.neededCount ?? 1} onChange={(e) => set('neededCount', Math.max(1, Number(e.target.value)))} />}</Field>}
        <Field label="Dienstsjabloon" hint="Vult tijden en pauze in. Je kunt ze daarna aanpassen.">{(p) => (
          <Select {...p} value={f.shiftTypeId ?? ''} onChange={(e) => pickType(e.target.value)}>
            <option value="">Geen sjabloon</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.start}–{t.end})</option>)}
          </Select>
        )}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Begintijd">{(p) => <Input {...p} type="time" value={f.start} onChange={(e) => set('start', e.target.value)} required />}</Field>
          <Field label="Eindtijd" hint={f.end <= f.start ? 'Eindigt de volgende dag' : undefined}>{(p) => <Input {...p} type="time" value={f.end} onChange={(e) => set('end', e.target.value)} required />}</Field>
          <Field label="Onbetaalde pauze (min)">{(p) => <Input {...p} type="number" min={0} value={f.unpaidBreakMin} onChange={(e) => set('unpaidBreakMin', Math.max(0, Number(e.target.value)))} />}</Field>
          <Field label="Betaalde pauze (min)">{(p) => <Input {...p} type="number" min={0} value={f.paidBreakMin} onChange={(e) => set('paidBreakMin', Math.max(0, Number(e.target.value)))} />}</Field>
        </div>
        <Check_ label="Eindtijd verbergen voor medewerkers" checked={f.hideEndTime} onChange={(e) => set('hideEndTime', e.target.checked)} />
        <Field label="Omschrijving">{(p) => <Textarea {...p} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />}</Field>
        {!existing && (
          <fieldset className="rounded-md border border-border p-3">
            <Check_ label="Herhalen" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            {repeat && (
              <div className="mt-2 flex flex-col gap-2">
                <div role="group" aria-label="Dagen" className="flex flex-wrap gap-1">
                  {WEEKDAY_SHORT.map((d, i) => (
                    <button key={d} type="button" aria-pressed={days.includes(i + 1)} onClick={() => setDays((x) => (x.includes(i + 1) ? x.filter((y) => y !== i + 1) : [...x, i + 1]))}
                      className={`min-h-[36px] min-w-[36px] rounded-md border px-2 text-sm ${days.includes(i + 1) ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-border-input'}`}>{d}</button>
                  ))}
                </div>
                <Field label="Elke … weken">{(p) => <Input {...p} type="number" min={1} max={8} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} />}</Field>
                <Field label="Eindigt op" hint="Leeg = de komende 90 dagen">{(p) => <Input {...p} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />}</Field>
              </div>
            )}
          </fieldset>
        )}
        {f.employeeId && <Check_ label="Medewerker een melding sturen" checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
      </form>
    </Dialog>
  );
}
