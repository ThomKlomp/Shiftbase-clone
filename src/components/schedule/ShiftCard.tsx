'use client';
import { AlertTriangle, Coffee, UserPlus } from 'lucide-react';
import type { Shift, ShiftType, State } from '@/lib/types';
import { conflictsFor } from '@/lib/domain';
import { cx } from '../ui';

export const shiftColour = (n: number) => ({ background: `var(--color-shift-${(n % 8) + 1})`, color: `var(--color-shift-${(n % 8) + 1}-text)` });

export function shiftLabel(s: Shift, type?: ShiftType | null) {
  const t = s.hideEndTime ? s.start : `${s.start}–${s.end}`;
  return { time: t, name: type?.shortName || type?.name || '' };
}

export function ShiftCard({ shift, state, onOpen, draggable, onDragStart, compact }: {
  shift: Shift; state: State; onOpen: () => void; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; compact?: boolean;
}) {
  const type = state.shiftTypes.find((t) => t.id === shift.shiftTypeId) ?? null;
  const { time, name } = shiftLabel(shift, type);
  const conflicts = conflictsFor(state, shift);
  const open = !shift.employeeId;
  const requested = open && state.invites.some((i) => i.shiftId === shift.id && i.status === 'requested');
  const unpublished = false;
  const assigned = open ? state.shifts.filter((x) => x.openSourceId === shift.id).length : 0;
  const label = `${open ? `Open dienst, ${assigned} van ${shift.neededCount} ingedeeld` : 'Dienst'} ${shift.date} ${time} ${name}${conflicts.length ? `. Let op: ${conflicts.map((c) => c.text).join(', ')}` : ''}`;
  return (
    <button type="button" onClick={onOpen} draggable={draggable} onDragStart={onDragStart} aria-label={label}
      style={shiftColour(type?.colourIndex ?? 7)}
      className={cx('group relative flex w-full flex-col rounded-sm px-2 text-left text-xs leading-4 transition-shadow hover:shadow-card active:cursor-grabbing',
        compact ? 'min-h-[20px] py-0' : 'min-h-[28px] py-1', open ? 'border border-dashed border-current' : 'border border-transparent', unpublished && 'border-dotted')}>
      <span className="flex items-center gap-1 whitespace-nowrap font-semibold">
        {time}
        {shift.unpaidBreakMin + shift.paidBreakMin > 0 && !compact && <Coffee size={10} aria-hidden />}
        {conflicts.length > 0 && <AlertTriangle size={11} className="ml-auto" aria-hidden />}
        {open && <span className="ml-auto flex items-center gap-0.5"><UserPlus size={11} aria-hidden />{assigned}/{shift.neededCount}</span>}
      </span>
      {!compact && name && <span className="truncate opacity-90">{name}{requested ? ' · aanvraag' : ''}</span>}
    </button>
  );
}
