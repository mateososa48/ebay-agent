import type { ReactNode } from 'react';
import { EbayMark } from '@/components/brand/ebay-mark';

export const metadata = {
  title: 'Privacy Policy — Consignment Desk',
  description: 'How Consignment Desk handles data.',
};

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-[1.7] text-ink-muted">{children}</p>;
}
function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen bg-paper">
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-2xl px-6 py-16">
        <div className="flex items-center gap-2">
          <span className="font-display text-[17px] font-bold tracking-[-0.03em] text-ink">Consignment Desk</span>
          <span className="text-ink-faint">·</span>
          <EbayMark className="text-[14px]" />
        </div>

        <h1 className="mt-8 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
          Privacy Policy
        </h1>
        <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-faint">Last updated July 2026</p>

        <P>
          Consignment Desk is a personal, single-user tool that helps its owner research, price, and list their own
          items for sale on eBay. It is not a public product and does not serve other users.
        </P>

        <H>What we access</H>
        <P>
          With the owner&rsquo;s authorization, the app connects to their own eBay account through eBay&rsquo;s APIs to
          research comparable listings, create and manage the owner&rsquo;s listings, send offers, and answer buyer
          messages on the owner&rsquo;s behalf.
        </P>

        <H>What we store</H>
        <P>
          We store the owner&rsquo;s own item and listing data (photos, titles, prices, and drafts) and an encrypted
          authorization token used to act on the owner&rsquo;s eBay account. We do not sell data, and we do not use any
          eBay data to train third-party AI models.
        </P>

        <H>Other eBay users&rsquo; data</H>
        <P>
          The app does not collect or retain the personal information of other eBay users. Buyer identities returned by
          eBay are used only to complete the transaction the owner is already conducting and are not stored beyond what
          eBay itself provides for that purpose.
        </P>

        <H>Data deletion</H>
        <P>
          Because the app stores only its owner&rsquo;s own selling data, there is no third-party user data to purge.
          The owner can disconnect the eBay account and delete stored data at any time.
        </P>

        <H>Contact</H>
        <P>Questions about this policy can be directed to the account owner.</P>
      </div>
    </main>
  );
}
