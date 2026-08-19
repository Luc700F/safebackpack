import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
