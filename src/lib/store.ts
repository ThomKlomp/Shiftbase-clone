'use client';
import { useSyncExternalStore } from 'react';
import type { State } from './types';
import { makeSeed } from './seed';

const KEY = 'rooster-demo-v1';
let state: State | null = null;
let serverState: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return (state = JSON.parse(raw) as State);
    } catch { /* storage blocked: fall through to seed */ }
  }
  return (state = makeSeed());
}

export const getState = (): State => load();

export function setState(next: State) {
  state = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function resetState(next: State = makeSeed()) { setState(next); }

/** Mutate a deep copy, then publish. All data-layer writes go through here. */
export function update<T>(fn: (draft: State) => T): T {
  const draft = structuredClone(load());
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
