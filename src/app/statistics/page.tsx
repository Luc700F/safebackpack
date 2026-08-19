import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Statistics',
  description:
    'What the reports add up to over time, once there are enough of them.',
};

/**
 * The statistics section, prepared but not yet populated.
 *
 * The data it will read already exists: when a report leaves the map it is
 * anonymised rather than deleted, keeping category, country, a coarse cell,
 * the month and the time of day. See src/lib/reports/anonymisation.ts.
 *
 * Deliberately empty for now. Figures drawn from a few dozen reports would
 * look authoritative and mean nothing, which is worse than saying "not yet".
 */
export default function StatisticsPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Statistics</h1>
        <p className={styles.lede}>
          What the reports add up to — by country, by category, over the year.
        </p>

        <p className={styles.draft}>
          Not enough reports yet. Figures drawn from a few dozen entries would
          look authoritative and mean nothing, so this stays empty until the
          numbers can carry it.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>What will be here</h2>
          <ul className={styles.list}>
            <li>
              Reports per country and category, by month, so seasonal patterns
              become visible.
            </li>
            <li>
              Time of day, which is often the thing that actually changes how
              you plan an evening.
            </li>
            <li>
              Country pages linking to the official advice — for Swiss
              travellers, the FDFA — next to what travellers themselves
              reported.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Where the figures come from</h2>
          <p className={styles.text}>
            When a report leaves the map it is not deleted but stripped: the
            name, the email address, the exact position and the description go,
            and the category, country, a roughly 11 km grid cell, the month and
            the time of day stay. Those figures carry no link to a person, which
            is why they can be kept and counted indefinitely.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>How to read them</h2>
          <p className={styles.text}>
            A count of reports is a count of reports. Travellers are not spread
            evenly across the world, and a place with more visitors will show
            more entries without being more dangerous. These figures describe
            what people reported, not what happened.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
