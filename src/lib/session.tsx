'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from './store';
import type { Employee } from './types';

const KEY = 'rooster-session-v1';
interface Session { me: Employee | null; ready: boolean; signIn: (id: string) => void; signOut: () => void }
const Ctx = createContext<Session>({ me: null, ready: false, signIn: () => {}, signOut: () => {} });

/** Demo sign-in: pick a person. The Supabase auth session replaces this provider. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const state = useStore();
  const [id, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setId(window.localStorage.getItem(KEY)); } catch { /* blocked */ }
    setReady(true);
  }, []);
  const signIn = useCallback((next: string) => { setId(next); try { window.localStorage.setItem(KEY, next); } catch { /* ignore */ } }, []);
  const signOut = useCallback(() => { setId(null); try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } }, []);
  const me = state.employees.find((e) => e.id === id && e.active) ?? null;
  return <Ctx.Provider value={{ me, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
