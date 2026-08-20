import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';

import '@/styles/global.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'SafeBackpack — traveller safety reports on one map',
    template: '%s · SafeBackpack',
  },
  description:
    'Travellers report robberies, scams, natural hazards and unrest on a shared world map. No account needed.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#161513' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Reading a header opts every route into dynamic rendering, which a
  // nonce-based Content-Security-Policy requires: a page rendered once at
  // build time cannot carry a nonce that changes on every request. The cost is
  // prerendering; the gain is that an injected script cannot run even if one
  // ever slipped past React's escaping.
  await headers();

  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
