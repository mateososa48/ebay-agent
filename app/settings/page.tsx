import { AppShell } from '@/components/shell/app-shell';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Icon } from '@/components/ui/icons';

export default function SettingsPage() {
  return (
    <AppShell>
      <ComingSoon
        eyebrow="Settings"
        title="Connect eBay & tune the agent"
        note="Link your eBay account, set how much the agent does on its own, and shape its voice. Coming with the live wiring."
        icon={<Icon.Sliders className="size-7" />}
      />
    </AppShell>
  );
}
