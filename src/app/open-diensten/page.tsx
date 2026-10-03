'use client';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPerm, openAssigned } from '@/lib/domain';
import { fmtLong, todayStr } from '@/lib/dates';
import * as api from '@/lib/api';
import { Badge, Button, Empty, PageHeader, useAction } from '@/components/ui';
import type { Shift } from '@/lib/types';

export default function OpenShifts() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  if (!me) return null;
  const today = todayStr();
  const open = state.shifts.filter((s) => !s.employeeId && s.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const planner = (s: Shift) => hasPerm(state, me.id, s.departmentId, 'schedule.edit');
  const mine = open.filter((s) => state.invites.some((i) => i.shiftId === s.id && i.employeeId === me.id));
  const managed = open.filter(planner);
  const nm = (id: string) => { const e = state.employees.find((x) => x.id === id)!; return `${e.firstName} ${e.lastName}`; };
  const when = (s: Shift) => `${fmtLong(s.date)} · ${s.hideEndTime ? s.start : `${s.start}–${s.end}`} · ${state.teams.find((t) => t.id === s.teamId)?.name}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Open diensten" />
      <section aria-labelledby="mine"><h2 id="mine" className="mb-2 text-lg font-semibold">Uitnodigingen voor jou</h2>
        {mine.length === 0 ? <Empty title="Geen uitnodigingen" text="Als je planner je uitnodigt voor een open dienst, zie je die hier." /> : (
          <ul className="flex flex-col gap-2">{mine.map((s) => {
            const inv = state.invites.find((i) => i.shiftId === s.id && i.employeeId === me.id)!;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex-1"><div className="font-medium">{when(s)}</div><div className="text-xs text-text-muted">{openAssigned(state, s)} van {s.neededCount} ingedeeld</div></div>
                <Badge kind={inv.status} />
                {(inv.status === 'invited' || inv.status === 'declined') && <Button size="sm" variant="primary" onClick={() => run(() => api.respondToOpenShift(me.id, s.id, 'request'), 'Reactie verstuurd')}>Ik wil deze dienst</Button>}
                {inv.status === 'invited' && <Button size="sm" onClick={() => run(() => api.respondToOpenShift(me.id, s.id, 'decline'))}>Nee, bedankt</Button>}
              </li>
            );
          })}</ul>
        )}
      </section>
      {managed.length > 0 && (
        <section aria-labelledby="mgr"><h2 id="mgr" className="mb-2 text-lg font-semibold">Beheren</h2>
          <ul className="flex flex-col gap-3">{managed.map((s) => {
            const invs = state.invites.filter((i) => i.shiftId === s.id);
            const candidates = state.employees.filter((e) => e.active && e.teamIds.some((t) => state.teams.find((x) => x.id === t)?.departmentId === s.departmentId) && !invs.some((i) => i.employeeId === e.id));
            return (
              <li key={s.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 font-medium">{when(s)} <span className="text-text-muted">({openAssigned(state, s)}/{s.neededCount} ingedeeld)</span></div>
                <ul className="mb-2 flex flex-col gap-1">{invs.map((i) => (
                  <li key={i.id} className="flex items-center gap-2"><span className="flex-1">{nm(i.employeeId)}</span><Badge kind={i.status} />
                    {i.status === 'requested' && <Button size="sm" variant="primary" onClick={() => run(() => api.assignOpenShift(me.id, s.id, i.employeeId), 'Ingedeeld')}>Indelen</Button>}</li>
                ))}{invs.length === 0 && <li className="text-text-muted">Nog niemand uitgenodigd</li>}</ul>
                {candidates.length > 0 && <Button size="sm" onClick={() => run(() => api.inviteToOpenShift(me.id, s.id, candidates.map((c) => c.id)), 'Uitnodigingen verstuurd')}>Nodig {candidates.length} medewerker{candidates.length > 1 ? 's' : ''} uit</Button>}
              </li>
            );
          })}</ul>
        </section>
      )}
    </div>
  );
}
