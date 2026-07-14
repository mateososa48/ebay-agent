import { AppShell } from '@/components/shell/app-shell';
import { NewItemFlow } from '@/components/new-item/new-item-flow';
import { ActiveRuns } from '@/components/new-item/active-runs';

export const dynamic = 'force-dynamic';

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run } = await searchParams;
  return (
    <AppShell>
      {/* Keyed by run: switching between "fresh" and a resumed run remounts the
          flow so the eve hook re-reads its initialEvents/initialSession. */}
      <NewItemFlow key={run ?? 'new'} resumeItemId={run} />
      <ActiveRuns excludeItemId={run ?? null} />
    </AppShell>
  );
}
