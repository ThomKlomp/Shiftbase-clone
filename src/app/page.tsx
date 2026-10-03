'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';
import { useStore } from '@/lib/store';
import { hasPermAnywhere } from '@/lib/domain';

export default function Home() {
  const { me, ready } = useSession();
  const state = useStore();
  const router = useRouter();
  useEffect(() => {
    if (ready && me) router.replace(hasPermAnywhere(state, me.id, 'schedule.edit') ? '/rooster' : '/mijn-rooster');
  }, [ready, me, state, router]);
  return null;
}
