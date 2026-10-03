import type { DateStr, TimeStr } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
export const toDate = (d: DateStr) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
export const fmtDate = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: DateStr, n: number): DateStr => { const x = toDate(d); x.setDate(x.getDate() + n); return fmtDate(x); };
/** ISO weekday, 1 = Monday .. 7 = Sunday. */
export const isoWeekday = (d: DateStr) => { const w = toDate(d).getDay(); return w === 0 ? 7 : w; };
export const weekStart = (d: DateStr) => addDays(d, 1 - isoWeekday(d));
export const weekDays = (d: DateStr) => { const s = weekStart(d); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };
export const diffDays = (a: DateStr, b: DateStr) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
export const todayStr = () => fmtDate(new Date());

export const timeToMin = (t: TimeStr) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const minToTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** Length of a shift in minutes. An end at or before the start means it ends the next day. */
export function durationMin(start: TimeStr, end: TimeStr) {
  const s = timeToMin(start), e = timeToMin(end);
  return e > s ? e - s : e + 1440 - s;
}
export const paidHours = (start: TimeStr, end: TimeStr, unpaidBreakMin: number) =>
  Math.max(0, durationMin(start, end) - unpaidBreakMin) / 60;

/** Absolute minute range of a shift on a day, for overlap checks; overnight shifts extend past 1440. */
export function range(date: DateStr, start: TimeStr, end: TimeStr, epoch: DateStr) {
  const base = diffDays(epoch, date) * 1440;
  return [base + timeToMin(start), base + timeToMin(start) + durationMin(start, end)] as const;
}

export const WEEKDAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const fmtShort = (d: DateStr) => { const x = toDate(d); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };
export const fmtLong = (d: DateStr) => `${WEEKDAY_SHORT[isoWeekday(d) - 1]} ${fmtShort(d)}`;
