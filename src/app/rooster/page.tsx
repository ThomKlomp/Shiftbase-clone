'use client';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal, Send, CopyPlus, Printer, Check, Minus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSession } from '@/lib/session';
import { coverage, hasPerm, isPublished } from '@/lib/domain';
import { addDays, fmtLong, fmtShort, paidHours, todayStr, weekDays, weekStart } from '@/lib/dates';
import * as api from '@/lib/api';
import type { DateStr, ID, State } from '@/lib/types';
import { Banner, Button, Check_, Dialog, Empty, Field, Input, PageHeader, Select, useAction, useTry, cx, Avatar } from '@/components/ui';
import { ShiftCard } from '@/components/schedule/ShiftCard';
import { ShiftForm, type ShiftDraft } from '@/components/schedule/ShiftForm';
import { PublishDialog } from '@/components/schedule/PublishDialog';

export default function SchedulePage() {
  const state = useStore();
  const { me } = useSession();
  const run = useAction();
  const today = todayStr();
  const myDepts = me ? state.departments.filter((d) => hasPerm(state, me.id, d.id, 'schedule.edit')) : [];
  const [deptId, setDeptId] = useState<ID>('');
  const [anchor, setAnchor] = useState<DateStr>(today);
  const [view, setView] = useState<'week' | 'dag'>('week');
  const [showAvail, setShowAvail] = useState(true);
  const [showAbs, setShowAbs] = useState(true);
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dragId, setDragId] = useState<ID | null>(null);

  const dept = myDepts.find((d) => d.id === deptId) ?? myDepts[0];
  const days = useMemo(() => (view === 'week' ? weekDays(anchor) : [anchor]), [anchor, view]);
  if (!me) return null;
  if (!dept) return <Banner kind="danger">Je hebt geen rechten om het rooster te beheren. Bekijk je eigen diensten bij Mijn rooster.</Banner>;

  const teams = state.teams.filter((t) => t.departmentId === dept.id && t.kind !== 'hidden');
  const step = view === 'week' ? 7 : 1;
  const weekDaysAll = weekDays(anchor);
  const shiftsAt = (filter: (s: State['shifts'][number]) => boolean, d: DateStr) => state.shifts.filter((s) => s.departmentId === dept.id && s.date === d && filter(s)).sort((a, b) => a.start.localeCompare(b.start));
  const hours = (empId: ID) => weekDaysAll.flatMap((d) => shiftsAt((s) => s.employeeId === empId, d)).reduce((n, s) => n + paidHours(s.start, s.end, s.unpaidBreakMin), 0);

  async function drop(e: React.DragEvent, date: DateStr, employeeId: ID | null, teamId: ID) {
    e.preventDefault();
    const id = dragId; setDragId(null);
    if (!id) return;
    if (e.altKey || e.ctrlKey) await run(() => api.copyShift(me!.id, id, { date, employeeId, teamId }), 'Dienst gekopieerd');
    else await run(() => api.updateShift(me!.id, id, { date, employeeId, teamId }), 'Dienst verplaatst');
  }
  const cellProps = (date: DateStr, employeeId: ID | null, teamId: ID) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => drop(e, date, employeeId, teamId),
  });

  const publishedCount = weekDaysAll.filter((d) => isPublished(state, dept.id, d, today)).length;

  return (
    <div>
      <PageHeader title="Rooster">
        {myDepts.length > 1 && (
          <label className="flex items-center gap-2"><span className="sr-only">Afdeling</span>
            <Select value={dept.id} onChange={(e) => setDeptId(e.target.value)} className="w-40">{myDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          </label>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Periode">
          <Button size="sm" aria-label="Vorige" onClick={() => setAnchor(addDays(anchor, -step))}><ChevronLeft size={16} aria-hidden /></Button>
          <Button size="sm" onClick={() => setAnchor(today)}>Vandaag</Button>
          <Button size="sm" aria-label="Volgende" onClick={() => setAnchor(addDays(anchor, step))}><ChevronRight size={16} aria-hidden /></Button>
        </div>
        <div role="group" aria-label="Weergave" className="flex overflow-hidden rounded-md border border-border">
          {(['week', 'dag'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cx('min-h-[32px] px-3 text-sm', view === v ? 'bg-accent text-on-accent' : 'bg-surface')}>{v === 'week' ? 'Week' : 'Dag'}</button>)}
        </div>
        <Button variant="primary" onClick={() => setDraft({ departmentId: dept.id, teamId: teams[0]?.id ?? '', date: view === 'dag' ? anchor : today, employeeId: null })}><Plus size={16} aria-hidden />Dienst</Button>
        <div className="relative">
          <Button aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal size={16} aria-hidden />Acties</Button>
          {menu && (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-bg p-1 shadow-pop">
              <button role="menuitem" className="flex min-h-[40px] w-full items-center gap-2 rounded px-3 text-left hover:bg-surface-sunken" onClick={() => { setMenu(false); setPublishOpen(true); }}><Send size={14} aria-hidden />Publiceren…</button>
              <button role="menuitem" className="flex min-h-[40px] w-full items-center gap-2 rounded px-3 text-left hover:bg-surface-sunken" onClick={() => { setMenu(false); setCopyOpen(true); }}><CopyPlus size={14} aria-hidden />Week kopiëren…</button>
              <button role="menuitem" className="flex min-h-[40px] w-full items-center gap-2 rounded px-3 text-left hover:bg-surface-sunken" onClick={() => { setMenu(false); window.print(); }}><Printer size={14} aria-hidden />Afdrukken</button>
            </div>
          )}
        </div>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold">{fmtShort(days[0])}{days.length > 1 && ` – ${fmtShort(days[days.length - 1])}`}</span>
        <span className="inline-flex items-center gap-1 text-text-muted">{publishedCount === 7 ? <Check size={14} aria-hidden /> : <Minus size={14} aria-hidden />}{publishedCount} van 7 dagen gepubliceerd</span>
        <Check_ label="Beschikbaarheid" checked={showAvail} onChange={(e) => setShowAvail(e.target.checked)} />
        <Check_ label="Verlof" checked={showAbs} onChange={(e) => setShowAbs(e.target.checked)} />
      </div>

      {teams.length === 0 ? <Empty title="Nog geen teams" text="Maak eerst een team aan bij Instellingen." /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table role="grid" aria-label="Rooster" className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-[var(--layout-grid-name-col)] border-b border-r border-border bg-surface p-2 text-left">Medewerker</th>
                {days.map((d) => <th scope="col" key={d} className={cx('min-w-[var(--layout-grid-day-col-min)] border-b border-border p-2 text-left', d === today && 'text-accent')}>
                  <div>{fmtLong(d)}</div>
                  <div className="text-xs font-normal text-text-muted">{isPublished(state, dept.id, d, today) ? '● Gepubliceerd' : '○ Concept'}</div>
                </th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-surface-sunken/50">
                <th scope="row" className="sticky left-0 border-b border-r border-border bg-surface p-2 text-left font-semibold">Open diensten</th>
                {days.map((d) => (
                  <td key={d} className="border-b border-border p-1 align-top" {...cellProps(d, null, teams[0].id)}>
                    <div className="flex flex-col gap-1">{shiftsAt((s) => !s.employeeId, d).map((s) => <ShiftCard key={s.id} shift={s} state={state} onOpen={() => setDraft({ id: s.id, departmentId: s.departmentId, teamId: s.teamId, date: s.date, employeeId: null })} draggable onDragStart={() => setDragId(s.id)} />)}</div>
                  </td>
                ))}
              </tr>
              {teams.map((team) => {
                const members = state.employees.filter((e) => e.active && e.teamIds.includes(team.id));
                const hasReq = state.requiredShifts.some((r) => r.teamId === team.id && days.includes(r.date));
                return (
                  <TeamRows key={team.id} team={team.name} colour={team.colour} days={days} hasReq={hasReq} cov={(d) => coverage(state, dept.id, team.id, d)}>
                    {members.length === 0 && <tr><td colSpan={days.length + 1} className="border-b border-border p-3 text-text-muted">Nog geen medewerkers in dit team.</td></tr>}
                    {members.map((emp) => (
                      <tr key={emp.id}>
                        <th scope="row" className="sticky left-0 border-b border-r border-border bg-bg p-2 text-left font-normal">
                          <div className="flex items-center gap-2"><Avatar name={`${emp.firstName} ${emp.lastName}`} size={24} /><span className="min-w-0"><span className="block truncate font-medium">{emp.firstName} {emp.lastName}</span><span className="text-xs text-text-muted">{hours(emp.id).toFixed(1)} / {emp.hoursPerWeek} u</span></span></div>
                        </th>
                        {days.map((d) => {
                          const av = showAvail ? state.availability.find((a) => a.employeeId === emp.id && a.date === d) : undefined;
                          const ab = showAbs ? state.absences.find((a) => a.employeeId === emp.id && a.status !== 'declined' && d >= a.start && d <= a.end) : undefined;
                          const unavailable = av && (av.kind === 'unavailable_all_day' || av.kind === 'unavailable_from');
                          return (
                            <td key={d} {...cellProps(d, emp.id, team.id)} style={av ? { background: unavailable ? 'var(--color-avail-no)' : 'var(--color-avail-yes)' } : undefined}
                              className={cx('group/cell relative border-b border-border p-1 align-top', unavailable && 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(0,0,0,.06)_6px_8px)]')}>
                              {av && <span className="mb-1 block text-[10px] text-text-muted">{av.kind === 'unavailable_all_day' ? 'Niet beschikbaar' : av.kind === 'available_all_day' ? 'Beschikbaar' : av.kind === 'available_from' ? `Beschikbaar vanaf ${av.from}` : `Niet beschikbaar vanaf ${av.from}`}</span>}
                              {ab && <span className={cx('mb-1 block rounded-sm px-1 text-[11px] font-medium', ab.status === 'approved' ? 'bg-accent text-on-accent' : 'border border-accent text-accent')}>{state.absenceTypes.find((t) => t.id === ab.typeId)?.name}{ab.status === 'pending' ? ' (aangevraagd)' : ''}</span>}
                              <div className="flex flex-col gap-1">
                                {shiftsAt((s) => s.employeeId === emp.id, d).map((s) => <ShiftCard key={s.id} shift={s} state={state} onOpen={() => setDraft({ id: s.id, departmentId: s.departmentId, teamId: s.teamId, date: s.date, employeeId: emp.id })} draggable onDragStart={() => setDragId(s.id)} />)}
                              </div>
                              <button aria-label={`Dienst toevoegen voor ${emp.firstName} op ${fmtLong(d)}`} onClick={() => setDraft({ departmentId: dept.id, teamId: team.id, date: d, employeeId: emp.id })}
                                className="mt-1 flex h-6 w-full items-center justify-center rounded-sm text-text-muted opacity-0 hover:bg-surface-sunken focus:opacity-100 group-hover/cell:opacity-100"><Plus size={14} aria-hidden /></button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </TeamRows>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-text-muted">Sleep een dienst om te verplaatsen, houd Alt ingedrukt om te kopiëren. Met het toetsenbord: open een dienst en pas datum of medewerker aan.</p>

      <ShiftForm actor={me.id} draft={draft} onClose={() => setDraft(null)} />
      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} actor={me.id} departmentId={dept.id} days={weekDaysAll} />
      <CopyWeekDialog open={copyOpen} onClose={() => setCopyOpen(false)} actor={me.id} departmentId={dept.id} from={weekStart(anchor)} />
    </div>
  );
}

function TeamRows({ team, colour, days, hasReq, cov, children }: { team: string; colour: string; days: DateStr[]; hasReq: boolean; cov: (d: DateStr) => ReturnType<typeof coverage>; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-surface">
        <th scope="row" className="sticky left-0 border-b border-r border-border bg-surface p-2 text-left font-semibold"><span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-pill" style={{ background: colour }} />{team}</th>
        {days.map((d) => {
          const c = cov(d);
          return (
            <td key={d} className="border-b border-border p-2 text-xs">
              {hasReq && c.state !== 'none' && (
                <span role="status" className={cx('inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium', c.state === 'under' ? 'bg-warning-soft text-warning' : c.state === 'over' ? 'bg-accent-soft text-accent' : 'bg-success-soft text-success')}>
                  {c.scheduled} / {c.required} nodig{c.state === 'under' ? ' · tekort' : ''}
                </span>
              )}
            </td>
          );
        })}
      </tr>
      {children}
    </>
  );
}

function CopyWeekDialog({ open, onClose, actor, departmentId, from }: { open: boolean; onClose: () => void; actor: ID; departmentId: ID; from: DateStr }) {
  const attempt = useTry();
  const [to, setTo] = useState(addDays(from, 7));
  return (
    <Dialog open={open} onClose={onClose} title="Week kopiëren"
      footer={<><Button onClick={onClose}>Annuleren</Button><Button variant="primary" onClick={async () => { if (await attempt(() => api.copyWeek(actor, departmentId, from, to), 'Week gekopieerd')) onClose(); }}>Kopiëren</Button></>}>
      <p className="mb-3">Kopieer alle diensten van de week van {fmtShort(from)} naar een andere week. Open diensten worden meegenomen, bestaande diensten blijven staan.</p>
      <Field label="Naar de week van">{(p) => <Input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
    </Dialog>
  );
}
