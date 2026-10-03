export type ID = string;
/** 'YYYY-MM-DD' local calendar date, 'HH:MM' local time. The fake data layer works in local time; the real one adds timezone. */
export type DateStr = string;
export type TimeStr = string;

export type Perm =
  | 'schedule.edit' | 'schedule.publish' | 'absence.approve' | 'exchange.approve'
  | 'exchange.approve_incoming' | 'availability.edit_others' | 'timesheet.approve'
  | 'employees.manage' | 'settings.manage';

export interface PermissionGroup { id: ID; name: string; permissions: Perm[] }
export interface Team { id: ID; departmentId: ID; name: string; kind: 'default' | 'flexpool' | 'hidden'; colour: string }
export interface Department {
  id: ID; name: string; locationName: string; timezone: string;
  publishDaysAhead: number | null; // null = org default
  openShiftNeedsApproval: boolean;
}
export interface Employee {
  id: ID; firstName: string; lastName: string; email: string; active: boolean;
  teamIds: ID[]; groupByDept: Record<ID, ID>; hoursPerWeek: number;
}
export interface ShiftType {
  id: ID; departmentId: ID; name: string; shortName: string; start: TimeStr; end: TimeStr;
  unpaidBreakMin: number; paidBreakMin: number; colourIndex: number; hideEndTime: boolean;
}
export interface Shift {
  id: ID; departmentId: ID; teamId: ID; shiftTypeId: ID | null;
  employeeId: ID | null; // null = open shift
  seriesId: ID | null; openSourceId: ID | null;
  date: DateStr; start: TimeStr; end: TimeStr;
  unpaidBreakMin: number; paidBreakMin: number; hideEndTime: boolean;
  description: string; neededCount: number | null;
}
export type InviteStatus = 'invited' | 'requested' | 'declined' | 'assigned';
export interface Invite { id: ID; shiftId: ID; employeeId: ID; status: InviteStatus }
export type AvailabilityKind = 'available_all_day' | 'available_from' | 'unavailable_all_day' | 'unavailable_from';
export interface Availability { id: ID; employeeId: ID; date: DateStr; kind: AvailabilityKind; from: TimeStr | null }
export interface AbsenceType { id: ID; name: string; balanceId: ID | null; colour: string }
export interface Balance { id: ID; name: string; unit: 'hours' | 'days'; accrualPerYear: number }
export interface BalanceEntry { id: ID; employeeId: ID; balanceId: ID; amount: number; kind: 'accrual' | 'usage' | 'correction' | 'expiry'; absenceId: ID | null; date: DateStr; note: string }
export type AbsenceStatus = 'pending' | 'approved' | 'declined';
export type ShiftAction = 'leave' | 'remove' | 'make_open';
export interface Absence {
  id: ID; employeeId: ID; typeId: ID; start: DateStr; end: DateStr; partialStart: TimeStr | null;
  amount: number; note: string; status: AbsenceStatus; decidedBy: ID | null; shiftAction: ShiftAction;
}
export type ExchangeStatus = 'pending_colleague' | 'pending_manager' | 'approved' | 'rejected' | 'cancelled';
export interface Exchange { id: ID; shiftId: ID; fromEmployeeId: ID; toEmployeeId: ID | null; status: ExchangeStatus }
export interface RequiredShift { id: ID; departmentId: ID; teamId: ID; date: DateStr; start: TimeStr; end: TimeStr; mode: 'min' | 'max' | 'exact'; count: number }
export interface Notification { id: ID; employeeId: ID; kind: string; text: string; href: string; readAt: string | null; createdAt: string }
export interface TimesheetEntry { id: ID; employeeId: ID; departmentId: ID; date: DateStr; start: TimeStr; end: TimeStr | null; unpaidBreakMin: number; status: 'pending' | 'approved' | 'declined' }

export interface AuditEntry { id: ID; at: string; actorId: ID; text: string }

export interface State {
  orgName: string;
  orgPublishDaysAhead: number;
  groups: PermissionGroup[];
  departments: Department[];
  teams: Team[];
  employees: Employee[];
  shiftTypes: ShiftType[];
  shifts: Shift[];
  invites: Invite[];
  published: Record<ID, DateStr[]>; // departmentId -> published days
  availability: Availability[];
  absenceTypes: AbsenceType[];
  balances: Balance[];
  balanceEntries: BalanceEntry[];
  absences: Absence[];
  exchanges: Exchange[];
  requiredShifts: RequiredShift[];
  notifications: Notification[];
  timesheet: TimesheetEntry[];
  audit: AuditEntry[];
}
