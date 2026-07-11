import type { ReactNode } from 'react';

export const metadata = {
  title: 'eBay Selling Agent',
  description: 'Personal autonomous eBay selling agent',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
