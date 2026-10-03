'use client';
import { useSyncExternalStore } from 'react';
import type { State } from './types';
import { makeSeed } from './seed';

const KEY = 'rooster-demo-v1';
let state: State | null = null;
let serverState: State | null = null;
const listeners = new Set<() => void>();

/** Older saved demo data may lack newer fields. */
function migrate(s: State): State { s.audit ??= []; return s; }

function load(): State {
  if (state) return state;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return (state = migrate(JSON.parse(raw) as State));
    } catch { /* storage blocked: fall through to seed */ }
  }
  state = makeSeed();
  persist(state);
  return state;
}

function persist(s: State) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: stays in memory */ }
}

/** Another tab may have written since we last looked: take its version before changing anything. */
function syncFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = migrate(JSON.parse(raw) as State);
  } catch { /* keep memory copy */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    syncFromStorage();
    listeners.forEach((l) => l());
  });
}

export const getState = (): State => load();

export function setState(next: State) {
  state = next;
  persist(next);
  listeners.forEach((l) => l());
}
export function resetState(next: State = makeSeed()) { setState(next); }

/** Mutate a deep copy, then publish. All data-layer writes go through here. */
export function update<T>(fn: (draft: State) => T): T {
  load();
  syncFromStorage();
  const draft = structuredClone(state as State);
  const result = fn(draft);
  setState(draft);
  return result;
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useStore(): State {
  return useSyncExternalStore(subscribe, load, () => (serverState ??= makeSeed()));
}

let counter = 0;
export const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;
