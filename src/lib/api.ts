import type {
  Absence, AbsenceStatus, AbsenceType, Availability, AvailabilityKind, DateStr, Employee, ID, Invite,
  Perm, RequiredShift, Shift, ShiftAction, ShiftType, State, Team,
} from './types';
import { getState, update, uid } from './store';
import { addDays, diffDays, fmtShort, todayStr, weekStart } from './dates';
import { absenceWarnings, expandRecurrence, hasPerm, openAssigned } from './domain';

/**
 * The data layer. Every function is async and takes the acting employee, so the
 * Supabase implementation can replace this file without touching a screen.
 * Permission checks live here, not in the UI.
 */
export class Forbidden extends Error { constructor(what: string) { super(`Geen rechten: ${what}`); } }
export class Conflict extends Error {}

function need(s: State, actor: ID, dept: ID, perm: Perm) {
  if (!hasPerm(s, actor, dept, perm)) throw new Forbidden(perm);
}
function log(s: State, actor: ID, text: string) {
  s.audit.unshift({ id: uid('au'), at: new Date().toISOString(), actorId: actor, text });
  if (s.audit.length > 500) s.audit.length = 500;
}
const shiftText = (s: State, sh: Shift) => {
  const e = s.employees.find((x) => x.id === sh.employeeId);
  return `${sh.date} ${sh.start}–${sh.end}${e ? ` (${e.firstName} ${e.lastName})` : ' (open dienst)'}`;
};
function notify(s: State, employeeIds: ID[], kind: string, text: string, href: string, except?: ID) {
  const at = new Date().toISOString();
  for (const id of new Set(employeeIds)) {
    if (id === except) continue;
    s.notifications.unshift({ id: uid('n'), employeeId: id, kind, text, href, readAt: null, createdAt: at });
  }
}
const plannersOf = (s: State, dept: ID, perm: Perm) =>
  s.employees.filter((e) => hasPerm(s, e.id, dept, perm)).map((e) => e.id);

export type ShiftInput = Omit<Shift, 'id' | 'seriesId' | 'openSourceId'> & {
  repeat?: { weekdays: number[]; everyNWeeks: number; endsOn: DateStr | null };
};

// ---------- shifts ----------
export async function createShift(actor: ID, input: ShiftInput, sendNotification = false): Promise<Shift[]> {
  return update((s) => {
    need(s, actor, input.departmentId, 'schedule.edit');
    if (!input.employeeId && !input.neededCount) throw new Error('Een open dienst heeft een aantal nodig');
    const { repeat, ...base } = input;
    const dates = repeat
      ? expandRecurrence(input.date, repeat.weekdays, repeat.everyNWeeks, repeat.endsOn, addDays(input.date, 90))
      : [input.date];
    const seriesId = repeat ? uid('series') : null;
    const created = dates.map((date) => ({ ...base, date, id: uid('s'), seriesId, openSourceId: null }) as Shift);
    s.shifts.push(...created);
    log(s, actor, `Dienst toegevoegd: ${shiftText(s, created[0])}${created.length > 1 ? ` en ${created.length - 1} herhalingen` : ''}`);
    if (sendNotification && input.employeeId) {
      notify(s, [input.employeeId], 'shift', `Nieuwe dienst op ${fmtShort(input.date)}`, '/mijn-rooster', actor);
    }
    return created;
  });
}

export type ShiftPatch = Partial<Pick<Shift, 'teamId' | 'shiftTypeId' | 'employeeId' | 'date' | 'start' | 'end' | 'unpaidBreakMin' | 'paidBreakMin' | 'hideEndTime' | 'description' | 'neededCount'>>;

/** scope 'future' also edits later shifts of the same series (the date shifts by the same offset). */
export async function updateShift(actor: ID, id: ID, patch: ShiftPatch, scope: 'this' | 'future' = 'this', sendNotification = false) {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === id);
    if (!sh) throw new Error('Dienst niet gevonden');
    need(s, actor, sh.departmentId, 'schedule.edit');
    const before = shiftText(s, sh);
    const delta = patch.date ? diffDays(sh.date, patch.date) : 0;
    const targets = scope === 'future' && sh.seriesId
      ? s.shifts.filter((x) => x.seriesId === sh.seriesId && x.date >= sh.date)
      : [sh];
    for (const t of targets) {
      const { date: _d, ...rest } = patch;
      Object.assign(t, rest);
      if (patch.date) t.date = addDays(t.date, delta);
      if (patch.employeeId === null && !t.neededCount) t.neededCount = 1;
      if (patch.employeeId) t.neededCount = null;
    }
    log(s, actor, `Dienst gewijzigd: ${before} → ${shiftText(s, sh)}${targets.length > 1 ? ` (en ${targets.length - 1} volgende)` : ''}`);
    if (sendNotification && sh.employeeId) notify(s, [sh.employeeId], 'shift', `Je dienst op ${fmtShort(sh.date)} is gewijzigd`, '/mijn-rooster', actor);
  });
}

export async function deleteShift(actor: ID, id: ID, scope: 'this' | 'future' = 'this', sendNotification = false) {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === id);
    if (!sh) return;
    need(s, actor, sh.departmentId, 'schedule.edit');
    const doomed = scope === 'future' && sh.seriesId
      ? s.shifts.filter((x) => x.seriesId === sh.seriesId && x.date >= sh.date)
      : [sh];
    const ids = new Set(doomed.map((x) => x.id));
    log(s, actor, `Dienst verwijderd: ${shiftText(s, sh)}${doomed.length > 1 ? ` (en ${doomed.length - 1} volgende)` : ''}`);
    if (sendNotification) notify(s, doomed.map((x) => x.employeeId).filter(Boolean) as ID[], 'shift', `Een dienst is verwijderd`, '/mijn-rooster', actor);
    s.shifts = s.shifts.filter((x) => !ids.has(x.id));
    s.invites = s.invites.filter((i) => !ids.has(i.shiftId));
    s.exchanges = s.exchanges.filter((e) => !ids.has(e.shiftId));
  });
}

export async function copyShift(actor: ID, id: ID, target: { date: DateStr; employeeId?: ID | null; teamId?: ID }) {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === id);
    if (!sh) throw new Error('Dienst niet gevonden');
    need(s, actor, sh.departmentId, 'schedule.edit');
    const copy: Shift = { ...sh, id: uid('s'), seriesId: null, openSourceId: null, date: target.date };
    if (target.employeeId !== undefined) { copy.employeeId = target.employeeId; copy.neededCount = target.employeeId ? null : sh.neededCount ?? 1; }
    if (target.teamId) copy.teamId = target.teamId;
    s.shifts.push(copy);
    log(s, actor, `Dienst gekopieerd naar ${shiftText(s, copy)}`);
    return copy;
  });
}

export async function copyWeek(actor: ID, departmentId: ID, fromDate: DateStr, toDate: DateStr): Promise<number> {
  return update((s) => {
    need(s, actor, departmentId, 'schedule.edit');
    const from = weekStart(fromDate), to = weekStart(toDate);
    const offset = diffDays(from, to);
    if (offset === 0) throw new Conflict('Kies een andere week om naartoe te kopiëren');
    const src = s.shifts.filter((x) => x.departmentId === departmentId && x.date >= from && x.date <= addDays(from, 6) && !x.openSourceId);
    for (const x of src) s.shifts.push({ ...x, id: uid('s'), seriesId: null, date: addDays(x.date, offset) });
    log(s, actor, `Week gekopieerd: ${src.length} diensten van ${from} naar ${to}`);
    return src.length;
  });
}

// ---------- publishing ----------
export async function setPublished(actor: ID, departmentId: ID, days: DateStr[], published: boolean, sendNotification = true) {
  return update((s) => {
    need(s, actor, departmentId, 'schedule.publish');
    const cur = new Set(s.published[departmentId] ?? []);
    const newly: DateStr[] = [];
    for (const d of days) {
      if (published && !cur.has(d)) { cur.add(d); newly.push(d); }
      if (!published) cur.delete(d);
    }
    s.published[departmentId] = [...cur].sort();
    log(s, actor, `${published ? 'Gepubliceerd' : 'Teruggezet naar concept'}: ${days.length} dag(en) van ${s.departments.find((d) => d.id === departmentId)?.name}`);
    if (published && sendNotification && newly.length) {
      const people = s.shifts.filter((x) => x.departmentId === departmentId && newly.includes(x.date) && x.employeeId).map((x) => x.employeeId as ID);
      notify(s, people, 'publish', 'Het rooster is gepubliceerd', '/mijn-rooster', actor);
    }
  });
}

// ---------- open shifts ----------
export async function inviteToOpenShift(actor: ID, shiftId: ID, employeeIds: ID[]) {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === shiftId);
    if (!sh || sh.employeeId) throw new Error('Geen open dienst');
    need(s, actor, sh.departmentId, 'schedule.edit');
    for (const id of employeeIds) {
      if (!s.invites.some((i) => i.shiftId === shiftId && i.employeeId === id)) {
        s.invites.push({ id: uid('i'), shiftId, employeeId: id, status: 'invited' });
      }
    }
    notify(s, employeeIds, 'open_shift', `Open dienst op ${fmtShort(sh.date)}`, '/open-diensten', actor);
  });
}

export async function respondToOpenShift(employeeId: ID, shiftId: ID, action: 'request' | 'decline') {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === shiftId);
    const inv = s.invites.find((i) => i.shiftId === shiftId && i.employeeId === employeeId);
    if (!sh || sh.employeeId || !inv) throw new Error('Geen uitnodiging');
    if (inv.status === 'assigned') throw new Conflict('Je bent al ingedeeld');
    if (action === 'decline') { inv.status = 'declined'; return; }
    const dept = s.departments.find((d) => d.id === sh.departmentId)!;
    if (dept.openShiftNeedsApproval) {
      inv.status = 'requested';
      notify(s, plannersOf(s, sh.departmentId, 'schedule.edit'), 'open_request', `Aanvraag voor open dienst op ${fmtShort(sh.date)}`, '/open-diensten');
    } else {
      // first come, first served
      if (openAssigned(s, sh) >= (sh.neededCount ?? 1)) throw new Conflict('Deze dienst is al vol');
      assignInPlace(s, sh, inv);
    }
  });
}

function assignInPlace(s: State, open: Shift, inv: Invite) {
  s.shifts.push({ ...open, id: uid('s'), employeeId: inv.employeeId, neededCount: null, openSourceId: open.id, seriesId: null });
  inv.status = 'assigned';
  if (openAssigned(s, open) >= (open.neededCount ?? 1)) {
    // full: other pending invites are closed
    for (const i of s.invites) if (i.shiftId === open.id && i.status !== 'assigned') i.status = 'declined';
  }
}

export async function assignOpenShift(actor: ID, shiftId: ID, employeeId: ID) {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === shiftId);
    if (!sh || sh.employeeId) throw new Error('Geen open dienst');
    need(s, actor, sh.departmentId, 'schedule.edit');
    if (openAssigned(s, sh) >= (sh.neededCount ?? 1)) throw new Conflict('Deze dienst is al vol');
    let inv = s.invites.find((i) => i.shiftId === shiftId && i.employeeId === employeeId);
    if (!inv) { inv = { id: uid('i'), shiftId, employeeId, status: 'invited' }; s.invites.push(inv); }
    assignInPlace(s, sh, inv);
    log(s, actor, `Open dienst ingedeeld: ${shiftText(s, sh)} → ${s.employees.find((e) => e.id === employeeId)?.firstName}`);
    notify(s, [employeeId], 'open_shift', `Je bent ingedeeld op ${fmtShort(sh.date)}`, '/mijn-rooster', actor);
  });
}

// ---------- availability ----------
export async function setAvailability(actor: ID, employeeId: ID, entries: { date: DateStr; kind: AvailabilityKind | null; from?: string | null }[]) {
  return update((s) => {
    const target = s.employees.find((e) => e.id === employeeId);
    if (!target) throw new Error('Medewerker niet gevonden');
    if (actor !== employeeId && !target.teamIds.some((t) => { const team = s.teams.find((x) => x.id === t); return team && hasPerm(s, actor, team.departmentId, 'availability.edit_others'); })) {
      throw new Forbidden('availability.edit_others');
    }
    for (const e of entries) {
      s.availability = s.availability.filter((a) => !(a.employeeId === employeeId && a.date === e.date));
      if (!e.kind) continue;
      const needsTime = e.kind === 'available_from' || e.kind === 'unavailable_from';
      if (needsTime && !e.from) throw new Error('Kies een tijd');
      const a: Availability = { id: uid('a'), employeeId, date: e.date, kind: e.kind, from: needsTime ? e.from! : null };
      s.availability.push(a);
    }
  });
}

// ---------- absence ----------
export async function requestAbsence(actor: ID, input: Omit<Absence, 'id' | 'status' | 'decidedBy'>, autoApprove = false) {
  return update((s) => {
    const emp = s.employees.find((e) => e.id === input.employeeId);
    if (!emp) throw new Error('Medewerker niet gevonden');
    if (input.end < input.start) throw new Error('Einddatum ligt voor de begindatum');
    if (!(input.amount > 0)) throw new Error('Vul een aantal uren of dagen in');
    const depts = emp.teamIds.map((t) => s.teams.find((x) => x.id === t)!.departmentId);
    const isApprover = depts.some((d) => hasPerm(s, actor, d, 'absence.approve'));
    if (actor !== input.employeeId && !isApprover) throw new Forbidden('absence.approve');
    const abs: Absence = { ...input, id: uid('ab'), status: 'pending', decidedBy: null };
    s.absences.push(abs);
    if (autoApprove && isApprover) applyDecision(s, abs, 'approved', actor);
    else notify(s, depts.flatMap((d) => plannersOf(s, d, 'absence.approve')), 'absence_request', `${emp.firstName} vraagt verlof aan (${fmtShort(abs.start)})`, '/verlof', actor);
    return abs;
  });
}

function applyDecision(s: State, abs: Absence, status: AbsenceStatus, by: ID) {
  abs.status = status; abs.decidedBy = by;
  log(s, by, `Verlof ${status === 'approved' ? 'goedgekeurd' : 'afgewezen'}: ${s.employees.find((e) => e.id === abs.employeeId)?.firstName} ${abs.start}–${abs.end}`);
  const type = s.absenceTypes.find((t) => t.id === abs.typeId);
  s.balanceEntries = s.balanceEntries.filter((e) => e.absenceId !== abs.id);
  if (status === 'approved') {
    if (type?.balanceId) s.balanceEntries.push({ id: uid('be'), employeeId: abs.employeeId, balanceId: type.balanceId, amount: -abs.amount, kind: 'usage', absenceId: abs.id, date: abs.start, note: type.name });
    const mine = s.shifts.filter((x) => x.employeeId === abs.employeeId && x.date >= abs.start && x.date <= abs.end);
    const ids = new Set(mine.map((x) => x.id));
    if (abs.shiftAction === 'remove') s.shifts = s.shifts.filter((x) => !ids.has(x.id));
    if (abs.shiftAction === 'make_open') for (const x of mine) { x.employeeId = null; x.neededCount = 1; }
  }
  notify(s, [abs.employeeId], 'absence_decision', `Je verlof is ${status === 'approved' ? 'goedgekeurd' : 'afgewezen'}`, '/verlof', by);
}

/** Approving a request that would take the balance below zero needs `override`. */
export async function decideAbsence(actor: ID, id: ID, status: 'approved' | 'declined', override = false) {
  return update((s) => {
    const abs = s.absences.find((x) => x.id === id);
    if (!abs) throw new Error('Aanvraag niet gevonden');
    const emp = s.employees.find((e) => e.id === abs.employeeId)!;
    const depts = emp.teamIds.map((t) => s.teams.find((x) => x.id === t)!.departmentId);
    if (!depts.some((d) => hasPerm(s, actor, d, 'absence.approve'))) throw new Forbidden('absence.approve');
    if (abs.status !== 'pending') throw new Conflict('Deze aanvraag is al behandeld');
    if (status === 'approved' && !override && absenceWarnings(s, abs).some((w) => w.kind === 'balance')) {
      throw new Conflict('Saldo is niet genoeg. Keur alleen goed met overschrijven.');
    }
    applyDecision(s, abs, status, actor);
    return abs;
  });
}

export async function deleteAbsence(actor: ID, id: ID) {
  return update((s) => {
    const abs = s.absences.find((x) => x.id === id);
    if (!abs) return;
    const emp = s.employees.find((e) => e.id === abs.employeeId)!;
    const depts = emp.teamIds.map((t) => s.teams.find((x) => x.id === t)!.departmentId);
    const mayDelete = depts.some((d) => hasPerm(s, actor, d, 'absence.approve')) || (actor === abs.employeeId && abs.status === 'pending');
    if (!mayDelete) throw new Forbidden('absence.approve');
    s.absences = s.absences.filter((x) => x.id !== id);
    s.balanceEntries = s.balanceEntries.filter((e) => e.absenceId !== id);
  });
}

export async function correctBalance(actor: ID, employeeId: ID, balanceId: ID, amount: number, note: string) {
  return update((s) => {
    const emp = s.employees.find((e) => e.id === employeeId)!;
    const depts = emp.teamIds.map((t) => s.teams.find((x) => x.id === t)!.departmentId);
    if (!depts.some((d) => hasPerm(s, actor, d, 'absence.approve'))) throw new Forbidden('absence.approve');
    log(s, actor, `Saldo gecorrigeerd: ${emp.firstName} ${amount > 0 ? '+' : ''}${amount} (${note})`);
    s.balanceEntries.push({ id: uid('be'), employeeId, balanceId, amount, kind: 'correction', absenceId: null, date: todayStr(), note });
  });
}

// ---------- exchanges ----------
export async function requestExchange(actor: ID, shiftId: ID) {
  return update((s) => {
    const sh = s.shifts.find((x) => x.id === shiftId);
    if (!sh || sh.employeeId !== actor) throw new Forbidden('alleen je eigen diensten');
    if (s.exchanges.some((e) => e.shiftId === shiftId && (e.status === 'pending_colleague' || e.status === 'pending_manager'))) throw new Conflict('Er loopt al een ruilverzoek');
    const ex = { id: uid('x'), shiftId, fromEmployeeId: actor, toEmployeeId: null, status: 'pending_colleague' as const };
    s.exchanges.push(ex);
    const team = s.teams.find((t) => t.id === sh.teamId)!;
    const colleagues = s.employees.filter((e) => e.id !== actor && e.active && e.teamIds.some((t) => s.teams.find((x) => x.id === t)?.departmentId === team.departmentId)).map((e) => e.id);
    notify(s, colleagues, 'exchange', `Ruilverzoek voor ${fmtShort(sh.date)}`, '/ruilen', actor);
    return ex;
  });
}

export async function acceptExchange(actor: ID, exchangeId: ID) {
  return update((s) => {
    const ex = s.exchanges.find((e) => e.id === exchangeId);
    if (!ex) throw new Error('Verzoek niet gevonden');
    if (ex.status !== 'pending_colleague') throw new Conflict('Een collega was je voor');
    if (ex.fromEmployeeId === actor) throw new Forbidden('je eigen verzoek');
    const sh = s.shifts.find((x) => x.id === ex.shiftId)!;
    ex.toEmployeeId = actor;
    if (hasPerm(s, actor, sh.departmentId, 'exchange.approve_incoming')) {
      ex.status = 'approved'; ex.toEmployeeId = actor; sh.employeeId = actor;
      notify(s, [ex.fromEmployeeId], 'exchange', 'Je ruil is goedgekeurd', '/ruilen', actor);
    } else {
      ex.status = 'pending_manager';
      notify(s, plannersOf(s, sh.departmentId, 'exchange.approve'), 'exchange_review', `Ruil wacht op goedkeuring (${fmtShort(sh.date)})`, '/ruilen', actor);
    }
  });
}

export async function decideExchange(actor: ID, exchangeId: ID, approve: boolean) {
  return update((s) => {
    const ex = s.exchanges.find((e) => e.id === exchangeId);
    if (!ex) throw new Error('Verzoek niet gevonden');
    const sh = s.shifts.find((x) => x.id === ex.shiftId)!;
    need(s, actor, sh.departmentId, 'exchange.approve');
    if (ex.status !== 'pending_manager') throw new Conflict('Dit verzoek wacht niet op goedkeuring');
    ex.status = approve ? 'approved' : 'rejected';
    log(s, actor, `Ruil ${approve ? 'goedgekeurd' : 'afgewezen'}: ${shiftText(s, sh)}`);
    if (approve && ex.toEmployeeId) sh.employeeId = ex.toEmployeeId;
    notify(s, [ex.fromEmployeeId, ex.toEmployeeId].filter(Boolean) as ID[], 'exchange', `Ruil ${approve ? 'goedgekeurd' : 'afgewezen'}`, '/ruilen', actor);
  });
}

export async function cancelExchange(actor: ID, exchangeId: ID) {
  return update((s) => {
    const ex = s.exchanges.find((e) => e.id === exchangeId);
    if (!ex || ex.fromEmployeeId !== actor) throw new Forbidden('alleen je eigen verzoek');
    if (ex.status === 'pending_colleague' || ex.status === 'pending_manager') ex.status = 'cancelled';
  });
}

// ---------- required shifts ----------
export async function upsertRequiredShift(actor: ID, r: Omit<RequiredShift, 'id'> & { id?: ID }) {
  return update((s) => {
    need(s, actor, r.departmentId, 'schedule.edit');
    if (r.id) { const i = s.requiredShifts.findIndex((x) => x.id === r.id); if (i >= 0) { s.requiredShifts[i] = { ...r, id: r.id }; return; } }
    s.requiredShifts.push({ ...r, id: uid('r') });
  });
}
export async function deleteRequiredShift(actor: ID, id: ID) {
  return update((s) => {
    const r = s.requiredShifts.find((x) => x.id === id);
    if (!r) return;
    need(s, actor, r.departmentId, 'schedule.edit');
    s.requiredShifts = s.requiredShifts.filter((x) => x.id !== id);
  });
}

// ---------- people ----------
export async function addEmployee(actor: ID, e: { firstName: string; lastName: string; email: string; teamIds: ID[]; groupId: ID; hoursPerWeek: number }): Promise<Employee> {
  return update((s) => {
    const depts = [...new Set(e.teamIds.map((t) => s.teams.find((x) => x.id === t)!.departmentId))];
    if (!depts.length) throw new Error('Kies minstens één team');
    for (const d of depts) need(s, actor, d, 'employees.manage');
    if (s.employees.some((x) => x.email.toLowerCase() === e.email.toLowerCase())) throw new Conflict('Dit e-mailadres bestaat al');
    const emp: Employee = { id: uid('e'), firstName: e.firstName, lastName: e.lastName, email: e.email, active: true, teamIds: e.teamIds, hoursPerWeek: e.hoursPerWeek, groupByDept: Object.fromEntries(depts.map((d) => [d, e.groupId])) };
    s.employees.push(emp);
    log(s, actor, `Medewerker toegevoegd: ${emp.firstName} ${emp.lastName}`);
    return emp;
  });
}
export async function setEmployeeActive(actor: ID, id: ID, active: boolean) {
  return update((s) => {
    const emp = s.employees.find((e) => e.id === id);
    if (!emp) return;
    if (!emp.teamIds.some((t) => hasPerm(s, actor, s.teams.find((x) => x.id === t)!.departmentId, 'employees.manage'))) throw new Forbidden('employees.manage');
    emp.active = active;
    log(s, actor, `${emp.firstName} ${emp.lastName} ${active ? 'geactiveerd' : 'gedeactiveerd'}`);
  });
}

// ---------- settings ----------
function needSettings(s: State, actor: ID) {
  if (!s.departments.some((d) => hasPerm(s, actor, d.id, 'settings.manage'))) throw new Forbidden('settings.manage');
}
export async function upsertShiftType(actor: ID, t: Omit<ShiftType, 'id'> & { id?: ID }) {
  return update((s) => {
    needSettings(s, actor);
    if (!t.name.trim()) throw new Error('Geef het dienstsjabloon een naam');
    if (t.id) { const i = s.shiftTypes.findIndex((x) => x.id === t.id); if (i >= 0) { s.shiftTypes[i] = { ...t, id: t.id }; return; } }
    s.shiftTypes.push({ ...t, id: uid('st') });
  });
}
export async function deleteShiftType(actor: ID, id: ID) {
  return update((s) => { needSettings(s, actor); s.shiftTypes = s.shiftTypes.filter((x) => x.id !== id); for (const sh of s.shifts) if (sh.shiftTypeId === id) sh.shiftTypeId = null; });
}
export async function upsertTeam(actor: ID, t: Omit<Team, 'id'> & { id?: ID }) {
  return update((s) => {
    needSettings(s, actor);
    if (t.id) { const i = s.teams.findIndex((x) => x.id === t.id); if (i >= 0) { s.teams[i] = { ...t, id: t.id }; return; } }
    s.teams.push({ ...t, id: uid('t') });
  });
}
export async function upsertAbsenceType(actor: ID, t: Omit<AbsenceType, 'id'> & { id?: ID }) {
  return update((s) => {
    needSettings(s, actor);
    if (t.id) { const i = s.absenceTypes.findIndex((x) => x.id === t.id); if (i >= 0) { s.absenceTypes[i] = { ...t, id: t.id }; return; } }
    s.absenceTypes.push({ ...t, id: uid('at') });
  });
}
export async function setPublishWindow(actor: ID, departmentId: ID, days: number | null) {
  return update((s) => { need(s, actor, departmentId, 'settings.manage'); const d = s.departments.find((x) => x.id === departmentId)!; d.publishDaysAhead = days; });
}
export async function setOpenShiftApproval(actor: ID, departmentId: ID, on: boolean) {
  return update((s) => { need(s, actor, departmentId, 'settings.manage'); s.departments.find((x) => x.id === departmentId)!.openShiftNeedsApproval = on; });
}

// ---------- notifications ----------
export async function markNotificationsRead(employeeId: ID) {
  return update((s) => { const at = new Date().toISOString(); for (const n of s.notifications) if (n.employeeId === employeeId && !n.readAt) n.readAt = at; });
}

// ---------- timesheet ----------
export async function clockIn(employeeId: ID, departmentId: ID) {
  return update((s) => {
    if (s.timesheet.some((t) => t.employeeId === employeeId && t.end === null)) throw new Conflict('Je bent al ingeklokt');
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
    s.timesheet.push({ id: uid('ts'), employeeId, departmentId, date: todayStr(), start: `${hh}:${mm}`, end: null, unpaidBreakMin: 0, status: 'pending' });
  });
}
export async function clockOut(employeeId: ID) {
  return update((s) => {
    const t = s.timesheet.find((x) => x.employeeId === employeeId && x.end === null);
    if (!t) throw new Conflict('Je bent niet ingeklokt');
    const now = new Date();
    t.end = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
}
/** Planner closes a forgotten clock-in at a chosen time. */
export async function fixClockOut(actor: ID, id: ID, end: string) {
  return update((s) => {
    const t = s.timesheet.find((x) => x.id === id);
    if (!t) throw new Error('Registratie niet gevonden');
    need(s, actor, t.departmentId, 'timesheet.approve');
    if (t.end !== null) throw new Conflict('Deze registratie is al afgesloten');
    if (!/^\d{2}:\d{2}$/.test(end)) throw new Error('Vul een geldige eindtijd in');
    t.end = end;
    log(s, actor, `Vergeten uitklokken hersteld: ${s.employees.find((e) => e.id === t.employeeId)?.firstName} ${t.date} ${t.start}–${end}`);
  });
}

export async function decideTimesheet(actor: ID, ids: ID[], status: 'approved' | 'declined' | 'pending') {
  return update((s) => {
    for (const id of ids) {
      const t = s.timesheet.find((x) => x.id === id);
      if (!t) continue;
      need(s, actor, t.departmentId, 'timesheet.approve');
      if (t.end === null) throw new Conflict('Een lopende registratie kan nog niet worden beoordeeld');
      t.status = status;
    }
  });
}

export const snapshot = () => getState();
