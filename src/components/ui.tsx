'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, Check, CheckCircle2, Clock, X, XCircle } from 'lucide-react';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------- Button ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-accent text-on-accent hover:opacity-90',
    secondary: 'bg-surface text-text border border-border hover:bg-surface-sunken',
    ghost: 'text-text hover:bg-surface-sunken',
    danger: 'bg-danger text-on-accent hover:opacity-90',
  }[variant];
  const sz = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' }[size];
  return (
    <button {...p} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cx('inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed', v, sz, className)}>
      {loading && <span aria-hidden className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ---------- Form fields ----------
export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | null; hint?: string; children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode; htmlFor?: string }) {
  const id = useId();
  const fid = htmlFor ?? id;
  const dId = error || hint ? `${fid}-d` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fid} className="text-sm font-medium">{label}</label>
      {children({ id: fid, 'aria-describedby': dId, 'aria-invalid': error ? true : undefined })}
      {error ? <p id={dId} className="text-xs text-danger flex items-center gap-1"><AlertTriangle size={12} aria-hidden />{error}</p>
        : hint ? <p id={dId} className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
const inputCls = 'h-10 w-full rounded-md border border-border-input bg-bg px-3 text-sm disabled:bg-surface disabled:text-text-muted aria-[invalid=true]:border-danger';
export function Input(p: InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cx(inputCls, p.className)} />; }
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} className={cx(inputCls, p.className)} />; }
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...p} className={cx(inputCls, 'h-auto py-2', p.className)} />; }
export function Check_({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" {...p} className="h-4 w-4 accent-[var(--color-accent)]" />{label}</label>;
}

// ---------- Status badge (icon + text, never colour only) ----------
const BADGES = {
  pending: ['Wacht', 'bg-warning-soft text-warning', Clock], approved: ['Goedgekeurd', 'bg-success-soft text-success', CheckCircle2],
  declined: ['Afgewezen', 'bg-danger-soft text-danger', XCircle], invited: ['Uitgenodigd', 'bg-warning-soft text-warning', Clock],
  requested: ['Aangevraagd', 'bg-accent-soft text-accent', Clock], assigned: ['Ingedeeld', 'bg-success-soft text-success', Check],
  published: ['Gepubliceerd', 'bg-success-soft text-success', Check], draft: ['Concept', 'bg-surface-sunken text-text-muted', Clock],
  pending_colleague: ['Wacht op collega', 'bg-warning-soft text-warning', Clock], pending_manager: ['Wacht op planner', 'bg-accent-soft text-accent', Clock],
  rejected: ['Afgewezen', 'bg-danger-soft text-danger', XCircle], cancelled: ['Ingetrokken', 'bg-surface-sunken text-text-muted', X],
} as const;
export function Badge({ kind }: { kind: keyof typeof BADGES }) {
  const [label, cls, Icon] = BADGES[kind];
  return <span className={cx('inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium', cls)}><Icon size={12} aria-hidden />{label}</span>;
}

// ---------- Dialog (native <dialog>: focus trap, Esc, focus return) ----------
export function Dialog({ open, onClose, title, children, drawer, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby={titleId}
      className={cx('max-h-[100dvh] w-full overflow-hidden', drawer ? 'ml-auto mr-0 h-[100dvh] max-w-md rounded-none md:rounded-l-lg' : 'max-w-lg rounded-lg')}>
      {open && (
        <div className="flex max-h-[100dvh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Sluiten" className="rounded-md p-2 hover:bg-surface-sunken"><X size={18} aria-hidden /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// ---------- Toast ----------
type Toast = { id: number; text: string; kind: 'success' | 'error' | 'info' };
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Meldingen">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={cx('flex max-w-sm items-center gap-2 rounded-md px-4 py-3 text-sm shadow-pop',
              t.kind === 'error' ? 'bg-danger-soft text-danger' : t.kind === 'success' ? 'bg-success-soft text-success' : 'bg-surface text-text')}>
            {t.kind === 'error' ? <AlertTriangle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Runs an async write, toasts the outcome. Domain errors carry readable Dutch messages. */
export function useAction() {
  const toast = useToast();
  return useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try { const r = await fn(); if (ok) toast(ok); return r; }
    catch (e) { toast(e instanceof Error ? e.message : 'Er ging iets mis', 'error'); return undefined; }
  }, [toast]);
}

/** Like useAction but returns true on success, false on failure: use it when the caller must know (close a form). */
export function useTry() {
  const toast = useToast();
  return useCallback(async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => {
    try { await fn(); if (ok) toast(ok); return true; }
    catch (e) { toast(e instanceof Error ? e.message : 'Er ging iets mis', 'error'); return false; }
  }, [toast]);
}

// ---------- Misc ----------
export function Banner({ kind = 'warning', children }: { kind?: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  const c = { info: 'bg-accent-soft text-accent', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' }[kind];
  return <div role={kind === 'danger' ? 'alert' : 'status'} className={cx('flex items-start gap-2 rounded-md px-3 py-2 text-sm', c)}><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /><div>{children}</div></div>;
}
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-input p-8 text-center">
      <svg width="56" height="40" viewBox="0 0 56 40" fill="none" aria-hidden stroke="currentColor" className="text-text-muted"><rect x="4" y="6" width="48" height="28" rx="4" strokeWidth="2" /><path d="M4 14h48M16 6v-4M40 6v-4" strokeWidth="2" strokeLinecap="round" /></svg>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-text-muted">{text}</p>}
      {action}
    </div>
  );
}
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">{title}</h1><div className="flex flex-wrap items-center gap-2">{children}</div></div>;
}
export const Avatar = ({ name, size = 32 }: { name: string; size?: number }) => (
  <span aria-hidden style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-pill bg-accent-soft text-xs font-semibold text-accent">
    {name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
  </span>
);
