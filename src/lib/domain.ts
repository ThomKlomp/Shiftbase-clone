import type { Absence, Availability, DateStr, ID, Perm, Shift, State } from './types';
import { addDays, diffDays, isoWeekday, range, timeToMin, toDate, durationMin } from './dates';

export const EPOCH: DateStr = '2000-01-01';

export function hasPerm(s: State, employeeId: ID, departmentId: ID, perm: Perm) {
  const e = s.employees.find((x) => x.id === employeeId);
  if (!e || !e.active) return false;
  const g = s.groups.find((x) => x.id === e.groupByDept[departmentId]);
  return !!g && g.permissions.includes(perm);
}
export const hasPermAnywhere = (s: State, employeeId: ID, perm: Perm) =>
  s.departments.some((d) => hasPerm(s, employeeId, d.id, perm));

/** Dates a recurring shift lands on. weekdays are ISO 1..7. `until` caps open-ended series. */
export function expandRecurrence(startDate: DateStr, weekdays: number[], everyNWeeks: number, endsOn: DateStr | null, until: DateStr): DateStr[] {
  const out: DateStr[] = [];
  const last = endsOn && endsOn < until ? endsOn : until;
  const startWeek = addDays(startDate, 1 - isoWeekday(startDate));
  for (let d = startDate; d <= last; d = addDays(d, 1)) {
    if (!weekdays.includes(isoWeekday(d))) continue;
    const weeks = Math.floor(diffDays(startWeek, addDays(d, 1 - isoWeekday(d))) / 7);
    if (weeks % everyNWeeks === 0) out.push(d);
  }
  return out;
}

/** How many days ahead the schedule is visible to employees for a department. */
export function publishWindow(s: State, departmentId: ID): number {
  const d = s.departments.find((x) => x.id === departmentId);
  return d?.publishDaysAhead ?? s.orgPublishDaysAhead;
}

/** Published by explicit action, or inside the rolling window (window 0 = manual only). */
export function isPublished(s: State, departmentId: ID, date: DateStr, today: DateStr): boolean {
  if ((s.published[departmentId] ?? []).includes(date)) return true;
  const w = publishWindow(s, departmentId);
  return w > 0 && date >= today && diffDays(today, date) <= w;
}

export type Conflict = { kind: 'overlap' | 'absence' | 'absence_pending' | 'unavailable'; text: string };

function unavailableAt(a: Availability, start: string, end: string) {
  const overnight = timeToMin(end) <= timeToMin(start);
  if (a.kind === 'unavailable_all_day') return true;
  if (a.kind === 'unavailable_from' && a.from) {
    const f = timeToMin(a.from);
    return overnight || timeToMin(end) > f;
  }
  if (a.kind === 'available_from' && a.from) return timeToMin(start) < timeToMin(a.from);
  return false;
}

/** Warnings, never blocks: planners may override. */
export function conflictsFor(s: State, shift: Pick<Shift, 'id' | 'employeeId' | 'date' | 'start' | 'end'>): Conflict[] {
  if (!shift.employeeId) return [];
  const out: Conflict[] = [];
  const [a0, a1] = range(shift.date, shift.start, shift.end, EPOCH);
  for (const o of s.shifts) {
    if (o.id === shift.id || o.employeeId !== shift.employeeId) continue;
    if (Math.abs(diffDays(shift.date, o.date)) > 1) continue;
    const [b0, b1] = range(o.date, o.start, o.end, EPOCH);
    if (a0 < b1 && b0 < a1) out.push({ kind: 'overlap', text: `Overlapt met een dienst om ${o.start}–${o.end}` });
  }
  for (const ab of s.absences) {
    if (ab.employeeId !== shift.employeeId || ab.status === 'declined') continue;
    if (shift.date >= ab.start && shift.date <= ab.end) {
      out.push(ab.status === 'approved'
        ? { kind: 'absence', text: 'Heeft goedgekeurd verlof' }
        : { kind: 'absence_pending', text: 'Heeft een openstaande verlofaanvraag' });
    }
  }
  const av = s.availability.find((x) => x.employeeId === shift.employeeId && x.date === shift.date);
  if (av && unavailableAt(av, shift.start, shift.end)) out.push({ kind: 'unavailable', text: 'Is niet beschikbaar' });
  return out;
}

export const balanceOf = (s: State, employeeId: ID, balanceId: ID) =>
  s.balanceEntries.filter((e) => e.employeeId === employeeId && e.balanceId === balanceId).reduce((n, e) => n + e.amount, 0);

export type AbsenceWarning = { kind: 'balance' | 'nearby' | 'public' ; text: string };
export function absenceWarnings(s: State, a: Pick<Absence, 'id' | 'employeeId' | 'typeId' | 'start' | 'end' | 'amount'>): AbsenceWarning[] {
  const out: AbsenceWarning[] = [];
  const type = s.absenceTypes.find((t) => t.id === a.typeId);
  if (type?.balanceId) {
    const left = balanceOf(s, a.employeeId, type.balanceId);
    if (left - a.amount < 0) out.push({ kind: 'balance', text: `Saldo te laag: ${left} beschikbaar, ${a.amount} gevraagd` });
  }
  for (const o of s.absences) {
    if (o.id === a.id || o.employeeId !== a.employeeId || o.status === 'declined') continue;
    if (o.end >= addDays(a.start, -7) && o.start <= addDays(a.end, 7)) {
      out.push({ kind: 'nearby', text: `Ligt dicht bij ander verlof (${o.start} t/m ${o.end})` });
      break;
    }
  }
  return out;
}

/** Working days in a range that carry hours, used to default an absence amount. */
export function daysInclusive(start: DateStr, end: DateStr) { return diffDays(start, end) + 1; }

export function coverage(s: State, deptId: ID, teamId: ID, date: DateStr) {
  const req = s.requiredShifts.filter((r) => r.departmentId === deptId && r.teamId === teamId && r.date === date);
  const required = req.reduce((n, r) => n + r.count, 0);
  const scheduled = s.shifts.filter((x) => x.teamId === teamId && x.date === date && x.employeeId).length;
  const mode = req[0]?.mode ?? 'exact';
  const state = required === 0 ? 'none' : scheduled < required ? 'under' : scheduled > required && mode !== 'min' ? 'over' : 'met';
  return { required, scheduled, state } as const;
}

export const openAssigned = (s: State, open: Shift) => s.shifts.filter((x) => x.openSourceId === open.id).length;
export const sameShiftLength = (s: Shift) => durationMin(s.start, s.end);
export { toDate };
