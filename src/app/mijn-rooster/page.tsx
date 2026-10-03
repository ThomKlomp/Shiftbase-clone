'use client';
import { useState } from 'react';
import { Repeat } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { isPublished } from '@/lib/domain';
import { addDays, fmtLong, todayStr, weekDays, weekStart } from '@/lib/dates';
import * as api from '@/lib/api';
import { Badge, Button, Empty, PageHeader, useAction } from '@/components/ui';
import { shiftColour, shiftLabel } from '@/components/schedule/ShiftCard';

export default function MySchedule() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const today = todayStr();
  const [anchor, setAnchor] = useState(today);
  const [team, setTeam] = useState(false);
  if (!me) return null;
  const days = weekDays(anchor);
  const visible = (deptId: string, d: string) => isPublished(state, deptId, d, today);
  const nameOf = (id: string | null) => { const e = state.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : 'Open'; };

  return (
    <div>
      <PageHeader title="Mijn rooster">
        <Button size="sm" onClick={() => setAnchor(addDays(anchor, -7))}>Vorige week</Button>
        <Button size="sm" onClick={() => setAnchor(today)}>Deze week</Button>
        <Button size="sm" onClick={() => setAnchor(addDays(anchor, 7))}>Volgende week</Button>
        <div role="group" aria-label="Weergave" className="flex overflow-hidden rounded-md border border-border">
          <button aria-pressed={!team} onClick={() => setTeam(false)} className={`min-h-[32px] px-3 ${!team ? 'bg-accent text-on-accent' : 'bg-surface'}`}>Ik</button>
          <button aria-pressed={team} onClick={() => setTeam(true)} className={`min-h-[32px] px-3 ${team ? 'bg-accent text-on-accent' : 'bg-surface'}`}>Team</button>
        </div>
      </PageHeader>
      <p className="mb-3 text-text-muted">Week van {fmtLong(weekStart(anchor))}</p>
      <ul className="flex flex-col gap-3">
        {days.map((d) => {
          const mine = state.shifts.filter((s) => s.date === d && s.employeeId && (team ? state.teams.find((t) => t.id === s.teamId) && me.teamIds.some((t) => state.teams.find((x) => x.id === t)?.departmentId === s.departmentId) : s.employeeId === me.id) && visible(s.departmentId, d)).sort((a, b) => a.start.localeCompare(b.start));
          const absence = state.absences.find((a) => a.employeeId === me.id && a.status !== 'declined' && d >= a.start && d <= a.end);
          return (
            <li key={d} className="rounded-lg border border-border p-3">
              <h2 className="mb-2 font-semibold">{fmtLong(d)}{d === today && <span className="ml-2 text-xs text-accent">vandaag</span>}</h2>
              {absence && <p className="mb-2"><Badge kind={absence.status as 'pending' | 'approved'} /> <span className="ml-1">{state.absenceTypes.find((t) => t.id === absence.typeId)?.name}</span></p>}
              {mine.length === 0 && !absence && <p className="text-text-muted">Geen diensten</p>}
              <div className="flex flex-col gap-2">
                {mine.map((s) => {
                  const type = state.shiftTypes.find((t) => t.id === s.shiftTypeId);
                  const { time, name } = shiftLabel(s, type);
                  const ex = state.exchanges.find((e) => e.shiftId === s.id && (e.status === 'pending_colleague' || e.status === 'pending_manager'));
                  return (
                    <div key={s.id} style={shiftColour(type?.colourIndex ?? 7)} className="flex items-center gap-3 rounded-md px-3 py-2">
                      <div className="flex-1"><div className="font-semibold">{time}</div><div className="text-xs">{team ? `${nameOf(s.employeeId)} · ` : ''}{name}{s.description ? ` · ${s.description}` : ''}</div></div>
                      {!team && (ex ? <Badge kind={ex.status as 'pending_colleague'} /> :
                        <Button size="sm" onClick={() => run(() => api.requestExchange(me.id, s.id), 'Ruilverzoek verstuurd')}><Repeat size={14} aria-hidden />Ruilen</Button>)}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {!days.some((d) => state.shifts.some((s) => s.employeeId === me.id && s.date === d && visible(s.departmentId, d))) && (
        <div className="mt-4"><Empty title="Nog niets gepubliceerd" text="Zodra je planner het rooster publiceert, zie je hier je diensten." /></div>
      )}
    </div>
  );
}
