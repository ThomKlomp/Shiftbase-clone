'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPermAnywhere } from '@/lib/domain';
import { addDays, fmtLong, todayStr, weekDays, weekStart } from '@/lib/dates';
import * as api from '@/lib/api';
import type { AvailabilityKind } from '@/lib/types';
import { Banner, Button, Input, PageHeader, Select, useAction } from '@/components/ui';

const KINDS: [AvailabilityKind | '', string][] = [
  ['', 'Geen opgave'], ['available_all_day', 'Hele dag beschikbaar'], ['available_from', 'Beschikbaar vanaf…'],
  ['unavailable_all_day', 'Hele dag niet beschikbaar'], ['unavailable_from', 'Niet beschikbaar vanaf…'],
];
type Row = { kind: AvailabilityKind | ''; from: string };

export default function AvailabilityPage() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const [anchor, setAnchor] = useState(addDays(weekStart(todayStr()), 7));
  const [who, setWho] = useState('');
  const target = who || me?.id || '';
  const days = weekDays(anchor);
  const [rows, setRows] = useState<Record<string, Row>>({});

  useEffect(() => {
    const r: Record<string, Row> = {};
    for (const d of days) { const a = state.availability.find((x) => x.employeeId === target && x.date === d); r[d] = { kind: a?.kind ?? '', from: a?.from ?? '' }; }
    setRows(r);
  }, [anchor, target, state.availability]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return null;
  const planner = hasPermAnywhere(state, me.id, 'availability.edit_others');
  const dirty = days.some((d) => {
    const a = state.availability.find((x) => x.employeeId === target && x.date === d);
    return (rows[d]?.kind ?? '') !== (a?.kind ?? '') || (rows[d]?.from ?? '') !== (a?.from ?? '');
  });
  const missing = days.some((d) => (rows[d]?.kind === 'available_from' || rows[d]?.kind === 'unavailable_from') && !rows[d].from);
  const copyPrev = () => {
    const r: Record<string, Row> = {};
    for (const d of days) { const a = state.availability.find((x) => x.employeeId === target && x.date === addDays(d, -7)); r[d] = { kind: a?.kind ?? '', from: a?.from ?? '' }; }
    setRows(r);
  };
  const save = () => run(() => api.setAvailability(me.id, target, days.map((d) => ({ date: d, kind: (rows[d].kind || null) as AvailabilityKind | null, from: rows[d].from || null }))), 'Beschikbaarheid opgeslagen');

  return (
    <div className="max-w-2xl">
      <PageHeader title="Beschikbaarheid" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {planner && <Select aria-label="Medewerker" value={target} onChange={(e) => setWho(e.target.value)} className="w-52">{state.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>}
        <Button size="sm" onClick={() => setAnchor(addDays(anchor, -7))}>Vorige week</Button>
        <span className="font-medium">Week van {fmtLong(days[0])}</span>
        <Button size="sm" onClick={() => setAnchor(addDays(anchor, 7))}>Volgende week</Button>
        <Button size="sm" variant="ghost" onClick={copyPrev}>Kopieer vorige week</Button>
      </div>
      <Banner kind="info">Niet beschikbaar is een voorkeur, geen verlof. Je planner ziet dit bij het maken van het rooster.</Banner>
      <ul className="mt-3 flex flex-col gap-2">{days.map((d) => (
        <li key={d} className="grid grid-cols-[88px_1fr_110px] items-center gap-2">
          <span className="font-medium">{fmtLong(d)}</span>
          <Select aria-label={`Beschikbaarheid ${fmtLong(d)}`} value={rows[d]?.kind ?? ''} onChange={(e) => setRows((r) => ({ ...r, [d]: { kind: e.target.value as AvailabilityKind | '', from: r[d]?.from ?? '' } }))}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          {(rows[d]?.kind === 'available_from' || rows[d]?.kind === 'unavailable_from') ? <Input aria-label={`Tijd ${fmtLong(d)}`} type="time" value={rows[d].from} onChange={(e) => setRows((r) => ({ ...r, [d]: { ...r[d], from: e.target.value } }))} /> : <span />}
        </li>
      ))}</ul>
      <div className="mt-4 flex items-center gap-3"><Button variant="primary" disabled={!dirty || missing} onClick={save}>Opslaan</Button>{missing && <span className="text-xs text-danger">Kies bij elke “vanaf” een tijd.</span>}</div>
    </div>
  );
}
