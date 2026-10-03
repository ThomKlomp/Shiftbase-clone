import type { State, Shift, Employee, Perm } from './types';
import { addDays, todayStr, weekStart } from './dates';

const ALL: Perm[] = ['schedule.edit', 'schedule.publish', 'absence.approve', 'exchange.approve', 'exchange.approve_incoming', 'availability.edit_others', 'timesheet.approve', 'employees.manage', 'settings.manage'];

export function makeSeed(today = todayStr()): State {
  const w = weekStart(today);
  const emp = (id: string, first: string, last: string, teamIds: string[], g: string, hours = 32): Employee => ({
    id, firstName: first, lastName: last, email: `${first.toLowerCase()}@voorbeeld.nl`, active: true,
    teamIds, groupByDept: { d1: g, d2: 'g-employee' }, hoursPerWeek: hours,
  });
  const employees: Employee[] = [
    emp('e1', 'Anna', 'de Vries', ['t1'], 'g-admin', 40),
    emp('e2', 'Bram', 'Jansen', ['t1'], 'g-planner', 36),
    emp('e3', 'Chantal', 'Bakker', ['t1'], 'g-employee'),
    emp('e4', 'Daan', 'Visser', ['t1'], 'g-employee', 24),
    emp('e5', 'Esra', 'Yilmaz', ['t2'], 'g-employee'),
    emp('e6', 'Femke', 'Smit', ['t2'], 'g-employee', 20),
  ];
  const sh = (id: string, day: number, emp: string | null, team: string, type: string, start: string, end: string, extra: Partial<Shift> = {}): Shift => ({
    id, departmentId: 'd1', teamId: team, shiftTypeId: type, employeeId: emp, seriesId: null, openSourceId: null,
    date: addDays(w, day), start, end, unpaidBreakMin: 30, paidBreakMin: 0, hideEndTime: false, description: '',
    neededCount: emp ? null : 1, ...extra,
  });
  const shifts: Shift[] = [];
  const pattern: [string, string, number[]][] = [
    ['e3', 'st1', [0, 1, 2, 3]], ['e4', 'st2', [1, 2, 4]], ['e5', 'st1', [0, 2, 4]], ['e6', 'st2', [3, 4, 5]],
  ];
  let n = 1;
  for (const [e, type, days] of pattern) {
    for (const d of days) {
      const early = type === 'st1';
      shifts.push(sh(`s${n++}`, d, e, e === 'e5' || e === 'e6' ? 't2' : 't1', type, early ? '08:00' : '14:00', early ? '16:00' : '22:00'));
    }
  }
  shifts.push(sh('s-open1', 5, null, 't1', 'st1', '08:00', '16:00', { neededCount: 2 }));
  shifts.push(sh('s-open2', 6, null, 't2', 'st2', '14:00', '22:00', { neededCount: 1 }));
  return {
    orgName: 'Voorbeeldbedrijf',
    orgPublishDaysAhead: 0,
    groups: [
      { id: 'g-admin', name: 'Beheerder', permissions: ALL },
      { id: 'g-manager', name: 'Manager', permissions: ALL.filter((p) => p !== 'settings.manage') },
      { id: 'g-planner', name: 'Planner', permissions: ['schedule.edit', 'schedule.publish', 'absence.approve', 'exchange.approve', 'availability.edit_others'] },
      { id: 'g-employee', name: 'Medewerker', permissions: [] },
    ],
    departments: [
      { id: 'd1', name: 'Winkel', locationName: 'Hoofdvestiging', timezone: 'Europe/Amsterdam', publishDaysAhead: null, openShiftNeedsApproval: true },
      { id: 'd2', name: 'Magazijn', locationName: 'Hoofdvestiging', timezone: 'Europe/Amsterdam', publishDaysAhead: null, openShiftNeedsApproval: false },
    ],
    teams: [
      { id: 't1', departmentId: 'd1', name: 'Kassa', kind: 'default', colour: '#2f5bea' },
      { id: 't2', departmentId: 'd1', name: 'Vloer', kind: 'default', colour: '#1a7045' },
      { id: 't3', departmentId: 'd2', name: 'Inslag', kind: 'default', colour: '#8a5300' },
    ],
    employees,
    shiftTypes: [
      { id: 'st1', departmentId: 'd1', name: 'Vroege dienst', shortName: 'V', start: '08:00', end: '16:00', unpaidBreakMin: 30, paidBreakMin: 0, colourIndex: 1, hideEndTime: false },
      { id: 'st2', departmentId: 'd1', name: 'Late dienst', shortName: 'L', start: '14:00', end: '22:00', unpaidBreakMin: 30, paidBreakMin: 0, colourIndex: 3, hideEndTime: false },
      { id: 'st3', departmentId: 'd1', name: 'Tussendienst', shortName: 'T', start: '10:00', end: '18:00', unpaidBreakMin: 45, paidBreakMin: 0, colourIndex: 5, hideEndTime: false },
    ],
    shifts,
    invites: [],
    published: { d1: [], d2: [] },
    availability: [],
    absenceTypes: [
      { id: 'at1', name: 'Vakantie', balanceId: 'b1', colour: '#2f5bea' },
      { id: 'at2', name: 'Ziek', balanceId: null, colour: '#b42a2a' },
      { id: 'at3', name: 'Bijzonder verlof', balanceId: null, colour: '#8a5300' },
    ],
    balances: [{ id: 'b1', name: 'Vakantie-uren', unit: 'hours', accrualPerYear: 200 }],
    balanceEntries: employees.map((e, i) => ({ id: `be${i}`, employeeId: e.id, balanceId: 'b1', amount: 120, kind: 'accrual' as const, absenceId: null, date: today, note: 'Startsaldo' })),
    absences: [],
    exchanges: [],
    requiredShifts: [0, 1, 2, 3, 4].map((d, i) => ({ id: `r${i}`, departmentId: 'd1', teamId: 't1', date: addDays(w, d), start: '08:00', end: '16:00', mode: 'min' as const, count: 2 })),
    notifications: [],
    timesheet: [],
  };
}
