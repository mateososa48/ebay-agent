import { AppShell } from '@/components/shell/app-shell';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Icon } from '@/components/ui/icons';

export default function ListingsPage() {
  return (
    <AppShell>
      <ComingSoon
        eyebrow="Listings"
        title="Everything you have live"
        note="Draft, live, and sold — with status, views, and offers at a glance. Tap the queue cards for now to open a listing."
        icon={<Icon.Grid className="size-7" />}
      />
    </AppShell>
  );
}
