'use client';
import { useState } from 'react';
import type { DateStr, ID } from '@/lib/types';
import { useStore } from '@/lib/store';
import { isPublished } from '@/lib/domain';
import { fmtLong, todayStr } from '@/lib/dates';
import * as api from '@/lib/api';
import { Button, Check_, Dialog, useAction, cx } from '../ui';
import { Check, Minus } from 'lucide-react';

export function PublishDialog({ open, onClose, actor, departmentId, days }: { open: boolean; onClose: () => void; actor: ID; departmentId: ID; days: DateStr[] }) {
  const state = useStore();
  const run = useAction();
  const [pick, setPick] = useState<Set<DateStr>>(new Set());
  const [notify, setNotify] = useState(true);
  const today = todayStr();
  const toggle = (d: DateStr) => setPick((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const sel = days.filter((d) => pick.has(d));
  const act = async (published: boolean) => { await run(() => api.setPublished(actor, departmentId, sel, published, notify), published ? 'Gepubliceerd' : 'Teruggezet naar concept'); setPick(new Set()); };
  return (
    <Dialog open={open} onClose={onClose} title="Rooster publiceren" footer={<Button onClick={onClose}>Klaar</Button>}>
      <p className="mb-3 text-text-muted">Medewerkers zien alleen gepubliceerde dagen. Kies dagen en publiceer ze, of zet ze terug naar concept.</p>
      <ul className="mb-3 flex flex-col gap-1">
        {days.map((d) => {
          const pub = isPublished(state, departmentId, d, today);
          const on = pick.has(d);
          return (
            <li key={d}>
              <button type="button" aria-pressed={on} onClick={() => toggle(d)}
                className={cx('flex min-h-[44px] w-full items-center gap-3 rounded-md border px-3 text-left', on ? 'border-accent bg-accent-soft' : 'border-border')}>
                <span className="flex-1 font-medium">{fmtLong(d)}</span>
                <span className={cx('inline-flex items-center gap-1 text-xs', pub ? 'text-success' : 'text-text-muted')}>{pub ? <Check size={14} aria-hidden /> : <Minus size={14} aria-hidden />}{pub ? 'Gepubliceerd' : 'Concept'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mb-3 flex gap-2"><Button size="sm" onClick={() => setPick(new Set(days))}>Alles kiezen</Button><Button size="sm" onClick={() => setPick(new Set())}>Niets kiezen</Button></div>
      <Check_ label="Medewerkers een melding sturen" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!sel.length} onClick={() => act(true)}>Publiceren</Button>
        <Button disabled={!sel.length} onClick={() => act(false)}>Terugzetten naar concept</Button>
      </div>
    </Dialog>
  );
}
