import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
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

/** Set by the platform on every Vercel deployment, and by nothing else. */
const onVercel = Boolean(process.env.VERCEL);

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
      <body>
        {children}
        {/*
          Both are cookieless and store no identifier for a visitor, which is
          why they need no consent banner and why the privacy notice can still
          say nothing follows anybody around. Their scripts are served from our
          own origin, so the content security policy needs no exception.

          Rendered only on Vercel: their endpoints exist nowhere else, so
          anywhere else these are two requests that can only 404.
        */}
        {onVercel && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
