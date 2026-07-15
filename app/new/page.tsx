import { AppShell } from '@/components/shell/app-shell';
import { NewItemClient } from '@/components/new-item/new-item-client';

export const dynamic = 'force-dynamic';

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run } = await searchParams;
  return (
    <AppShell>
      <NewItemClient runId={run} />
    </AppShell>
  );
}
