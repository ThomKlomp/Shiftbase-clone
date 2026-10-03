import { beforeEach, describe, expect, it } from 'vitest';
import { makeSeed } from '@/lib/seed';
import { getState, resetState } from '@/lib/store';
import * as api from '@/lib/api';
import { absenceWarnings, balanceOf, conflictsFor, expandRecurrence, isPublished } from '@/lib/domain';
import { addDays, durationMin, paidHours, weekStart } from '@/lib/dates';

const TODAY = '2026-10-05'; // a Monday
const w = weekStart(TODAY);
const ADMIN = 'e1', PLANNER = 'e2', EMP = 'e3', EMP2 = 'e4';

beforeEach(() => resetState(makeSeed(TODAY)));

describe('dates', () => {
  it('overnight shifts roll over midnight', () => {
    expect(durationMin('22:00', '06:00')).toBe(480);
    expect(paidHours('08:00', '16:00', 30)).toBe(7.5);
  });
  it('weeks start on Monday', () => {
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });
});

describe('recurrence', () => {
  it('every week on Mon and Wed', () => {
    expect(expandRecurrence('2026-10-05', [1, 3], 1, null, '2026-10-18')).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']);
  });
  it('every 2 weeks, honours end date', () => {
    expect(expandRecurrence('2026-10-05', [1], 2, '2026-10-30', '2027-01-01')).toEqual(['2026-10-05', '2026-10-19']);
  });
});

describe('permissions', () => {
  it('employee cannot create shifts', async () => {
    const s = getState();
    const base = { ...s.shifts[0], id: 'x' };
    await expect(api.createShift(EMP, base)).rejects.toThrow(/Geen rechten/);
  });
  it('planner can, and recurring creates a series', async () => {
    const s = getState();
    const { id: _id, seriesId: _s, openSourceId: _o, ...rest } = s.shifts[0];
    const made = await api.createShift(PLANNER, { ...rest, date: addDays(w, 7), repeat: { weekdays: [1, 2], everyNWeeks: 1, endsOn: addDays(w, 20) } });
    expect(made.length).toBe(4);
    expect(new Set(made.map((m) => m.seriesId)).size).toBe(1);
  });
  it('only settings managers edit shift types', async () => {
    const t = getState().shiftTypes[0];
    await expect(api.upsertShiftType(PLANNER, { ...t })).rejects.toThrow(/Geen rechten/);
    await expect(api.upsertShiftType(ADMIN, { ...t, name: 'Nieuw' })).resolves.toBeUndefined();
  });
});

describe('recurring edits', () => {
  it('"future" scope edits later rows only', async () => {
    const s = getState();
    const { id: _id, seriesId: _s, openSourceId: _o, ...rest } = s.shifts[0];
    const made = await api.createShift(PLANNER, { ...rest, date: w, repeat: { weekdays: [1], everyNWeeks: 1, endsOn: addDays(w, 21) } });
    await api.updateShift(PLANNER, made[1].id, { start: '09:00' }, 'future');
    const after = getState().shifts.filter((x) => x.seriesId === made[0].seriesId).sort((a, b) => a.date.localeCompare(b.date));
    expect(after.map((x) => x.start)).toEqual([rest.start, '09:00', '09:00', '09:00']);
  });
});

describe('conflicts are warnings', () => {
  it('detects overlap, unavailability and leave', async () => {
    const s = getState();
    const mine = s.shifts.find((x) => x.employeeId === EMP)!;
    expect(conflictsFor(s, { ...mine, id: 'new' }).map((c) => c.kind)).toContain('overlap');
    await api.setAvailability(EMP, EMP, [{ date: mine.date, kind: 'unavailable_all_day' }]);
    expect(conflictsFor(getState(), { ...mine, id: 'new' }).map((c) => c.kind)).toContain('unavailable');
    await api.requestAbsence(EMP, { employeeId: EMP, typeId: 'at1', start: mine.date, end: mine.date, partialStart: null, amount: 8, note: '', shiftAction: 'leave' });
    expect(conflictsFor(getState(), { ...mine, id: 'new' }).map((c) => c.kind)).toContain('absence_pending');
  });
  it('available_from flags a shift that starts earlier', async () => {
    await api.setAvailability(EMP, EMP, [{ date: '2026-12-01', kind: 'available_from', from: '12:00' }]);
    const c = conflictsFor(getState(), { id: 'n', employeeId: EMP, date: '2026-12-01', start: '08:00', end: '16:00' });
    expect(c.map((x) => x.kind)).toContain('unavailable');
  });
});

describe('publishing', () => {
  it('window 0 means manual only', () => {
    const s = getState();
    expect(isPublished(s, 'd1', w, TODAY)).toBe(false);
  });
  it('rolling window shows only the next N days', () => {
    const s = getState();
    s.orgPublishDaysAhead = 14;
    expect(isPublished(s, 'd1', addDays(TODAY, 14), TODAY)).toBe(true);
    expect(isPublished(s, 'd1', addDays(TODAY, 15), TODAY)).toBe(false);
  });
  it('publishing notifies the scheduled employees once per person', async () => {
    await api.setPublished(PLANNER, 'd1', [w, addDays(w, 1)], true);
    const n = getState().notifications.filter((x) => x.kind === 'publish');
    expect(n.length).toBe(new Set(n.map((x) => x.employeeId)).size);
    expect(n.length).toBeGreaterThan(0);
    expect(isPublished(getState(), 'd1', w, TODAY)).toBe(true);
  });
  it('employee cannot publish', async () => {
    await expect(api.setPublished(EMP, 'd1', [w], true)).rejects.toThrow(/Geen rechten/);
  });
});

describe('open shifts', () => {
  it('approval flow: invite -> request -> assign', async () => {
    const open = getState().shifts.find((x) => x.id === 's-open1')!; // needs 2
    await api.inviteToOpenShift(PLANNER, open.id, [EMP, EMP2]);
    await api.respondToOpenShift(EMP, open.id, 'request');
    expect(getState().invites.find((i) => i.employeeId === EMP)!.status).toBe('requested');
    await api.assignOpenShift(PLANNER, open.id, EMP);
    expect(getState().shifts.some((x) => x.openSourceId === open.id && x.employeeId === EMP)).toBe(true);
    expect(getState().invites.find((i) => i.employeeId === EMP)!.status).toBe('assigned');
  });
  it('no-approval department is first come first served and closes when full', async () => {
    await api.setOpenShiftApproval(ADMIN, 'd1', false);
    const open = getState().shifts.find((x) => x.id === 's-open2')!; // needs 1
    await api.inviteToOpenShift(PLANNER, open.id, [EMP, EMP2]);
    await api.respondToOpenShift(EMP, open.id, 'request');
    await expect(api.respondToOpenShift(EMP2, open.id, 'request')).rejects.toThrow();
    expect(getState().shifts.filter((x) => x.openSourceId === open.id).length).toBe(1);
  });
  it('cannot over-assign', async () => {
    const open = getState().shifts.find((x) => x.id === 's-open2')!;
    await api.assignOpenShift(PLANNER, open.id, EMP);
    await expect(api.assignOpenShift(PLANNER, open.id, EMP2)).rejects.toThrow(/vol/);
  });
});

describe('absence + balance', () => {
  const req = (amount: number) => ({ employeeId: EMP, typeId: 'at1', start: addDays(w, 14), end: addDays(w, 14), partialStart: null, amount, note: '', shiftAction: 'leave' as const });
  it('approving deducts, deleting restores', async () => {
    const abs = await api.requestAbsence(EMP, req(8));
    expect(balanceOf(getState(), EMP, 'b1')).toBe(120);
    await api.decideAbsence(PLANNER, abs.id, 'approved');
    expect(balanceOf(getState(), EMP, 'b1')).toBe(112);
    await api.deleteAbsence(PLANNER, abs.id);
    expect(balanceOf(getState(), EMP, 'b1')).toBe(120);
  });
  it('blocks going negative unless overridden', async () => {
    const abs = await api.requestAbsence(EMP, req(500));
    expect(absenceWarnings(getState(), abs).some((x) => x.kind === 'balance')).toBe(true);
    await expect(api.decideAbsence(PLANNER, abs.id, 'approved')).rejects.toThrow(/Saldo/);
    await api.decideAbsence(PLANNER, abs.id, 'approved', true);
    expect(balanceOf(getState(), EMP, 'b1')).toBe(-380);
  });
  it('make_open turns the shifts on those days into open shifts', async () => {
    const mine = getState().shifts.find((x) => x.employeeId === EMP)!;
    const abs = await api.requestAbsence(EMP, { ...req(8), start: mine.date, end: mine.date, shiftAction: 'make_open' });
    await api.decideAbsence(PLANNER, abs.id, 'approved');
    expect(getState().shifts.find((x) => x.id === mine.id)!.employeeId).toBeNull();
  });
  it('employee cannot approve own request; decided requests are final', async () => {
    const abs = await api.requestAbsence(EMP, req(8));
    await expect(api.decideAbsence(EMP, abs.id, 'approved')).rejects.toThrow(/Geen rechten/);
    await api.decideAbsence(PLANNER, abs.id, 'declined');
    await expect(api.decideAbsence(PLANNER, abs.id, 'approved')).rejects.toThrow(/al behandeld/);
  });
  it('flags absences within 7 days of each other', async () => {
    await api.requestAbsence(EMP, req(8));
    const w2 = absenceWarnings(getState(), { id: 'new', employeeId: EMP, typeId: 'at1', start: addDays(w, 16), end: addDays(w, 16), amount: 8 });
    expect(w2.some((x) => x.kind === 'nearby')).toBe(true);
  });
});

describe('exchanges', () => {
  it('colleague accepts, manager approves, shift moves', async () => {
    const mine = getState().shifts.find((x) => x.employeeId === EMP)!;
    const ex = await api.requestExchange(EMP, mine.id);
    await api.acceptExchange(EMP2, ex.id);
    expect(getState().exchanges[0].status).toBe('pending_manager');
    await api.decideExchange(PLANNER, ex.id, true);
    expect(getState().shifts.find((x) => x.id === mine.id)!.employeeId).toBe(EMP2);
  });
  it('first colleague wins; second gets a conflict', async () => {
    const mine = getState().shifts.find((x) => x.employeeId === EMP)!;
    const ex = await api.requestExchange(EMP, mine.id);
    await api.acceptExchange(EMP2, ex.id);
    await expect(api.acceptExchange('e5', ex.id)).rejects.toThrow(/was je voor/);
  });
  it('one live exchange per shift; only own shifts', async () => {
    const mine = getState().shifts.find((x) => x.employeeId === EMP)!;
    await api.requestExchange(EMP, mine.id);
    await expect(api.requestExchange(EMP, mine.id)).rejects.toThrow(/loopt al/);
    await expect(api.requestExchange(EMP2, mine.id)).rejects.toThrow(/Geen rechten/);
  });
  it('employee with approve_incoming skips manager', async () => {
    const s = getState();
    s.groups.find((g) => g.id === 'g-employee')!.permissions.push('exchange.approve_incoming');
    resetState(s);
    const mine = getState().shifts.find((x) => x.employeeId === EMP)!;
    const ex = await api.requestExchange(EMP, mine.id);
    await api.acceptExchange(EMP2, ex.id);
    expect(getState().exchanges[0].status).toBe('approved');
    expect(getState().shifts.find((x) => x.id === mine.id)!.employeeId).toBe(EMP2);
  });
});

describe('copy week', () => {
  it('duplicates assigned shifts to the target week', async () => {
    const before = getState().shifts.filter((x) => x.departmentId === 'd1' && x.date >= w && x.date <= addDays(w, 6) && !x.openSourceId).length;
    const n = await api.copyWeek(PLANNER, 'd1', w, addDays(w, 7));
    expect(n).toBe(before);
    await expect(api.copyWeek(PLANNER, 'd1', w, w)).rejects.toThrow();
  });
});

describe('timesheet', () => {
  it('one running clock per employee', async () => {
    await api.clockIn(EMP, 'd1');
    await expect(api.clockIn(EMP, 'd1')).rejects.toThrow(/al ingeklokt/);
    await api.clockOut(EMP);
    await expect(api.clockOut(EMP)).rejects.toThrow();
  });
});
