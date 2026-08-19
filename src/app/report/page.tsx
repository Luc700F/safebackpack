import type { Metadata } from 'next';

import { ReportForm } from '@/components/report-form/ReportForm';
import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Report an incident',
  description:
    'Tell other travellers what happened and where. No account needed.',
};

export default function ReportPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Report an incident</h1>
          <p className={styles.lede}>
            Four short steps. You will see everything again before anything is
            published.
          </p>
        </div>
        <ReportForm />
      </main>
      <SiteFooter />
    </>
  );
}
