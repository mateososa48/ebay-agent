import { AppShell } from '@/components/shell/app-shell';
import { NewItemFlow } from '@/components/new-item/new-item-flow';

export const dynamic = 'force-dynamic';

export default function NewItemPage() {
  return (
    <AppShell>
      <NewItemFlow />
    </AppShell>
  );
}
