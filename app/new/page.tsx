import { AppShell } from '@/components/shell/app-shell';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Icon } from '@/components/ui/icons';

export default function NewItemPage() {
  return (
    <AppShell>
      <ComingSoon
        eyebrow="New item"
        title="Drop photos, watch it work"
        note="Upload a few shots and the agent identifies the item, prices it from comps, and writes the listing — live, step by step. This screen is up next."
        icon={<Icon.Camera className="size-7" />}
      />
    </AppShell>
  );
}
