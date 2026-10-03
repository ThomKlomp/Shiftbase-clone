'use client';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPerm } from '@/lib/domain';
import { fmtLong } from '@/lib/dates';
import * as api from '@/lib/api';
import { Badge, Button, Empty, PageHeader, useAction } from '@/components/ui';

export default function Exchanges() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  if (!me) return null;
  const nm = (id: string | null) => { const e = state.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : '—'; };
  const rows = [...state.exchanges].reverse().filter((x) => {
    const sh = state.shifts.find((s) => s.id === x.shiftId);
    if (!sh) return false;
    return x.fromEmployeeId === me.id || x.toEmployeeId === me.id || hasPerm(state, me.id, sh.departmentId, 'exchange.approve')
      || (x.status === 'pending_colleague' && me.teamIds.some((t) => state.teams.find((tt) => tt.id === t)?.departmentId === sh.departmentId));
  });
  return (
    <div>
      <PageHeader title="Ruilverzoeken" />
      {rows.length === 0 ? <Empty title="Geen ruilverzoeken" text="Vraag een ruil aan via Mijn rooster. Collega's en je planner zien het hier." /> : (
        <ul className="flex flex-col gap-2">{rows.map((x) => {
          const sh = state.shifts.find((s) => s.id === x.shiftId)!;
          const live = x.status === 'pending_colleague' || x.status === 'pending_manager';
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex-1"><div className="font-medium">{fmtLong(sh.date)} · {sh.start}–{sh.end}</div><div className="text-xs text-text-muted">{nm(x.fromEmployeeId)}{x.toEmployeeId ? ` → ${nm(x.toEmployeeId)}` : ''}</div></div>
              <Badge kind={x.status} />
              {x.status === 'pending_colleague' && x.fromEmployeeId !== me.id && <Button size="sm" variant="primary" onClick={() => run(() => api.acceptExchange(me.id, x.id), 'Je hebt de dienst overgenomen')}>Overnemen</Button>}
              {x.status === 'pending_manager' && hasPerm(state, me.id, sh.departmentId, 'exchange.approve') && <>
                <Button size="sm" variant="primary" onClick={() => run(() => api.decideExchange(me.id, x.id, true), 'Goedgekeurd')}>Goedkeuren</Button>
                <Button size="sm" onClick={() => run(() => api.decideExchange(me.id, x.id, false), 'Afgewezen')}>Afwijzen</Button></>}
              {live && x.fromEmployeeId === me.id && <Button size="sm" variant="ghost" onClick={() => run(() => api.cancelExchange(me.id, x.id))}>Intrekken</Button>}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}
