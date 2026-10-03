'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPerm, hasPermAnywhere } from '@/lib/domain';
import { fmtLong, paidHours, todayStr, timeToMin } from '@/lib/dates';
import * as api from '@/lib/api';
import { Badge, Button, Empty, PageHeader, useAction } from '@/components/ui';

export default function Timesheet() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  if (!me) return null;
  const running = state.timesheet.find((t) => t.employeeId === me.id && t.end === null);
  const dept = state.teams.find((t) => t.id === me.teamIds[0])?.departmentId ?? state.departments[0].id;
  const approver = hasPermAnywhere(state, me.id, 'timesheet.approve');
  const rows = state.timesheet.filter((t) => t.employeeId === me.id || hasPerm(state, me.id, t.departmentId, 'timesheet.approve')).sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  const nm = (id: string) => { const e = state.employees.find((x) => x.id === id)!; return `${e.firstName} ${e.lastName}`; };
  const today = todayStr();
  /** A clock still running from an earlier day, or for more than 14 hours, was probably forgotten. */
  const forgotten = (t: (typeof rows)[number]) => {
    if (t.end !== null) return false;
    if (t.date < today) return true;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() - timeToMin(t.start) > 14 * 60;
  };
  const pending = rows.filter((r) => r.status === 'pending' && r.end !== null && hasPerm(state, me.id, r.departmentId, 'timesheet.approve'));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Tijdregistratie">
        {running ? <Button variant="danger" size="lg" onClick={() => run(() => api.clockOut(me.id), 'Uitgeklokt')}>Uitklokken (sinds {running.start})</Button>
          : <Button variant="primary" size="lg" onClick={() => run(() => api.clockIn(me.id, dept), 'Ingeklokt')}>Inklokken</Button>}
      </PageHeader>
      {approver && pending.length > 0 && <div className="mb-3"><Button onClick={() => run(() => api.decideTimesheet(me.id, pending.map((p) => p.id), 'approved'), `${pending.length} registraties goedgekeurd`)}>Alles goedkeuren ({pending.length})</Button></div>}
      {rows.length === 0 ? <Empty title="Nog geen uren" text="Klok in aan het begin van je dienst." /> : (
        <ul className="flex flex-col gap-2">{rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex-1"><div className="font-medium">{t.employeeId !== me.id && `${nm(t.employeeId)} · `}{fmtLong(t.date)}</div>
              <div className="text-xs text-text-muted">{t.start}–{t.end ?? 'loopt nog'}{t.end && ` · ${paidHours(t.start, t.end, t.unpaidBreakMin).toFixed(2)} u`}</div></div>
            {forgotten(t) && <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Vergeten uit te klokken?</span>}
            {forgotten(t) && hasPerm(state, me.id, t.departmentId, 'timesheet.approve') && <FixClock id={t.id} actor={me.id} />}
            <Badge kind={t.status} />
            {t.status === 'pending' && t.end && hasPerm(state, me.id, t.departmentId, 'timesheet.approve') && <>
              <Button size="sm" variant="primary" onClick={() => run(() => api.decideTimesheet(me.id, [t.id], 'approved'))}>Goedkeuren</Button>
              <Button size="sm" onClick={() => run(() => api.decideTimesheet(me.id, [t.id], 'declined'))}>Afwijzen</Button></>}
          </li>))}</ul>
      )}
    </div>
  );
}

function FixClock({ id, actor }: { id: string; actor: string }) {
  const run = useAction();
  const [end, setEnd] = useState('17:00');
  return (
    <span className="flex items-center gap-1">
      <input aria-label="Eindtijd" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 rounded-md border border-border-input px-2 text-sm" />
      <Button size="sm" onClick={() => run(() => api.fixClockOut(actor, id, end), 'Uitklokken hersteld')}>Uitklokken</Button>
    </span>
  );
}
