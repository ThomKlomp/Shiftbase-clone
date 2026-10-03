'use client';
import { useRouter } from 'next/navigation';
import { useStore, resetState } from '@/lib/store';
import { useSession } from '@/lib/session';
import { hasPermAnywhere } from '@/lib/domain';
import { BRAND } from '@/lib/brand';
import { Avatar, Button, Banner } from '@/components/ui';

export default function Login() {
  const state = useStore();
  const { signIn } = useSession();
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-xl font-bold">{BRAND.name}</h1>
      <p className="text-text-muted">{BRAND.tagline}</p>
      <Banner kind="info">Dit is een demo met voorbeeldgegevens in je browser. Kies een persoon om te zien wat die wel en niet kan.</Banner>
      <ul className="flex flex-col gap-2">
        {state.employees.filter((e) => e.active).map((e) => {
          const group = state.groups.find((g) => g.id === Object.values(e.groupByDept)[0])?.name;
          return (
            <li key={e.id}>
              <button onClick={() => { signIn(e.id); router.replace(hasPermAnywhere(state, e.id, 'schedule.edit') ? '/rooster' : '/mijn-rooster'); }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-md border border-border bg-surface px-3 text-left hover:bg-surface-sunken">
                <Avatar name={`${e.firstName} ${e.lastName}`} />
                <span className="flex-1"><span className="block font-medium">{e.firstName} {e.lastName}</span><span className="text-xs text-text-muted">{group}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" onClick={() => resetState()}>Voorbeeldgegevens terugzetten</Button>
    </main>
  );
}
